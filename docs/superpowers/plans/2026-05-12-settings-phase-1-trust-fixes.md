# Settings Tab — Phase 1: Trust & Correctness Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the things in the Settings screen that mislead or lie — fake STT engine options, the broken "Reset to defaults" button, a wrong-platform path placeholder, the blind Whisper-model picker, and the literal `***` mask sitting in API-key inputs — without touching the screen's structure yet.

**Architecture:** Small, surgical changes in three files. One new backend endpoint (`POST /api/config/reset`) with a pytest test; one new api-client method (`resetConfig`); the rest are local edits to `apps/desktop/app/settings.tsx`. No layout restructure, no new components — that's Phase 2+.

**Tech Stack:** FastAPI + pydantic (backend), TypeScript fetch client (`packages/api-client`), Expo / React Native Web / Tamagui (`apps/desktop`).

**Spec:** `docs/superpowers/specs/2026-05-12-settings-tab-production-ready-design.md` — this plan is **Phase 1** of that spec's four-phase build. Phases 2–4 (the sub-tab IA + search; native polish — folder pickers, Subtitles live preview; the engine-driven Transcription tab, named translation providers, Hybrid autosave) each get their own plan, written later.

**Deviation from the spec's phasing:** the spec lists the `ArmedField` component + the Backend-URL safety fix under Phase 1. This plan **moves that to Phase 2**, because it's the heaviest item (a new component + a validation flow) and Phase 1 reads better as a fast, low-risk batch of quick wins. The Backend-URL field is left exactly as it is for now.

**Prerequisites on the machine:** the backend venv exists (`scripts/setup-backend.sh` already run), `pnpm install` already run, and for the manual frontend checks you can use either `pnpm dev` (the two-window dev launcher) or `pnpm web` + a separate `uvicorn` (see `CLAUDE.md`). Rust is **not** needed for any of this.

---

## File structure

| File | Change |
|---|---|
| `backend/api/routes/config.py` | Add `POST /api/config/reset` — resets to `AppConfig()` defaults, persists, returns the masked config. |
| `tests/api/test_config_route.py` | Add a test for `POST /api/config/reset`. |
| `packages/api-client/src/client.ts` | Add `async resetConfig(): Promise<AppConfig>`. |
| `apps/desktop/app/settings.tsx` | (a) wire the real Reset button to `resetConfig`; (b) trim `STT_ENGINES` to real options only; (c) drop the Windows placeholder + add a neutral helper; (d) annotate the Whisper-model dropdown with download state via `fetchDependencies()`; (e) replace the literal-`***`-in-a-secure-input with a "saved" indicator + "Replace" button. |

## Note on tests

The Python side has pytest (`pytest.ini`, `pythonpath = backend`); Task 1 is proper TDD against it. The frontend has **no JS test framework**, so the frontend tasks' "verify" step is `pnpm -F desktop typecheck` plus a concrete manual check in the running app — that's the test for those tasks. Don't invent a JS test runner.

---

### Task 1: `POST /api/config/reset` endpoint + `resetConfig()` client method

**Files:**
- Modify: `backend/api/routes/config.py`
- Test: `tests/api/test_config_route.py`
- Modify: `packages/api-client/src/client.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/api/test_config_route.py` (it already imports `TestClient` for the app and exercises `/api/config` — match its existing style; if it uses a fixture named `client`, reuse it):

```python
def test_config_reset_restores_defaults(client, tmp_path, monkeypatch):
    # Point config at a temp dir so we don't clobber the real one.
    import core.config as cfgmod
    monkeypatch.setattr(cfgmod, "config_dir", lambda: tmp_path)

    # Make the saved config non-default.
    client.post("/api/config", json={"defaultTargetLang": "fr", "geminiApiKey": "sekret"})
    assert client.get("/api/config").json()["defaultTargetLang"] == "fr"

    # Reset.
    body = client.post("/api/config/reset").json()

    from dataclasses import asdict
    defaults = asdict(cfgmod.AppConfig())
    assert body["defaultTargetLang"] == defaults["default_target_lang"]
    # Secrets are masked in the response, but a default key is empty → not masked.
    assert body["geminiApiKey"] == ""
    # And it's persisted.
    assert client.get("/api/config").json()["defaultTargetLang"] == defaults["default_target_lang"]
```

(If `test_config_route.py` doesn't yet have a `client` fixture / monkeypatched config dir, copy whatever pattern the file already uses for `POST /api/config`; the point of the test is "reset overwrites a dirtied config back to `AppConfig()` and persists it".)

- [ ] **Step 2: Run the test — confirm it fails**

Run: `backend/.venv/bin/python -m pytest tests/api/test_config_route.py -q`
Expected: FAIL — `404` from `POST /api/config/reset` (route doesn't exist yet).

- [ ] **Step 3: Add the endpoint**

In `backend/api/routes/config.py`, add a `save_config` import and a new route. The file currently imports `from core.config import load_config, save_config` — keep that. Add, after `update_config`:

```python
@router.post("/config/reset")
def reset_config() -> dict:
    """Reset every setting to AppConfig() defaults, persist, return masked config."""
    from core.config import AppConfig

    save_config(AppConfig())
    return _mask_secrets(_to_camel(asdict(load_config())))
```

- [ ] **Step 4: Run the test — confirm it passes (and nothing else broke)**

Run: `backend/.venv/bin/python -m pytest tests/api/test_config_route.py -q`
Expected: PASS.
Run: `backend/.venv/bin/python -m pytest -q`
Expected: full suite still green.

- [ ] **Step 5: Add the api-client method**

In `packages/api-client/src/client.ts`, right after `updateConfig`, add:

```typescript
  async resetConfig(): Promise<AppConfig> {
    const res = await fetch(`${this.baseUrl}/api/config/reset`, {
      method: "POST",
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`POST /api/config/reset ${res.status}`);
    return res.json();
  }
```

Run: `pnpm -F @yt-subtitle-maker/api-client typecheck 2>/dev/null || (cd packages/api-client && npx tsc --noEmit)` — Expected: no errors. (If the package has no `typecheck` script, the `tsc --noEmit` fallback covers it; `AppConfig` is already imported in this file.)

- [ ] **Step 6: Commit**

```bash
git add backend/api/routes/config.py tests/api/test_config_route.py packages/api-client/src/client.ts
git commit -m "feat(api): POST /api/config/reset — real reset-to-defaults; add resetConfig() client method"
```

---

### Task 2: Wire the real "Reset to defaults" button

Today `apps/desktop/app/settings.tsx`'s "Reset to defaults" `ButtonGhost` does `apiClient.fetchConfig().then(setDraft)` — that re-fetches the **current saved** config, it doesn't reset anything. Point it at the new endpoint and update both `config` and `draft`.

**Files:**
- Modify: `apps/desktop/app/settings.tsx`

- [ ] **Step 1: Replace the Reset button's handler**

Find this block in `settings.tsx` (inside the ADVANCED `GlassCard`):

```tsx
          <XStack>
            <ButtonGhost
              onPress={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm(
                    "Reset every setting on this page to defaults? This cannot be undone.",
                  )
                ) {
                  // Backend's default config — we re-fetch and overwrite draft.
                  apiClient.fetchConfig().then(setDraft);
                }
              }}
            >
              <BodySm fontWeight="500" color="$error">
                Reset to defaults
              </BodySm>
            </ButtonGhost>
          </XStack>
```

Replace it with:

```tsx
          <XStack>
            <ButtonGhost
              onPress={async () => {
                if (
                  typeof window !== "undefined" &&
                  !window.confirm(
                    "Reset every setting to its default? This overwrites your saved config and can't be undone.",
                  )
                ) {
                  return;
                }
                try {
                  const next = await apiClient.resetConfig();
                  setConfig(next);
                  setDraft(next);
                  apiClient.setBaseUrl(next.backendUrl);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              <BodySm fontWeight="500" color="$error">
                Reset all to defaults
              </BodySm>
            </ButtonGhost>
          </XStack>
```

(`setConfig` and `setError` are already in scope in this component; `setBaseUrl` keeps the api-client pointed at the now-default backend URL, matching what `onSave` does.)

- [ ] **Step 2: Verify**

Run: `pnpm -F desktop typecheck`
Expected: no errors.

Manual (start the backend + web UI): open Settings → Advanced → "Reset all to defaults" → confirm → the form snaps back to defaults, the footer shows "all saved", and reloading the page keeps the defaults. Then change something and Save again to confirm normal save still works.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/app/settings.tsx
git commit -m "fix(settings): 'Reset to defaults' actually resets (calls /api/config/reset)"
```

---

### Task 3: Trim the STT engine list to real options

`settings.tsx` defines `STT_ENGINES` with `faster-whisper ⭐`, `WhisperX`, `insanely-fast-whisper` — none implemented. They're filtered out *after* `/api/version` loads (`sttEngineOptions` keeps only `"auto"` + entries in `installedSttEngines`), but they flash on first render / if that fetch fails, and `yt_captions` (which *is* in `installedSttEngines`) isn't in the list at all. Replace the static list with the real choices and a clearer "no fakes ever" rule.

**Files:**
- Modify: `apps/desktop/app/settings.tsx`

- [ ] **Step 1: Replace the `STT_ENGINES` constant and the `sttEngineOptions` memo**

Replace this:

```tsx
const STT_ENGINES = [
  { label: "Auto (try YT, fall back)", value: "auto" },
  { label: "openai-whisper", value: "openai-whisper" },
  { label: "faster-whisper ⭐", value: "faster-whisper" },
  { label: "WhisperX", value: "whisperx" },
  { label: "insanely-fast-whisper", value: "insanely-fast-whisper" },
];
```

with:

```tsx
// Human labels for STT engine ids the backend may report as installed.
// Only ids that actually exist in core/stt/__init__.py's registry will ever
// appear (plus the synthetic "auto" mode). Adding a real engine later = add
// its label here; it shows up automatically once /api/version lists it.
const STT_ENGINE_LABELS: Record<string, string> = {
  auto: "Auto — use YouTube's captions if present, else Whisper",
  "openai-whisper": "openai-whisper (the reference engine)",
  yt_captions: "YouTube captions only",
};
```

Then replace the `sttEngineOptions` memo:

```tsx
  const sttEngineOptions = React.useMemo(() => {
    const installed = installedEngines;
    if (!installed) return STT_ENGINES; // not loaded yet — show all to avoid flash
    return STT_ENGINES.filter(
      (opt) => opt.value === "auto" || installed.includes(opt.value),
    );
  }, [installedEngines]);
```

with:

```tsx
  const sttEngineOptions = React.useMemo(() => {
    // "auto" is always offered; the rest is exactly what the backend reports
    // as installed — never a hardcoded/aspirational engine.
    const ids = ["auto", ...(installedEngines ?? [])];
    return ids
      .filter((id, i) => ids.indexOf(id) === i) // dedupe
      .map((id) => ({ label: STT_ENGINE_LABELS[id] ?? id, value: id }));
  }, [installedEngines]);
```

(While `installedEngines` is `undefined` the dropdown shows just `["Auto — …"]`, which then expands to `["Auto — …", "openai-whisper (…)", "YouTube captions only"]` once `/api/version` resolves. No fake options, ever.)

- [ ] **Step 2: Verify**

Run: `pnpm -F desktop typecheck`
Expected: no errors.

Manual: open Settings → STT Engine → the "Default engine" dropdown lists only `Auto …`, `openai-whisper …`, `YouTube captions only` — no `faster-whisper ⭐`, no `WhisperX`, no `insanely-fast-whisper`. (If the saved `defaultSttEngine` is one of the old fake values from a hand-edited config, the dropdown will just render that raw value as a one-off — acceptable; the engine-driven Transcription tab in a later phase handles legacy values properly.)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/app/settings.tsx
git commit -m "fix(settings): STT engine dropdown lists only real engines (no faster-whisper/whisperx/insanely-fast stubs)"
```

---

### Task 4: Remove the wrong-platform path placeholder

`settings.tsx` puts `placeholder="C:\\Users\\you\\Downloads"` on the "Download folder" field — Windows path, macOS app. Drop it; use an empty placeholder and a one-line helper saying blank = default. (Showing the *real resolved* default path is a Phase 4 item — it needs the backend to expose effective paths; not in scope here.)

**Files:**
- Modify: `apps/desktop/app/settings.tsx`

- [ ] **Step 1: Fix the field**

In the GENERAL `GlassCard`, replace:

```tsx
          <YStack gap="$xs">
            <Field label="Download folder" />
            <TextInput
              value={draft.downloadDir}
              onChangeText={(v: string) => update("downloadDir", v)}
              placeholder="C:\\Users\\you\\Downloads"
            />
          </YStack>
```

with:

```tsx
          <YStack gap="$xs">
            <Field
              label="Download folder"
              helper="Where downloaded audio is kept. Leave blank to use the default location."
            />
            <TextInput
              value={draft.downloadDir}
              onChangeText={(v: string) => update("downloadDir", v)}
              placeholder=""
            />
          </YStack>
```

Also check the ADVANCED card's "Output folder" / "Whisper cache directory" / "MPV executable path" fields — if any has a Windows-style placeholder, give it the same treatment (blank placeholder; a "Leave blank for the default" helper for the dir fields). The "MPV executable path" already uses `placeholder="(falls back to PATH)"` — that one's fine, leave it.

- [ ] **Step 2: Verify**

Run: `pnpm -F desktop typecheck`
Expected: no errors.
Manual: open Settings → General → "Download folder" has no `C:\…` ghost text and shows the new helper line.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/app/settings.tsx
git commit -m "fix(settings): drop the Windows-path placeholder on a macOS app"
```

---

### Task 5: Whisper-model dropdown shows download state

The "Default model" dropdown offers all six models with no hint that five of them aren't downloaded. Fetch `apiClient.fetchDependencies()` on mount and annotate the labels: downloaded → `✓`, not → `· not downloaded`.

**Files:**
- Modify: `apps/desktop/app/settings.tsx`

- [ ] **Step 1: Import the type and fetch the status**

Add `DependencyStatus` to the `@yt-subtitle-maker/api-client` import (it's an existing exported type in `packages/api-client/src/types.ts`):

```tsx
import {
  ApiClient,
  type AppConfig,
  type TranslatorProvider,
  type DependencyStatus,
} from "@yt-subtitle-maker/api-client";
```

Add state near the other `useState`s:

```tsx
  const [deps, setDeps] = React.useState<DependencyStatus | undefined>();
```

Inside the existing `useEffect` (the one that already does `fetchConfig` / `fetchVersion` / `listTranslatorModels`), add another fetch alongside them:

```tsx
    apiClient
      .fetchDependencies()
      .then((d) => !cancelled && setDeps(d))
      .catch(() => undefined);
```

- [ ] **Step 2: Derive labelled model options**

Replace the static `WHISPER_MODELS` usage in the "Default model" `Dropdown`. First, just below the `sttEngineOptions` memo, add:

```tsx
  // base id list — keep this in sync with the backend's MODELS_URLS keys.
  const WHISPER_MODEL_IDS = ["tiny", "base", "small", "medium", "turbo", "large-v3"];

  const whisperModelOptions = React.useMemo(() => {
    const downloaded = deps?.models ?? {};
    const ids = WHISPER_MODEL_IDS.includes(draft.defaultWhisperModel)
      ? WHISPER_MODEL_IDS
      : [draft.defaultWhisperModel, ...WHISPER_MODEL_IDS];
    return ids.map((id) => {
      const star = id === "turbo" ? " ⭐" : "";
      let suffix = "";
      if (deps) suffix = downloaded[id] ? "  ✓ downloaded" : "  · not downloaded";
      return { label: `${id}${star}${suffix}`, value: id };
    });
  }, [deps, draft.defaultWhisperModel]);
```

Then change the "Default model" `Dropdown` to use it:

```tsx
              <Dropdown
                value={draft.defaultWhisperModel}
                onValueChange={(v) => update("defaultWhisperModel", v)}
                options={whisperModelOptions}
                width="100%"
              />
```

(Leave the top-level `WHISPER_MODELS` const in place if anything else references it; if nothing else does, you can delete it — search the file. Don't add an in-Settings "Download" action here; the Init screen already handles downloading, and the engine-driven Transcription tab in a later phase folds that in.)

- [ ] **Step 3: Verify**

Run: `pnpm -F desktop typecheck`
Expected: no errors.
Manual: open Settings → STT Engine → "Default model" — the model you've actually downloaded shows `✓ downloaded`; the others show `· not downloaded`. (Before `/api/dependencies` resolves, labels show without a suffix — fine.)

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/app/settings.tsx
git commit -m "feat(settings): Whisper model dropdown shows which models are downloaded"
```

---

### Task 6: API-key fields — show `•••• (saved)` + a "Replace" button instead of the literal mask

`GET /api/config` masks secrets to the string `"***"`; today that string is put straight into a `secureTextEntry` input, so the field literally contains `***` (rendered as dots). Editing it is confusing (you're editing the string `"***"`), and it's not obvious a key is even on file. The backend already does the right thing — `POST /api/translator/test` and `POST /api/config` both treat `"***"` as "keep the saved value" — so this is a pure UI fix: when the draft key is the mask sentinel, show a read-only "saved" indicator + a "Replace" button that, when pressed, clears the field to empty so you can type a new key (which then saves normally and un-masks the test path because a real value is sent).

**Files:**
- Modify: `apps/desktop/app/settings.tsx`

- [ ] **Step 1: Add a tiny helper + per-field "replacing" state**

Near the top of `settings.tsx` (module scope), add:

```tsx
const MASK = "***";
const isMasked = (v: string | undefined): boolean => v === MASK;
```

In the component, add state for which secret fields are being replaced:

```tsx
  const [replacingKey, setReplacingKey] = React.useState<
    Record<"gemini" | "openai" | "localOpenai", boolean>
  >({ gemini: false, openai: false, localOpenai: false });
```

- [ ] **Step 2: Replace the Gemini API-key field**

Find the Gemini key block (inside the `draft.translatorProvider === "gemini"` branch):

```tsx
              <YStack gap="$xs">
                <Field label="Gemini API key" />
                <XStack gap="$sm" alignItems="center">
                  <XStack flex={1} alignItems="center" position="relative">
                    <TextInput
                      flex={1}
                      value={draft.geminiApiKey}
                      onChangeText={(v: string) => update("geminiApiKey", v)}
                      secureTextEntry={!showApiKey}
                      placeholder="AIza..."
                    />
                    <Stack position="absolute" right={8}>
                      <IconButton
                        icon={
                          showApiKey ? (
                            <EyeOff size={14} color="$textSecondary" />
                          ) : (
                            <Eye size={14} color="$textSecondary" />
                          )
                        }
                        aria-label="Toggle API key visibility"
                        size={32}
                        onPress={() => setShowApiKey((v) => !v)}
                      />
                    </Stack>
                  </XStack>
                  <ButtonSecondary onPress={testTranslator}>Test</ButtonSecondary>
                  <StatusDot status={translatorStatus} size={8} />
                </XStack>
              </YStack>
```

Replace with:

```tsx
              <YStack gap="$xs">
                <Field label="Gemini API key" />
                {isMasked(draft.geminiApiKey) && !replacingKey.gemini ? (
                  <XStack gap="$sm" alignItems="center">
                    <Stack
                      flex={1}
                      padding="$sm"
                      borderRadius="$md"
                      backgroundColor="$surfaceGlass"
                      borderWidth={1}
                      borderColor="$borderSubtle"
                    >
                      <BodySm color="$textSecondary">•••• key on file</BodySm>
                    </Stack>
                    <ButtonGhost
                      onPress={() => {
                        update("geminiApiKey", "");
                        setReplacingKey((r) => ({ ...r, gemini: true }));
                      }}
                    >
                      Replace
                    </ButtonGhost>
                    <ButtonSecondary onPress={testTranslator}>Test</ButtonSecondary>
                    <StatusDot status={translatorStatus} size={8} />
                  </XStack>
                ) : (
                  <XStack gap="$sm" alignItems="center">
                    <XStack flex={1} alignItems="center" position="relative">
                      <TextInput
                        flex={1}
                        value={draft.geminiApiKey}
                        onChangeText={(v: string) => update("geminiApiKey", v)}
                        secureTextEntry={!showApiKey}
                        placeholder="AIza..."
                      />
                      <Stack position="absolute" right={8}>
                        <IconButton
                          icon={
                            showApiKey ? (
                              <EyeOff size={14} color="$textSecondary" />
                            ) : (
                              <Eye size={14} color="$textSecondary" />
                            )
                          }
                          aria-label="Toggle API key visibility"
                          size={32}
                          onPress={() => setShowApiKey((v) => !v)}
                        />
                      </Stack>
                    </XStack>
                    <ButtonSecondary onPress={testTranslator}>Test</ButtonSecondary>
                    <StatusDot status={translatorStatus} size={8} />
                  </XStack>
                )}
              </YStack>
```

- [ ] **Step 3: Apply the same pattern to the OpenAI-compat key field**

Find the OpenAI key block (inside `draft.translatorProvider === "openai"`):

```tsx
              <YStack gap="$xs">
                <Field label="API key" />
                <XStack gap="$sm" alignItems="center">
                  <TextInput
                    flex={1}
                    value={draft.openaiApiKey}
                    onChangeText={(v: string) => update("openaiApiKey", v)}
                    secureTextEntry={!showApiKey}
                  />
                  <ButtonSecondary onPress={testTranslator}>Test</ButtonSecondary>
                  <StatusDot status={translatorStatus} size={8} />
                </XStack>
              </YStack>
```

Replace with:

```tsx
              <YStack gap="$xs">
                <Field label="API key" />
                {isMasked(draft.openaiApiKey) && !replacingKey.openai ? (
                  <XStack gap="$sm" alignItems="center">
                    <Stack
                      flex={1}
                      padding="$sm"
                      borderRadius="$md"
                      backgroundColor="$surfaceGlass"
                      borderWidth={1}
                      borderColor="$borderSubtle"
                    >
                      <BodySm color="$textSecondary">•••• key on file</BodySm>
                    </Stack>
                    <ButtonGhost
                      onPress={() => {
                        update("openaiApiKey", "");
                        setReplacingKey((r) => ({ ...r, openai: true }));
                      }}
                    >
                      Replace
                    </ButtonGhost>
                    <ButtonSecondary onPress={testTranslator}>Test</ButtonSecondary>
                    <StatusDot status={translatorStatus} size={8} />
                  </XStack>
                ) : (
                  <XStack gap="$sm" alignItems="center">
                    <TextInput
                      flex={1}
                      value={draft.openaiApiKey}
                      onChangeText={(v: string) => update("openaiApiKey", v)}
                      secureTextEntry={!showApiKey}
                    />
                    <ButtonSecondary onPress={testTranslator}>Test</ButtonSecondary>
                    <StatusDot status={translatorStatus} size={8} />
                  </XStack>
                )}
              </YStack>
```

(The Local-AI "API key (optional)" field is a plain `TextInput` with placeholder `"lm-studio"` and isn't secret-masked the same way — leave it as is. If you find it also receives `"***"` from the GET, give it the same `isMasked(...) && !replacingKey.localOpenai` treatment using the `localOpenai` slot of `replacingKey`; otherwise skip it.)

- [ ] **Step 4: Verify**

Run: `pnpm -F desktop typecheck`
Expected: no errors.
Manual: with a Gemini key already saved → open Settings → the key field reads "•••• key on file" with a "Replace" button (not a box of literal dots you can edit). Click "Test" → it still works (backend uses the saved key). Click "Replace" → the field becomes an empty editable input → type a new key → Save → reload → "•••• key on file" again. Repeat for the OpenAI-compat provider.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/app/settings.tsx
git commit -m "fix(settings): show '•••• key on file' + Replace instead of the literal *** mask in API-key inputs"
```

---

## Self-review (done by plan author)

- **Spec coverage (Phase 1 slice):** fake STT engines → Task 3 ✓; real "Reset to defaults" → Tasks 1+2 ✓; wrong-platform placeholder → Task 4 ✓; blind Whisper-model picker → Task 5 ✓; masked-key/Test UX → Task 6 ✓. The spec's Phase-1 `ArmedField`/Backend-URL item is **intentionally deferred to Phase 2** (stated in the header). Everything else in the spec is Phase 2–4 and out of scope for this plan.
- **Placeholder scan:** none — every step has the literal code/command. The "if `test_config_route.py` doesn't have a `client` fixture, copy its existing pattern" note is concrete guidance about an existing-file convention, not deferred work. The "check the other Advanced path fields for Windows placeholders" in Task 4 is a real review action, not a TODO.
- **Type/name consistency:** `resetConfig` used in api-client (Task 1) and `settings.tsx` (Task 2) — matches. `DependencyStatus` (Task 5) is an existing exported type. `MASK = "***"` / `isMasked` (Task 6) match the backend's mask sentinel in `backend/api/routes/config.py` (`MASK = "***"`). `replacingKey` keys `gemini`/`openai`/`localOpenai` are used consistently. `WHISPER_MODEL_IDS` ordering matches the backend's `MODELS_URLS` keys (tiny, base, small, medium, turbo, large-v3).
