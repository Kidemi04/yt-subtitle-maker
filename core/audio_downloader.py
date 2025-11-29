import os
from pathlib import Path
from typing import Tuple
from yt_dlp import YoutubeDL

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
