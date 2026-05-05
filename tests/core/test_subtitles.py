"""Tests for read_srt — round-trip + tolerance."""
from __future__ import annotations

from pathlib import Path

from core.subtitles import read_srt, write_srt


def test_read_srt_round_trip(tmp_path: Path):
    srt = tmp_path / "x.srt"
    write_srt(
        [
            {"id": 1, "start": 1.5, "end": 2.0, "text": "Hello"},
            {"id": 2, "start": 3.0, "end": 4.5, "text": "World"},
        ],
        str(srt),
    )
    segments = read_srt(str(srt))
    assert len(segments) == 2
    assert segments[0].id == 1
    assert segments[0].text == "Hello"
    assert abs(segments[0].start - 1.5) < 1e-3
    assert abs(segments[1].end - 4.5) < 1e-3


def test_read_srt_joins_multiline_cue_with_spaces(tmp_path: Path):
    srt = tmp_path / "multiline.srt"
    srt.write_text(
        "1\n00:00:01,000 --> 00:00:02,000\nLine one\nLine two\n",
        encoding="utf-8",
    )
    segments = read_srt(str(srt))
    assert len(segments) == 1
    assert segments[0].text == "Line one Line two"


def test_read_srt_tolerates_bom_and_crlf(tmp_path: Path):
    srt = tmp_path / "bom.srt"
    srt.write_bytes(
        b"\xef\xbb\xbf"
        b"1\r\n00:00:01,000 --> 00:00:02,000\r\nHello\r\n\r\n"
    )
    segments = read_srt(str(srt))
    assert len(segments) == 1
    assert segments[0].text == "Hello"
