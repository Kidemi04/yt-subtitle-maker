"""JavaScript runtime detection for yt-dlp.

Recent yt-dlp versions deobfuscate YouTube player signatures via an embedded
JS runtime. Only `deno` is wired up by default; without a detectable runtime
the warning "No supported JavaScript runtime could be found" prints on every
extraction and many video formats become unavailable (so playback / download
silently misses the streams the user actually wants).

This module probes PATH for `deno` first, then `node`, and returns the
yt-dlp `js_runtimes` opts dict — top-level (NOT inside `extractor_args`),
shape `{runtime_name: {"path": <absolute exe path>}}` per yt-dlp's source
docstring. Supported runtime names are deno / node / bun / quickjs.

Order of preference:
  1. Explicit override (cfg.js_runtime_path or YT_JS_RUNTIME env var)
  2. `deno` on PATH (yt-dlp's preferred)
  3. `node` on PATH

`detect_js_runtime` returns the user-readable spec ("node:C:\\path\\node.exe")
that the frontend surfaces in Settings → Advanced. `build_js_runtime_opts`
returns the yt-dlp-shaped opts fragment ready to merge into a `YoutubeDL`
constructor argument.
"""
from __future__ import annotations

import os
import shutil

# yt-dlp accepts these names (lowercase). Other values are dropped at runtime.
_KNOWN_RUNTIMES = {"deno", "node", "bun", "quickjs"}


def _parse_override(override: str) -> tuple[str, str] | None:
    """Resolve the user's override to (runtime_name, absolute_path).

    Accepts: "node", "deno", "node:C:\\path\\node.exe", or a bare absolute
    path whose basename hints the runtime.
    """
    spec = override.strip()
    if not spec:
        return None

    # On Windows paths look like `C:\foo\node.exe`. Treat the colon at index 1
    # as part of the drive letter, not the runtime separator.
    is_windows_path = len(spec) > 1 and spec[1] == ":" and (len(spec) > 2 and spec[2] in "/\\")

    # Bare runtime name — verify it resolves on PATH.
    if ":" not in spec and "/" not in spec and "\\" not in spec:
        if spec.lower() in _KNOWN_RUNTIMES:
            resolved = shutil.which(spec)
            return (spec.lower(), resolved) if resolved else None
        return None

    # `runtime:path` form (excluding Windows "C:\..." which has a path-like
    # second char).
    if ":" in spec and not is_windows_path:
        name, _, path = spec.partition(":")
        name = name.lower()
        if name in _KNOWN_RUNTIMES and os.path.exists(path):
            return (name, path)
        return None

    # Bare absolute path — infer runtime name from basename.
    base = os.path.splitext(os.path.basename(spec))[0].lower()
    if base in _KNOWN_RUNTIMES and os.path.exists(spec):
        return (base, spec)
    return None


def _detect_runtime_pair(override: str | None = None) -> tuple[str, str] | None:
    """Internal helper — returns (name, path) for the runtime to enable."""
    if override:
        result = _parse_override(override)
        if result:
            return result

    env_override = os.environ.get("YT_JS_RUNTIME")
    if env_override and env_override != override:
        result = _parse_override(env_override)
        if result:
            return result

    deno = shutil.which("deno")
    if deno:
        return ("deno", deno)
    node = shutil.which("node")
    if node:
        return ("node", node)
    return None


def detect_js_runtime(override: str | None = None) -> str | None:
    """Return a "<name>:<path>" spec for the runtime yt-dlp will use, or None.

    Used by /api/version to surface the detected state to the frontend.
    """
    pair = _detect_runtime_pair(override)
    return f"{pair[0]}:{pair[1]}" if pair else None


def build_js_runtime_opts(override: str | None = None) -> dict:
    """Return yt-dlp opts fragment that wires up a JS runtime if available.

    Spread into the main opts dict before constructing YoutubeDL:
        opts.update(build_js_runtime_opts(cfg.js_runtime_path))

    Two pieces are needed for current YouTube extraction:
      - `js_runtimes`  : top-level (NOT under `extractor_args`),
                         shape `{name: {"path": "..."}}`. Tells yt-dlp WHERE
                         the runtime executable lives.
      - `remote_components`: allow yt-dlp to fetch the EJS challenge-solver
                         scripts from GitHub at runtime (otherwise sig/n
                         challenges fail with "Some formats may be missing").

    Without `remote_components`, the runtime is detected but the n-challenge
    solver script isn't downloaded — same symptom as no runtime at all
    (formats fall through to the limited extraction path).
    """
    pair = _detect_runtime_pair(override)
    if not pair:
        return {}
    name, path = pair
    return {
        "js_runtimes": {name: {"path": path}},
        # Allow yt-dlp to grab the YouTube challenge solver bundle from
        # github.com/yt-dlp/yt-dlp-ejs. Required for n-challenge / signature
        # decryption on current YT player builds. npm mirror enabled too as
        # a fallback when GitHub is rate-limited / unreachable.
        "remote_components": ["ejs:github", "ejs:npm"],
    }
