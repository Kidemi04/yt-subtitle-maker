# yt-subtitle-maker

A privacy-first desktop tool that downloads YouTube audio, transcribes it locally with Whisper, and (optionally) translates the result with Gemini. The frontend is Tauri + Expo Router + Tamagui; the backend is a local Python HTTP API. See `README.md` for setup.

## Design Context

The visual and strategic source of truth lives in three files. Read them before any design or UI work.

- **`PRODUCT.md`** — strategic context: register, users, brand personality, anti-references, design principles, accessibility floor. Answers *who/what/why*.
- **`DESIGN.md`** — visual system in [Stitch DESIGN.md format](https://stitch.withgoogle.com/docs/design-md/format/): colors, typography, elevation, components, do's and don'ts. Answers *how it looks*.
- **`docs/superpowers/design-handoff/README.md`** — original v2.0 high-fidelity handoff (every screen spec, token recipes, component inventory). The handoff is the visual target; `DESIGN.md` is the canonical reference DESIGN.md-aware tools consume.

If you're using the `impeccable` skill, the loader picks `PRODUCT.md` and `DESIGN.md` up automatically. For non-impeccable agents, treat these three files as required reading for any UI-touching task.

### Quick reminders (full rules live in DESIGN.md)

- The single accent is `#fb923c` (Sunset Orange). Locked. Never substituted.
- `#ffffff` is forbidden. Use `#f5f5f7` for text.
- Fraunces (serif) is for screen titles and hero moments only, weight 400.
- Glass cards do not carry drop shadows; the `backdrop-filter` blur is the elevation.
- Accent coverage on any screen caps at ≤10%.
