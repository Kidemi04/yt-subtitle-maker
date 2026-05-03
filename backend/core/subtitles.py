from typing import List, Dict

def format_timestamp(seconds: float) -> str:
    """Convert 12.345 -> '00:00:12,345' in SRT format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def write_srt(
    segments: List[Dict],
    srt_path: str,
    field: str = "text",
) -> None:
    """
    Write SRT file using the given field from each segment.
    Each segment is:
      {"id": int, "start": float, "end": float, "text": "...", "translated": "...?"}

    `field` chooses which text to write: 'text' for original, 'translated' for translated.
    """
    with open(srt_path, "w", encoding="utf-8") as f:
        for i, seg in enumerate(segments):
            # Use segment ID if available, else index + 1
            idx = seg.get("id", i + 1)
            start_ts = format_timestamp(seg["start"])
            end_ts = format_timestamp(seg["end"])
            
            content = seg.get(field, "")
            if content is None:
                content = ""
            
            f.write(f"{idx}\n")
            f.write(f"{start_ts} --> {end_ts}\n")
            f.write(f"{content}\n\n")
