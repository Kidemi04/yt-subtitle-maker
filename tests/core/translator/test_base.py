from core.translator.base import TranslationProvider


def test_protocol_runtime_check():
    class Dummy:
        name = "dummy"

        def is_available(self): return True
        def ping(self): pass
        def list_models(self): return ["m1"]
        def translate_segments(self, segments, target_lang, progress=None): pass
        def translate_title(self, title, target_lang): return title

    assert isinstance(Dummy(), TranslationProvider)
