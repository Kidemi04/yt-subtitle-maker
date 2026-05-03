from core.stt.base import TranscriptionSegment, TranscriptionResult, TranscriptionProvider


def test_segment_has_required_fields():
    seg = TranscriptionSegment(id=1, start=0.0, end=2.5, text="Hello")
    assert seg.id == 1
    assert seg.start == 0.0
    assert seg.end == 2.5
    assert seg.text == "Hello"


def test_segment_optional_translated_field_defaults_none():
    seg = TranscriptionSegment(id=1, start=0.0, end=2.5, text="Hello")
    assert seg.translated is None


def test_result_holds_segments_and_metadata():
    seg = TranscriptionSegment(id=1, start=0.0, end=1.0, text="Hi")
    res = TranscriptionResult(segments=[seg], language="en", source="whisper-local")
    assert len(res.segments) == 1
    assert res.language == "en"
    assert res.source == "whisper-local"


def test_provider_protocol_runtime_check_succeeds_on_compliant_class():
    class Dummy:
        name = "dummy"
        needs_audio = True

        def is_available(self, url=None): return True
        def transcribe(self, audio_path, url, language, progress=None):
            return TranscriptionResult(segments=[], language="en", source="dummy")

    # Protocol with @runtime_checkable should accept compliant duck-typed classes
    assert isinstance(Dummy(), TranscriptionProvider)
