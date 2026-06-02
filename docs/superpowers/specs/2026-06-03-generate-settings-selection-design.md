# Generate Settings Selection Design

## Goal

Make the Generate page practical, robust, and reliable by letting it follow Settings defaults until the user changes a field for the current job. Settings remains the owner of persistent defaults. Generate owns only per-job overrides.

## Current Findings

- Settings already stores persistent defaults in `AppConfig`, exposed through `SettingsContext.draft`.
- Generate currently hardcodes several defaults in local `useState`: source mode, source language, translation enabled, target language, STT engine, Whisper model, and device.
- Generate already seeds `translatorProvider` from `activeTranslator`, but only once. It does not continue following Settings while untouched.
- Settings has source-mode mapping logic in `SourceModeControl`: `defaultSttEngine + ytCaptionsFirst` becomes `auto`, `whisper`, or `yt_captions`.
- Backend translation dispatch uses `active_translator` for actual provider selection, but some translation-run metadata still falls back to legacy `translator_provider`.

## Recommended Approach

Use a per-field dirty overlay:

```ts
effectiveValue = dirty[field] ? overrides[field] : defaults[field]
```

Each Generate selection field follows Settings defaults until that exact field is edited on Generate. Editing one field must not detach unrelated fields.

## Selection Fields

Generate should manage these job fields through the overlay:

- `sttSource`
- `sttEngine`
- `whisperModel`
- `whisperDevice`
- `vadEnabled`
- `sourceLang`
- `enableTranslation`
- `targetLang`
- `translatorProvider`
- `downloadOnly`

`downloadOnly` is local to Generate and should default to `false`; it does not come from Settings.

## Defaults Derivation

Create a shared helper, for example `selectionDefaultsFromConfig(config, installedEngines, engines)`, that derives Generate defaults from Settings:

- `sttSource`
  - `defaultSttEngine === "yt_captions"` -> `"yt_captions"`
  - else `ytCaptionsFirst === true` -> `"auto"`
  - else -> `"whisper"`
- `sttEngine`
  - use `defaultSttEngine` when it is not `"yt_captions"`
  - otherwise use the last known usable Whisper engine, falling back to `"openai-whisper"`
  - if the saved engine is unavailable, use the first installed engine
- `whisperModel` -> `defaultWhisperModel`, unless unavailable and at least one installed model exists
- `whisperDevice` -> `defaultWhisperDevice`
- `vadEnabled` -> `vadEnabled`, but current UI may keep it disabled until engine support exists
- `sourceLang` -> `defaultSourceLang`
- `enableTranslation` -> `enableTranslation`
- `targetLang` -> `defaultTargetLang`
- `translatorProvider` -> `activeTranslator ?? translatorProvider ?? "gemini"`
- `downloadOnly` -> `false`

The source-mode derivation should be extracted from `SourceModeControl` into a shared helper so Settings and Generate cannot drift.

## Generate State Model

Generate should store only overrides and dirty markers:

```ts
type GenerateSelectionOverrides = Partial<GenerateSelectionFields>;
type GenerateSelectionDirty = Partial<Record<keyof GenerateSelectionFields, boolean>>;
```

Selection reads should come from a computed `selection` object:

```ts
const selection = mergeDefaultsWithOverrides(defaults, overrides, dirty);

function setJobField<K extends keyof GenerateSelectionFields>(
  key: K,
  value: GenerateSelectionFields[K],
) {
  setOverrides((next) => ({ ...next, [key]: value }));
  setDirty((next) => ({ ...next, [key]: true }));
}
```

Do not mirror every Settings field into Generate state through effects. Prefer calculating the effective selection during render from Settings defaults plus overrides.

## User-Facing Behavior

- Opening Generate should show the current Settings defaults.
- If Settings changes while Generate is open, untouched Generate fields update automatically.
- If the user changes `targetLang` on Generate, later Settings target-language changes should not override this job's target language.
- If the user changes `translatorProvider` on Generate, only provider selection becomes job-local. Other untouched fields continue following Settings.
- Starting a new transcription through the existing reset/new-job path should clear job-local overrides and dirty markers so the next job starts from Settings defaults again.
- A small "using Settings defaults" or "custom for this job" affordance can be added later, but the first implementation can keep the UI unchanged.

## Submit Payload Rules

When running the pipeline, build the `ProcessRequest` from effective selection:

- Always send concrete values required by the backend schema.
- `sttEngine` should be omitted only when `sttSource === "yt_captions"`.
- `enableTranslation` should be `false` when `downloadOnly` is true.
- `targetLang` should be omitted when translation is disabled or download-only is true.
- `translatorProvider` should be sent when translation is enabled, using the effective provider.

The backend should continue treating per-job values as authoritative, with config as fallback only for omitted fields.

## Backend Reliability Fix

Backend translation metadata should record the same provider that was actually used:

- If the request has `translatorProvider`, use it.
- Otherwise use `cfg.active_translator`.
- Fall back to legacy `cfg.translator_provider` only for compatibility if `active_translator` is missing or empty.

This same resolved provider should be used for `translate_id`, sidecar metadata, and final done event fields. For custom profiles, the model should resolve from the matching custom profile rather than becoming `"unknown"` when no `translatorModel` override is provided.

## Error Handling

- If Settings has not loaded yet, Generate can render safe built-in defaults, then automatically adopt Settings values for non-dirty fields once available.
- If an installed model list arrives after render and the effective model is unavailable, only replace it if `whisperModel` is not dirty.
- If the selected translator profile disappears from Settings and the Generate field is not dirty, fall back to the new active translator. If it is dirty, show an inline warning and prevent submit until the user chooses an available provider.
- Save failures in Settings should not erase Generate overrides. Generate should follow the current `draft` view because that is what the user sees, but failed Settings saves remain surfaced by Settings.

## Testing

Frontend tests or focused component/hook tests should cover:

- Defaults are derived from `AppConfig`.
- Untouched fields follow Settings changes.
- Dirty fields do not follow Settings changes.
- Editing one field does not dirty unrelated fields.
- Source-mode mapping stays consistent with Settings.
- Submit payload omits `sttEngine`, `targetLang`, and `translatorProvider` in the correct disabled modes.

Backend tests should cover:

- No-override translation records `active_translator`.
- Custom active translator records provider and model accurately.
- Per-job translator override still wins.
- Legacy `translator_provider` fallback remains supported.

## Out of Scope

- Persisting Generate per-job overrides across app restarts.
- Changing Settings from Generate.
- Adding new STT engines or translator providers.
- Redesigning the Generate layout.
