import os
from pathlib import Path
from typing import Tuple
from yt_dlp import YoutubeDL
import queue
import threading

def download_audio(youtube_url: str, out_dir: str) -> Tuple[str, float]:
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
        'format': 'ba[ext=m4a]/bestaudio', # prefer m4a, fallback to best
        'outtmpl': output_template,
        'noplaylist': True,
        'quiet': True,
        'no_warnings': True,
    }

    try:
        with YoutubeDL(ydl_opts) as ydl:
            # extract_info with download=True returns info dict
            info = ydl.extract_info(youtube_url, download=True)
            
            if not info:
                raise Exception("Download failed: No info returned.")
            
            # Get filename
            # yt-dlp might change extension if we didn't force it?
            # info['requested_downloads'] might have the file path
            if 'requested_downloads' in info:
                filename = info['requested_downloads'][0]['filepath']
            else:
                # Fallback, prepare_filename might work
                filename = ydl.prepare_filename(info)
            
            duration = info.get('duration', 0.0)
            
            return str(Path(filename).absolute()), float(duration)

    except Exception as e:
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

def download_media_generator(youtube_url: str, out_dir: str, media_type: str = 'video'):
    """
    Download media from YouTube and yield progress updates.
    Yields dicts:
    {'status': 'downloading', 'downloaded': X, 'total': Y, 'speed': Z, 'eta': W, 'percent': P}
    {'status': 'finished', 'filename': ..., 'path': ..., 'duration': ...}
    {'status': 'error', 'error': ...}
    """
    
    out_path = Path(out_dir)
    out_path.mkdir(parents=True, exist_ok=True)
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
        ydl_opts.update({
            'format': 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
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
                
                duration = info.get('duration', 0.0)
                
                q.put({
                    'status': 'finished',
                    'filename': os.path.basename(filename),
                    'path': str(Path(filename).absolute()),
                    'duration': float(duration)
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
