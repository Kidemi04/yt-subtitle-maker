import os
import sys
import shutil
from pathlib import Path
from typing import Tuple
from yt_dlp import YoutubeDL
import queue
import threading


def _patch_shutil_copy_for_locked_files():
    """Monkey-patch shutil.copy to use Windows CopyFileW API as fallback.
    Chrome 127+ locks its cookie DB; Python's open() fails but Windows
    CopyFileW can still copy locked files."""
    if sys.platform != 'win32':
        return

    _original_copyfile = shutil.copyfile

    def _patched_copyfile(src, dst, *args, **kwargs):
        try:
            return _original_copyfile(src, dst, *args, **kwargs)
        except PermissionError:
            import ctypes
            # CopyFileW(src, dst, bFailIfExists=False)
            result = ctypes.windll.kernel32.CopyFileW(str(src), str(dst), False)
            if result == 0:
                raise  # CopyFileW also failed, re-raise original error
            return dst

    shutil.copyfile = _patched_copyfile

_patch_shutil_copy_for_locked_files()


def _build_cookie_opts(cookie_browser: str = "", cookies_txt_path: str = "", cookie_profile: str = "") -> dict:
    """Build yt-dlp cookie options based on priority: browser > cookies.txt file."""
    if cookie_browser:
        # yt-dlp tuple: (browser, profile, keyring, container)
        profile = cookie_profile.strip() or None
        return {'cookiesfrombrowser': (cookie_browser, profile, None, None)}
    if cookies_txt_path and os.path.isfile(cookies_txt_path):
        return {'cookiefile': cookies_txt_path}
    return {}


def download_audio(youtube_url: str, out_dir: str, cookie_browser: str = "", cookies_txt_path: str = "", cookie_profile: str = "") -> Tuple[str, float]:
    """
    Download audio-only from the given YouTube URL using yt-dlp.
    Return (absolute_path_to_audio_file, duration_in_seconds).
    Raise a custom exception on failure.
    """
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    # Output template: video_id.ext
    output_template = str(out_path / "%(id)s.%(ext)s")

    ydl_opts = {
        'format': 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best',
        'outtmpl': output_template,
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
    }
    ydl_opts.update(_build_cookie_opts(cookie_browser, cookies_txt_path, cookie_profile))

    def _do_download(opts):
        with YoutubeDL(opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            if not info:
                raise Exception("Download failed: No info returned.")
            if 'requested_downloads' in info:
                filename = info['requested_downloads'][0]['filepath']
            else:
                filename = ydl.prepare_filename(info)
            duration = info.get('duration', 0.0)
            return str(Path(filename).absolute()), float(duration)

    try:
        return _do_download(ydl_opts)
    except Exception as e:
        # If cookies were configured (browser or file) and the download failed,
        # retry without cookies. Authenticated requests can trigger n-challenge
        # JS decryption (fails without Deno/Node) — retrying without cookies
        # often succeeds for public videos.
        has_cookies = bool(cookie_browser or (cookies_txt_path and os.path.isfile(cookies_txt_path)))
        if has_cookies:
            fallback_opts = {k: v for k, v in ydl_opts.items()
                             if k not in ('cookiesfrombrowser', 'cookiefile')}
            try:
                return _do_download(fallback_opts)
            except Exception as e2:
                raise Exception(f"Download failed: {str(e2)}")
        raise Exception(f"Download failed: {str(e)}")

def download_media(youtube_url: str, out_dir: str, media_type: str = 'video') -> Tuple[str, str, float]:
    """
    Download media from YouTube.
    media_type: 'video' (mp4) or 'audio' (m4a/mp3)
    Return (filename, absolute_path, duration).
    """
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)

    # Output template: title.ext (easier for user to read than video_id)
    output_template = str(out_path / "%(title)s.%(ext)s")

    ydl_opts = {
        'outtmpl': output_template,
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
    }

    if media_type == 'audio':
        ydl_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'm4a',
            }],
        })
    else:
        # Video
        ydl_opts.update({
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        })

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=True)
            
            if not info:
                raise Exception("Download failed: No info returned.")
            
            if 'requested_downloads' in info:
                filename = info['requested_downloads'][0]['filepath']
            else:
                filename = ydl.prepare_filename(info)
            
            duration = info.get('duration', 0.0)
            
            return os.path.basename(filename), str(Path(filename).absolute()), float(duration)

    except Exception as e:
        raise Exception(f"Download failed: {str(e)}")

def download_media_generator(youtube_url: str, out_dir: str, media_type: str = 'video', quality: str = 'best', format: str = 'mp4', cookie_browser: str = "", cookies_txt_path: str = "", cookie_profile: str = ""):
    """
    Download media from YouTube and yield progress updates.
    Yields dicts:
    {'status': 'downloading', 'downloaded': X, 'total': Y, 'speed': Z, 'eta': W, 'percent': P}
    {'status': 'finished', 'filename': ..., 'path': ..., 'duration': ...}
    {'status': 'error', 'error': ...}
    """
    
    # Separate folders for video and audio
    subfolder = "video" if media_type == 'video' else "audio"
    out_path = Path(out_dir) / subfolder
    out_path.mkdir(parents=True, exist_ok=True)
    
    # Output template: title.ext
    output_template = str(out_path / "%(title)s.%(ext)s")
    
    q = queue.Queue()
    
    def progress_hook(d):
        if d['status'] == 'downloading':
            q.put({
                'status': 'downloading',
                'downloaded': d.get('downloaded_bytes', 0),
                'total': d.get('total_bytes') or d.get('total_bytes_estimate', 0),
                'speed': d.get('speed', 0),
                'eta': d.get('eta', 0),
                'percent': d.get('_percent_str', '0%').replace('%','')
            })
        elif d['status'] == 'finished':
            q.put({'status': 'processing', 'message': 'Post-processing...'})

    ydl_opts = {
        'outtmpl': output_template,
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
        'progress_hooks': [progress_hook],
        'writethumbnail': True, # Save thumbnail
    }
    ydl_opts.update(_build_cookie_opts(cookie_browser, cookies_txt_path, cookie_profile))

    if media_type == 'audio':
        # Audio format selection
        codec = 'mp3' if format == 'mp3' else 'm4a'
        ydl_opts.update({
            'format': 'bestaudio/best',
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': codec,
            }],
        })
    else:
        # Video quality selection
        # quality can be 'best', '1080p', '720p', '480p'
        if quality == 'best':
            format_str = f'bestvideo[ext={format}]+bestaudio[ext=m4a]/best[ext={format}]/best'
        else:
            height = quality.replace('p', '')
            format_str = f'bestvideo[height<={height}][ext={format}]+bestaudio[ext=m4a]/best[height<={height}][ext={format}]/best'

        ydl_opts.update({
            'format': format_str,
            'merge_output_format': format,
        })

    def run_download():
        try:
            with YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(youtube_url, download=True)
                if not info:
                    q.put({'status': 'error', 'error': 'No info returned'})
                    return

                if 'requested_downloads' in info:
                    filename = info['requested_downloads'][0]['filepath']
                else:
                    filename = ydl.prepare_filename(info)
                
                # Check if thumbnail was downloaded
                # yt-dlp saves it as filename.jpg/webp
                # We can try to find it
                thumb_path = None
                base_name = os.path.splitext(filename)[0]
                for ext in ['.jpg', '.webp', '.png']:
                    if os.path.exists(base_name + ext):
                        thumb_path = base_name + ext
                        break
                
                duration = info.get('duration', 0.0)
                
                q.put({
                    'status': 'finished',
                    'filename': os.path.basename(filename),
                    'path': str(Path(filename).absolute()),
                    'duration': float(duration),
                    'thumbnail': str(Path(thumb_path).absolute()) if thumb_path else None
                })
        except Exception as e:
            q.put({'status': 'error', 'error': str(e)})
        finally:
            q.put(None) # Sentinel

    t = threading.Thread(target=run_download)
    t.start()

    while True:
        item = q.get()
        if item is None:
            break
        yield item
        if item.get('status') in ['finished', 'error']:
            break
    
    t.join()
