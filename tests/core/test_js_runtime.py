"""Tests for the yt-dlp JS runtime detector."""
from __future__ import annotations

import os
from unittest.mock import patch

from core.downloader.js_runtime import build_js_runtime_opts, detect_js_runtime


def test_detect_returns_none_when_no_runtime_on_path():
    with patch("core.downloader.js_runtime.shutil.which", return_value=None):
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


def test_explicit_override_in_name_path_form(tmp_path):
    fake_node = tmp_path / "node.exe"
    fake_node.write_text("")  # exists check
    spec = f"node:{fake_node}"
    assert detect_js_runtime(spec) == spec


def test_explicit_override_unsupported_runtime_falls_back_to_path():
    """yt-dlp only knows {deno, node, bun, quickjs}; an unsupported override
    is rejected and we fall through to the PATH probe."""
    def fake_which(name: str):
        return f"/usr/bin/{name}" if name in {"node", "deno"} else None

    with patch("core.downloader.js_runtime.shutil.which", side_effect=fake_which):
        os.environ.pop("YT_JS_RUNTIME", None)
        # "yolo" is rejected — falls through to deno (preferred) on PATH.
        assert detect_js_runtime("yolo") == "deno:/usr/bin/deno"


def test_unsupported_override_with_empty_path_returns_none():
    with patch("core.downloader.js_runtime.shutil.which", return_value=None):
        os.environ.pop("YT_JS_RUNTIME", None)
        assert detect_js_runtime("yolo") is None


def test_build_opts_returns_empty_when_no_runtime():
    with patch("core.downloader.js_runtime.shutil.which", return_value=None):
        os.environ.pop("YT_JS_RUNTIME", None)
        assert build_js_runtime_opts() == {}


def test_build_opts_emits_top_level_js_runtimes_and_remote_components():
    """yt-dlp expects {js_runtimes: {name: {path: ...}}} at the TOP level —
    NOT nested under extractor_args. AND `remote_components` must allow
    `ejs:github` so the challenge-solver script can be fetched. Regression
    test for the original wrong shape (extractor_args.youtube.jsruntime)
    AND for the missing remote_components piece."""
    with patch(
        "core.downloader.js_runtime.shutil.which",
        side_effect=lambda n: "/x/node" if n == "node" else None,
    ):
        os.environ.pop("YT_JS_RUNTIME", None)
        opts = build_js_runtime_opts()
        assert opts["js_runtimes"] == {"node": {"path": "/x/node"}}
        assert "ejs:github" in opts["remote_components"]
        # NEVER under extractor_args — that's where the original mistake was.
        assert "extractor_args" not in opts
