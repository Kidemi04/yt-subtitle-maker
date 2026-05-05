import re

from core.stt.base import TranscriptionSegment


def format_timestamp(seconds: float) -> str:
    """Convert 12.345 -> '00:00:12,345' in SRT format."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"

def write_srt(
    segments: list[dict],
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


_TS = re.compile(
    r"^(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)\s*$"
)


def _ts_to_seconds(h: str, m: str, s: str, ms: str) -> float:
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms.ljust(3, "0")[:3]) / 1000.0


def read_srt(srt_path: str) -> list[TranscriptionSegment]:
    """Parse an SRT file back into TranscriptionSegment list.

    Tolerant of trailing whitespace, BOMs, and missing blank-line separators
    at EOF. Multi-line cue text is joined with spaces (not newlines) so the
    translator gets a single line per segment — translators that re-emit
    one-line-per-input behave best that way.
    """
    with open(srt_path, encoding="utf-8-sig") as f:
        text = f.read().replace("\r\n", "\n")
    blocks = re.split(r"\n\s*\n", text.strip())
    segments: list[TranscriptionSegment] = []
    for block in blocks:
        lines = [line for line in block.split("\n") if line.strip() != ""]
        if len(lines) < 2:
            continue
        # Optional numeric index, optional timecode line, then text.
        idx_token = lines[0].strip()
        ts_line_idx = 1 if idx_token.isdigit() else 0
        if ts_line_idx >= len(lines):
            continue
        ts_match = _TS.match(lines[ts_line_idx])
        if not ts_match:
            continue
        h1, m1, s1, ms1, h2, m2, s2, ms2 = ts_match.groups()
        start = _ts_to_seconds(h1, m1, s1, ms1)
        end = _ts_to_seconds(h2, m2, s2, ms2)
        body = " ".join(lines[ts_line_idx + 1 :]).strip()
        try:
            seg_id = int(idx_token) if idx_token.isdigit() else len(segments) + 1
        except ValueError:
            seg_id = len(segments) + 1
        segments.append(
            TranscriptionSegment(id=seg_id, start=start, end=end, text=body)
        )
    return segments
