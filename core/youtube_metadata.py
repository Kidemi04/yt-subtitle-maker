from typing import Optional, Dict
from yt_dlp import YoutubeDL

def fetch_video_metadata(youtube_url: str) -> Dict[str, Optional[str]]:
    """
    Fetch basic metadata for a YouTube video.

    Returns a dict like:
    {
        "title": "Video Title",
        "thumbnail_url": "https://...",
    }

    On error, return None for the fields or raise a clear exception.
    """
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True, # Faster, but might miss some details. 
                              # For title/thumb it's usually enough.
                              # If flat extraction fails to get thumb, we might need full extraction.
                              # Let's try full extraction but without download, it's safer.
    }
    
    # Override extract_flat to False to ensure we get thumbnail
    ydl_opts['extract_flat'] = False 

    try:
        with YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(youtube_url, download=False)
            
            if not info:
                raise Exception("No video information found.")
                
            return {
                "title": info.get("title"),
                "thumbnail_url": info.get("thumbnail"),
            }
    except Exception as e:
        raise Exception(f"Failed to fetch metadata: {str(e)}")
