from core.stt.yt_captions import YtCaptionsProvider
from core.stt.base import TranscriptionProvider


def test_provider_satisfies_protocol():
    provider = YtCaptionsProvider()
    assert isinstance(provider, TranscriptionProvider)
    assert provider.name == "yt_captions"
    assert provider.needs_audio is False  # only needs URL


def test_parse_vtt_to_segments():
    # Minimal VTT fixture
    vtt = (
        "WEBVTT\n\n"
        "00:00:01.000 --> 00:00:03.500\n"
        "Hello world\n\n"
        "00:00:04.000 --> 00:00:06.000\n"
        "Second line\n\n"
    )
    provider = YtCaptionsProvider()
    segs = provider._parse_vtt(vtt)
    assert len(segs) == 2
    assert segs[0].start == 1.0
    assert segs[0].end == 3.5
    assert segs[0].text == "Hello world"
    assert segs[1].text == "Second line"
