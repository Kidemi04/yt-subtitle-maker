"""JavaScript runtime detection for yt-dlp.

Recent yt-dlp versions deobfuscate YouTube player signatures via an embedded
JS runtime. Only `deno` is wired up by default; without a detectable runtime
the warning "No supported JavaScript runtime could be found" prints on every
extraction and many video formats become unavailable (so playback / download
silently misses the streams the user actually wants).

This module probes PATH for `deno` first, then `node`, and emits the
`extractor_args.youtube.jsruntime` option in the form yt-dlp's CLI accepts:
a list of "<runtime>" or "<runtime>:<absolute path>" strings.

Order of preference:
  1. Explicit override (cfg.js_runtime_path or YT_JS_RUNTIME env var)
  2. `deno` on PATH (yt-dlp's preferred)
  3. `node` on PATH

Returns an empty list when nothing's found — yt-dlp will fall through to its
limited built-in extraction and emit the warning. Frontend surfaces the
"no runtime" state via /api/version.jsRuntime so the user can install one.
"""
from __future__ import annotations

import os
import shutil


def detect_js_runtime(override: str | None = None) -> str | None:
    """Return the runtime spec yt-dlp wants, or None if none found.

    `override` is a config value like "node" / "deno" / "node:/usr/bin/node"
    or just an absolute path (we infer the runtime name from the basename).
    """
    if override:
        spec = override.strip()
        if spec:
            # Bare "node" / "deno" — verify it resolves on PATH.
            if ":" not in spec and "/" not in spec and "\\" not in spec:
                resolved = shutil.which(spec)
                return f"{spec}:{resolved}" if resolved else None
            # Absolute path — infer name from basename.
            if ":" not in spec or (len(spec) > 1 and spec[1] == ":"):
                # On Windows "C:\..." has a colon at index 1; treat as path.
                base = os.path.splitext(os.path.basename(spec))[0].lower()
                if base in {"node", "deno"} and os.path.exists(spec):
                    return f"{base}:{spec}"
            # Already in "name:path" form.
            return spec

    env_override = os.environ.get("YT_JS_RUNTIME")
    if env_override and env_override != override:
        result = detect_js_runtime(env_override)
        if result:
            return result

    deno = shutil.which("deno")
    if deno:
        return f"deno:{deno}"
    node = shutil.which("node")
    if node:
        return f"node:{node}"
    return None


def build_js_runtime_opts(override: str | None = None) -> dict:
    """Return yt-dlp opts fragment that wires up a JS runtime if available.

    Spread into the main opts dict before constructing YoutubeDL:
        opts.update(build_js_runtime_opts(cfg.js_runtime_path))
    """
    spec = detect_js_runtime(override)
    if not spec:
        return {}
    return {
        "extractor_args": {
            "youtube": {"jsruntime": [spec]},
        },
    }
