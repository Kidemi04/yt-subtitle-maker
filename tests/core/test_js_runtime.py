"""Tests for the yt-dlp JS runtime detector."""
from __future__ import annotations

from unittest.mock import patch

from core.downloader.js_runtime import build_js_runtime_opts, detect_js_runtime


def test_detect_returns_none_when_no_runtime_on_path():
    with patch("core.downloader.js_runtime.shutil.which", return_value=None):
        with patch.dict("os.environ", {}, clear=False):
            # Clear the env override too so the test is deterministic.
            import os
            os.environ.pop("YT_JS_RUNTIME", None)
            assert detect_js_runtime() is None


def test_detect_prefers_deno_when_available():
    def fake_which(name: str):
        return f"/usr/local/bin/{name}" if name in {"deno", "node"} else None

    with patch("core.downloader.js_runtime.shutil.which", side_effect=fake_which):
        spec = detect_js_runtime()
        assert spec == "deno:/usr/local/bin/deno"


def test_detect_falls_back_to_node():
    def fake_which(name: str):
        return "/usr/bin/node" if name == "node" else None

    with patch("core.downloader.js_runtime.shutil.which", side_effect=fake_which):
        assert detect_js_runtime() == "node:/usr/bin/node"


def test_explicit_override_bare_name_is_resolved():
    with patch("core.downloader.js_runtime.shutil.which", return_value="/opt/node"):
        assert detect_js_runtime("node") == "node:/opt/node"


def test_explicit_override_already_in_name_path_form_passes_through():
    spec = "node:/custom/path/to/node.exe"
    # No shutil.which path needed — already resolved.
    assert detect_js_runtime(spec) == spec


def test_build_opts_returns_empty_when_no_runtime():
    with patch("core.downloader.js_runtime.shutil.which", return_value=None):
        import os
        os.environ.pop("YT_JS_RUNTIME", None)
        assert build_js_runtime_opts() == {}


def test_build_opts_emits_extractor_args_for_youtube():
    with patch(
        "core.downloader.js_runtime.shutil.which",
        side_effect=lambda n: "/x/node" if n == "node" else None,
    ):
        opts = build_js_runtime_opts()
        assert opts == {
            "extractor_args": {"youtube": {"jsruntime": ["node:/x/node"]}},
        }
