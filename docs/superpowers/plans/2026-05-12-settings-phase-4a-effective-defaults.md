# Settings Tab — Phase 4a: Effective-Defaults Endpoint + Platform-Correct Placeholders — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `GET /api/config` (and `POST /api/config` / `POST /api/config/reset`) return a `_defaults` sibling block carrying the **effective** default config — the `AppConfig()` defaults, but with the path fields (`outputDir`, `downloadDir`, `whisperCacheDir`, `mpvPath`) replaced by their real resolved values — so the frontend's folder/path placeholders are true and Phase 4b's per-field `↺` knows what value to revert to. Then wire those into the folder/path fields' placeholders.

**Architecture:** Tiny. Backend: a `_effective_defaults()` helper + a `_config_response()` wrapper in `backend/api/routes/config.py` used by all three config handlers; a pytest. api-client: one optional field on the `AppConfig` type. Frontend: `SettingsContext` exposes `defaults`; the path/folder `SettingRow`s in `GeneralTab` / `YouTubeTab` / `SubtitlesTab` use it for `placeholder`. No new endpoints, no Rust, no config-model change. (This is the foundational sub-plan of Phase 4 — see `docs/superpowers/plans/2026-05-12-settings-phase-4-overview.md`.)

**Tech Stack:** FastAPI + dataclasses (backend); pytest; TypeScript fetch client (`packages/api-client`); Expo / RNW / Tamagui frontend (`apps/desktop`).

**Spec:** `docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md` — the "Effective defaults" item ("`GET /api/config` gains a `_defaults` sibling block carrying the real default values/paths, so the UI knows what placeholders to show and what `↺` reverts to — one round-trip, both pieces") and the "Wrong-platform copy" trust fix ("Replace `C:\Users\...` placeholders with the **actual resolved default path**"). The spec lists this under Phase 1; the Phase-1 plan deferred it here (it noted "Showing the *real resolved* default path … needs the backend to expose effective paths; not in scope here").

**Out of scope for 4a (do not pull in):** the per-field `↺` button / per-tab "Reset this tab" / Hybrid autosave — that's **Phase 4b** (which *consumes* the `_defaults` block this plan adds; the Save/Discard footer stays for now); arming the folder/path fields / "Browse…" — **Phase 4e**; anything else in Phase 4.

**Prerequisites:** backend venv exists; `pnpm install` done. Manual checks: backend (`cd backend && ../backend/.venv/bin/python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --reload`) + `pnpm web` (→ http://localhost:8081). No Rust needed.

---

## File structure

| File | Change |
|---|---|
| `backend/api/routes/config.py` | Add `_effective_defaults()` (the `AppConfig()` dict with path fields resolved) + `_config_response(cfg)` (mask+camel + attach `_defaults`); use `_config_response` in `get_config` / `update_config` / `reset_config`. |
| `tests/api/test_config_route.py` | Add a test: `GET /api/config` (and the two POSTs) include a `_defaults` block with the right shape & values. |
| `packages/api-client/src/types.ts` | `AppConfig` gets an optional `_defaults?: AppConfig`. |
| `apps/desktop/src/components/settings/SettingsContext.tsx` | Expose `defaults: AppConfig | undefined` (= `config?._defaults`). |
| `apps/desktop/src/components/settings/GeneralTab.tsx`, `YouTubeTab.tsx`, `SubtitlesTab.tsx` | The folder/path `SettingRow`s use `placeholder={defaults?.xField || ""}`. |

## Note on testing

Backend = pytest (one new test in `tests/api/test_config_route.py`). Frontend = `pnpm -F desktop typecheck` + a manual eyeball that the placeholders now show real paths. `pnpm web` + `uvicorn` running for the manual check.

---

### Task 1: `GET /api/config` returns a `_defaults` block (with resolved paths)

**Files:** Modify `backend/api/routes/config.py`; Test `tests/api/test_config_route.py`.

- [ ] **Step 1: Write the failing test**

Append to `tests/api/test_config_route.py` (match the file's existing fixture style — it has a `client` fixture and monkeypatches the config dir; reuse them):

```python
def test_config_response_includes_effective_defaults(client, tmp_path, monkeypatch):
    import core.config as cfgmod
    monkeypatch.setattr(cfgmod, "config_dir", lambda: tmp_path)

    body = client.get("/api/config").json()
    assert "_defaults" in body
    d = body["_defaults"]
    # camelCase keys, same shape as the config:
    assert d["defaultWhisperModel"] == "turbo"
    assert d["backendUrl"] == "http://127.0.0.1:8000"
    assert d["geminiApiKey"] == ""          # default secret is empty ⇒ not masked
    assert d["subFontSize"] == 0
    # path fields are RESOLVED, not blank:
    assert d["outputDir"] and d["outputDir"].endswith("output")
    assert d["downloadDir"] and d["downloadDir"].endswith("downloads")
    # the POSTs carry it too:
    assert "_defaults" in client.post("/api/config", json={"defaultTargetLang": "fr"}).json()
    assert "_defaults" in client.post("/api/config/reset").json()
    # and _defaults is the DEFAULTS, not the current (now-dirty) config:
    body2 = client.get("/api/config").json()  # after the POST above (then reset) it's default again
    assert body2["_defaults"]["defaultTargetLang"] == "zh-CN"
```

(If `test_config_route.py` doesn't already have a `client` fixture / config-dir monkeypatch, copy whatever pattern it uses for the other `/api/config` tests — the point is "the GET/POST responses gain a `_defaults` block with the AppConfig defaults camelCased, secrets unmasked-because-empty, and the path fields resolved".)

- [ ] **Step 2: Run it — confirm it fails**

`backend/.venv/bin/python -m pytest tests/api/test_config_route.py -q` → FAIL (`KeyError: '_defaults'`).

- [ ] **Step 3: Implement**

In `backend/api/routes/config.py`, add `import shutil` and `from pathlib import Path` at the top, then after the `_mask_secrets` helper add:

```python
# Path config fields that are blank-by-default and resolved at runtime relative
# to the backend's CWD (output/downloads) or to a system location. The frontend
# shows these resolved values as placeholders / uses them for ↺-to-default.
def _effective_defaults() -> dict:
    d = asdict(AppConfig())
    cwd = Path.cwd()
    d["output_dir"] = str(cwd / "output")
    d["download_dir"] = str(cwd / "downloads")
    if not d["whisper_cache_dir"]:
        # openai-whisper's download_root default. If core/stt/whisper_local.py or
        # core/dependency_manager.py passes a different download_root, use that.
        d["whisper_cache_dir"] = str(Path.home() / ".cache" / "whisper")
    d["mpv_path"] = shutil.which("mpv") or ""
    # js_runtime_path stays "" — /api/version already reports the auto-detected runtime.
    return d


def _config_response(cfg: AppConfig) -> dict:
    out = _mask_secrets(_to_camel(asdict(cfg)))
    out["_defaults"] = _mask_secrets(_to_camel(_effective_defaults()))
    return out
```

Then change the three handlers to use it:

```python
@router.get("/config")
def get_config() -> dict:
    return _config_response(load_config())


@router.post("/config")
def update_config(payload: dict[str, Any] = Body(...)) -> dict:  # noqa: B008
    cfg = load_config()
    for camel_key, value in payload.items():
        if camel_key in SECRET_KEYS and value == MASK:
            continue
        snake_key = _CAMEL_TO_SNAKE.get(camel_key)
        if snake_key and hasattr(cfg, snake_key):
            setattr(cfg, snake_key, value)
    save_config(cfg)
    return _config_response(load_config())


@router.post("/config/reset")
def reset_config() -> dict:
    save_config(AppConfig())
    return _config_response(load_config())
```

(Verify the executor's assumption against the code: CLAUDE.md says `output/` and `downloads/` resolve relative to the backend's CWD — `Path.cwd()` in the running server *is* that CWD, so `cwd / "output"` matches what the pipeline resolves a blank `output_dir` to. For `whisper_cache_dir`, grep `core/stt/whisper_local.py` and `core/dependency_manager.py` for the `download_root` they hand to `whisper.load_model` / the model download — if it's not `~/.cache/whisper`, use whatever it actually is.)

- [ ] **Step 4: Run it — confirm it passes; full suite green**

`backend/.venv/bin/python -m pytest tests/api/test_config_route.py -q` → PASS. `backend/.venv/bin/python -m pytest -q` → still green.

- [ ] **Step 5: Commit**

```bash
git add backend/api/routes/config.py tests/api/test_config_route.py
git commit -m "feat(api): GET/POST /api/config return a _defaults block (effective defaults incl. resolved paths)"
```

---

### Task 2: api-client type + frontend placeholder wiring

**Files:** Modify `packages/api-client/src/types.ts`; `apps/desktop/src/components/settings/SettingsContext.tsx`; `GeneralTab.tsx`; `YouTubeTab.tsx`; `SubtitlesTab.tsx`.

- [ ] **Step 1: Add `_defaults` to the `AppConfig` type**

In `packages/api-client/src/types.ts`, add to the `AppConfig` interface (anywhere; near the bottom is fine):

```typescript
  /** Effective default config (AppConfig() defaults, path fields resolved). Present on GET/POST /api/config responses. */
  _defaults?: AppConfig;
```

(Self-referential-optional is harmless and avoids restructuring `types.ts`. Run `cd packages/api-client && npx tsc --noEmit` — should be clean.)

- [ ] **Step 2: Expose `defaults` from `SettingsContext`**

In `apps/desktop/src/components/settings/SettingsContext.tsx`: add `defaults: AppConfig | undefined;` to the `SettingsContextValue` interface, and in the provider compute `const defaults = config?._defaults;` (right where `dirty` is computed) and add `defaults` to the `value` object. (No state needed — it's derived from `config`.)

- [ ] **Step 3: Use `defaults` for the path/folder placeholders**

In each tab, pull `defaults` from `useSettings()` and set the placeholder on the path/folder `SettingRow`s (keep everything else):

- **`GeneralTab.tsx`** — `subtitles.output-dir`/`...whisper-cache-dir`/`...download-dir` `TextInput`s:
  - "Output folder" → `placeholder={defaults?.outputDir || ""}` (and the helper can become `"Where finished .srt files are written. Leave blank to use ${defaults?.outputDir ?? "the default location"}."` — optional; the existing helper is fine, the placeholder is the main thing).
  - "Download folder" → `placeholder={defaults?.downloadDir || ""}`.
  - "Whisper cache directory" → `placeholder={defaults?.whisperCacheDir || ""}`.
  - "Logs verbosity" — no change (not a path field).
- **`YouTubeTab.tsx`** — the "JS runtime for yt-dlp" `TextInput`: leave its placeholder as is (`_defaults.jsRuntimePath` is `""`; the helper already shows the detected runtime from `jsRuntime`). No change needed — but if you want, `placeholder={defaults?.jsRuntimePath || "(auto-detect node/deno on PATH)"}` is harmless.
- **`SubtitlesTab.tsx`** — the "MPV executable path" `TextInput` (it's still a plain `TextInput` — `ArmedField` for it is Phase 4e): `placeholder={defaults?.mpvPath || ""}` (so on a machine with mpv installed it ghosts the resolved path; otherwise `""`). Don't touch the font/color/numeric/bold rows.

Import nothing new — `defaults` comes from the existing `useSettings()` destructure (add `defaults` to it in each tab).

- [ ] **Step 4: Verify**

`pnpm -F desktop typecheck` → clean. `cd packages/api-client && npx tsc --noEmit` → clean.

Manual (backend + `pnpm web` running): open http://localhost:8081/settings — **General** → "Output folder" / "Download folder" / "Whisper cache directory" now show the resolved default path as ghost text (e.g. `…/yt-subtitle-maker/backend/output`) instead of nothing; **Subtitles** → "MPV executable path" ghosts the resolved mpv path if mpv is installed (else blank). Typing a real path still works; clearing a field still leaves it blank (= "use default"); Save → reload → behaves as before. (The placeholders are cosmetic — nothing about save/load changed.)

- [ ] **Step 5: Commit**

```bash
git add packages/api-client/src/types.ts apps/desktop/src/components/settings/SettingsContext.tsx apps/desktop/src/components/settings/GeneralTab.tsx apps/desktop/src/components/settings/YouTubeTab.tsx apps/desktop/src/components/settings/SubtitlesTab.tsx
git commit -m "feat(settings): folder/path placeholders show the real resolved default path"
```

---

## Self-review (done by plan author)

- **Spec coverage (4a slice):** "`GET /api/config` gains a `_defaults` sibling block carrying the real default values/paths … one round-trip, both pieces" → Task 1 (the `_defaults` block on GET *and* both POSTs, via `_config_response`) ✓. "Replace `C:\Users\...` placeholders with the actual resolved default path" → Task 2 (the path/folder fields' placeholders now come from `_defaults`; the Windows-path one was already removed in Phase 1) ✓. "what `↺` reverts to" → the `_defaults` block is the value source for Phase 4b's `↺` (out of scope to *use* it here; just providing it) ✓.
- **Placeholder scan:** none — Task 1 gives the literal `_effective_defaults`/`_config_response` code + the handler rewrites + the test; Task 2 gives the type addition + the exact placeholder changes. The "verify `whisper_cache_dir`'s real `download_root` against `core/stt/whisper_local.py`" note is concrete guidance about an existing-codebase convention (not deferred work) — `~/.cache/whisper` is the documented default if nothing overrides it.
- **Type/name consistency:** `_defaults` is the same key on the backend response (`out["_defaults"]`), the api-client type (`AppConfig._defaults?`), and the frontend (`config?._defaults` → `defaults`). The path field names used in Task 2 (`outputDir`, `downloadDir`, `whisperCacheDir`, `mpvPath`, `jsRuntimePath`) are the existing `AppConfig` camelCase keys. `_config_response` is used by all three handlers, so `POST /api/config` and `POST /api/config/reset` responses gain `_defaults` too (the frontend's `onSave`/reset paths call `setConfig(next)` with that response — so `defaults` stays populated after a save/reset).
- **Risk notes:** the only judgement call is what counts as a "resolved" path — `output_dir`/`download_dir` are unambiguous (`Path.cwd() / "output"|"downloads"`, per CLAUDE.md); `whisper_cache_dir` defaults to `~/.cache/whisper` unless the codebase overrides it (the plan flags this); `mpv_path` → `shutil.which("mpv")` (which is exactly the "falls back to PATH" the field's old placeholder described); `js_runtime_path` stays `""` (the detected runtime is surfaced elsewhere). If any of these turns out wrong, it only affects the *placeholder text* (and 4b's `↺` target for that field) — not save/load behaviour, so the blast radius is small.
