# STT Engine Simplification Design

## Goal

Make transcription settings robust, reliable, and practical by showing users a small set of real choices, while wiring the backend only to engines that can be made dependable now.

## Decisions

- Default source is local Whisper transcription.
- YouTube captions are used only when the user explicitly chooses them.
- Implement and expose:
  - `openai-whisper` as **Standard Whisper**.
  - `faster-whisper` as **Faster Whisper**.
  - `mlx-whisper` as **MLX Whisper** on macOS Apple Silicon only.
- Keep `insanely-fast-whisper` as a placeholder or advanced roadmap item for now.
- Keep remaining engines (`whisperx`, `whisper-cpp`, `stable-ts`) as placeholders only.

## User-Facing Model

Users should see two separate concepts:

- **Engine** means how Whisper runs.
- **Model** means the size, quality, and speed variety.

### Engine Choices

| UI label | Internal engine | Availability | User explanation |
|---|---|---|---|
| Standard Whisper | `openai-whisper` | Available | Reliable default. Works locally on CPU. |
| Faster Whisper | `faster-whisper` | Add-on | Faster and lighter. Best for CPU or NVIDIA CUDA machines. |
| MLX Whisper | `mlx-whisper` | Add-on, macOS arm64 only | Fast local transcription for Apple Silicon Macs. |
| Insanely Fast Whisper | `insanely-fast-whisper` | Placeholder | High-throughput experimental route. Not enabled until integration is dependable. |

### Model Choices

Keep all current model varieties visible, with size and one short benefit:

| Model | Approx size | User explanation |
|---|---:|---|
| Tiny | 75 MB | Fastest. Good for quick tests. |
| Base | 145 MB | Very quick. Better than Tiny. |
| Small | 484 MB | Light daily option. CPU friendly. |
| Medium | 1.5 GB | More accurate. Slower on CPU. |
| Turbo | 1.6 GB | Recommended default. Strong speed and quality balance. |
| Large v3 | 3.0 GB | Best quality. Slowest and largest. |

## Backend Design

Add real STT providers for:

- `FasterWhisperProvider`
- `MlxWhisperProvider`

Do not add a runnable `InsanelyFastWhisperProvider` yet. Keep it in the engine catalog as placeholder metadata only.

Provider behavior must match `TranscriptionProvider`:

- `name`
- `needs_audio = True`
- `is_available()`
- `transcribe(audio_path, url, language, progress)`

The pipeline should continue using `_select_stt_provider()` and `core.stt.get_provider()` so new engines are selected through the existing registry.

## Model Storage And Downloads

`openai-whisper` keeps using the current OpenAI Whisper model cache.

`faster-whisper` and `mlx-whisper` should have separate engine-aware model state because they use different runtime formats or Hugging Face repositories. Do not pretend the OpenAI Whisper `.pt` checkpoint satisfies these engines.

`/api/dependencies` and `/api/dependencies/install` should support an `engine` parameter for the implemented engines:

- model installed state is per engine
- download progress streams percentage, downloaded bytes, total bytes, and speed when available
- unsupported engine/platform combinations return a clear soft error

## UI Design

Settings -> Transcription should be simplified:

- Source:
  - Local transcription
  - YouTube captions
- Engine:
  - show only available or installable supported engines
  - show placeholders separately as planned, not selectable
- Model:
  - show all six varieties
  - show size, short explanation, downloaded state, and download button
  - show a progress bar while downloading

Generate should default to local transcription and use the selected engine/model from Settings unless the user changes the job override.

## Platform Rules

- `mlx-whisper` is only offered on macOS arm64.
- `faster-whisper` can be offered on CPU-capable platforms, with NVIDIA CUDA messaging only when CUDA is detected.
- AMD/ROCm is not exposed as a runnable option yet.
- `insanely-fast-whisper` remains a placeholder because it is heavier, more CLI/Transformers oriented, and has more platform/runtime risk.

## Error Handling

- If an engine package is missing, the UI shows install action before selection.
- If a model is missing, Generate must prevent the run and point the user to download it.
- If a platform is unsupported, the engine appears as unavailable with a short reason.
- If an adapter import fails, backend reports an actionable error rather than falling back silently to another engine.

## Testing

Backend:

- provider registry returns `openai-whisper`, `faster-whisper`, `mlx-whisper`, and `yt_captions`
- provider adapters convert engine-specific segments into `TranscriptionSegment`
- unsupported platform rules for `mlx-whisper`
- dependency endpoints report per-engine model state
- pipeline dispatches to selected engine

Frontend:

- default source is local transcription, not Auto/YouTube-first
- engine list hides runnable placeholders from normal selection
- model rows show size, description, installed state, and progress
- Generate blocks local runs when the selected model is missing

## References

- `faster-whisper` exposes a Python `WhisperModel(...).transcribe(...)` API and downloads CTranslate2 models by size or Hugging Face model name.
- `mlx-whisper` exposes `mlx_whisper.transcribe(...)` with `path_or_hf_repo` for MLX-format models.
- `insanely-fast-whisper` is primarily an opinionated CLI and Transformers pipeline route, so it stays planned until it can be integrated without weakening reliability.
