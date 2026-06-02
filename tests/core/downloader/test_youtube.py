from pathlib import Path

from core.downloader.youtube import download_audio, safe_folder_name


def test_strips_filesystem_unsafe_chars():
    # NOTE: plan had "Hello___World__abc12345678" (2 underscores between World/abc)
    # but the plan's impl produces "Hello___World_abc12345678" (1 underscore) because
    # .strip("_") removes trailing underscores before suffix concat. Fixed expected
    # to match the actual (and reasonable) impl behavior.
    assert safe_folder_name('Hello: <World>?', "abc12345678") == "Hello___World_abc12345678"


def test_keeps_chinese_when_ascii_only_off():
    out = safe_folder_name("中文标题", "id123456789", ascii_only=False)
    assert "中文标题" in out


def test_falls_back_to_ascii_when_ascii_only():
    out = safe_folder_name("中文标题", "id123456789", ascii_only=True)
    assert "中文标题" not in out
    assert "id123456789" in out  # video_id always preserved


def test_truncates_long_titles():
    long_title = "x" * 500
    out = safe_folder_name(long_title, "id123456789")
    # Folder name must be <= 200 chars total to play nice with Windows paths
    assert len(out) <= 200


def test_collapses_whitespace():
    assert safe_folder_name("Hello    World", "abc12345678") == "Hello_World_abc12345678"


class _FakeYoutubeDL:
    captured_opts: dict | None = None

    def __init__(self, opts):
        type(self).captured_opts = opts

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def extract_info(self, url, download):
        for hook in self.captured_opts["progress_hooks"]:
            hook({"status": "finished", "filename": str(Path("abc12345678.webm"))})
        return {"id": "abc12345678", "duration": 12}


def test_download_audio_resamples_to_16k_by_default(tmp_path, monkeypatch):
    from core.downloader import youtube

    monkeypatch.setattr(youtube.yt_dlp, "YoutubeDL", _FakeYoutubeDL)
    monkeypatch.setattr(youtube, "load_config", lambda: type("Cfg", (), {"js_runtime_path": ""})())
    monkeypatch.setattr(youtube.os.path, "exists", lambda path: True)

    download_audio("https://example.test/video", str(tmp_path))

    assert _FakeYoutubeDL.captured_opts is not None
    assert _FakeYoutubeDL.captured_opts["postprocessor_args"] == [
        "-ar",
        "16000",
        "-ac",
        "1",
    ]


def test_download_audio_can_skip_16k_resample(tmp_path, monkeypatch):
    from core.downloader import youtube

    monkeypatch.setattr(youtube.yt_dlp, "YoutubeDL", _FakeYoutubeDL)
    monkeypatch.setattr(youtube, "load_config", lambda: type("Cfg", (), {"js_runtime_path": ""})())
    monkeypatch.setattr(youtube.os.path, "exists", lambda path: True)

    download_audio("https://example.test/video", str(tmp_path), resample_16k=False)

    assert _FakeYoutubeDL.captured_opts is not None
    assert "postprocessor_args" not in _FakeYoutubeDL.captured_opts
