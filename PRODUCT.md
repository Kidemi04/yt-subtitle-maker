# Product

## Register

product

## Users

People who want to watch videos in a language they do not speak. A typical user finds a YouTube video they want to understand (a lecture, a documentary, a creator they discovered), pastes the URL, and wants subtitles in their own language. They are not creators publishing captions, not professional translators, not engineers debugging an ML pipeline. They are curious viewers, often watching at night, on a personal machine, with the lights low.

The app must feel like a tool a viewer reaches for, not a workshop a producer sits inside.

## Product Purpose

`yt-subtitle-maker` is a privacy-first desktop application that turns any YouTube video into a watchable, translated experience on the user's own machine. It downloads the audio, transcribes it locally with Whisper, optionally translates the result with Gemini (or a local LLM), and plays the video back with embedded subtitles via MPV.

Success looks like: paste URL, pick a language, watch the video. Everything in between (model picker, engine choice, cookie source, run history) exists for users who care, but never blocks the user who just wants to watch.

The handoff specs in `docs/superpowers/design-handoff/README.md` define the visual target. The job of design work in this repo is to land those specs faithfully in Tamagui, then keep the language consistent as new surfaces are added.

## Brand Personality

Cinematic, editorial, and quietly confident. The closest analogy is a private screening room: dark walls, a single warm light, a serif title card before the picture rolls. Fraunces headlines do most of the personality work; Inter does the operating work; JetBrains Mono surfaces the technical layer when (and only when) a user asks for it.

Three-word personality: **calm, attentive, refined**.

Voice and tone:
- Speaks to viewers, not to operators ("What are we transcribing today?", not "Submit URL")
- Names technical objects without apologising for them (Whisper, Gemini, MPV stay as themselves)
- Never cute, never enthusiastic, never urgent

## Anti-references

This product must never read as any of the following:

1. **Generic SaaS dashboard.** No hero-metric templates, no identical-card grids, no gradient-on-text headlines, no Linear-clone sidebars decorated with badges. The app has one accent and a serif voice; it should not look interchangeable with a B2B startup landing.
2. **Crypto / AI-startup neon.** No cyan-on-black, no glowing edges, no sci-fi grid backgrounds, no "this is an AI tool, therefore neon" reflex. Whisper and Gemini are tools the app uses, not products it markets.
3. **Heavy enterprise software.** No dense checkbox forms, no native OS chrome leaking through, no beige FFmpeg-GUI energy. Settings are deep but the surface stays composed.
4. **Toy / playful consumer app.** No rainbow gradients, no oversized rounded cartoon shapes, no Duolingo / Notion-doodle warmth. This is an adult tool for quiet evenings, not a learning game.

When in doubt, lean toward the screening-room reference and away from all four.

## Design Principles

1. **The viewer is the customer.** Every decision (copy, default, ordering, animation) should serve the person who just wants to understand the video. Power-user controls are reachable, never primary.
2. **Earn every serif moment.** Fraunces is the brand's loudest voice. Use it for screen titles and hero moments; never for body text, buttons, table cells, or filler. If a Fraunces line is not doing emotional work, it should be Inter.
3. **One accent, used sparingly.** Sunset orange `#fb923c` is locked and carries meaning (active, selected, primary action, progress). When everything is accented, nothing is. Restraint defines the register.
4. **Local-first, calmly stated.** Privacy and offline operation are core values, not features to brag about. Mention them once, in plain language; don't decorate them with shields, badges, or marketing.
5. **Refuse the four reflexes.** Whenever a design feels generic, run it against the four anti-references above. If it would fit comfortably into any of them, redesign.

## Accessibility & Inclusion

Floor: **WCAG 2.1 AA on text and UI components.**

- Visible focus rings on every interactive element. Glass surfaces require a focus treatment that survives the blur (a 2px accent ring + accent-soft glow, per the handoff).
- Full keyboard navigation across all screens. No mouse-only affordances.
- No information conveyed by color alone. Status dots always pair with a label or icon; success/warning/error always pair with text.
- Animations respect `prefers-reduced-motion` where the harness allows. Decorative animations (shimmer sweep on the hero card, processing waveform) drop to static or low-amplitude alternatives.
- Type sizes follow the handoff scale; do not shrink body below 13px Inter.
- All monospace timestamps and numbers use tabular figures (`font-feature-settings: 'tnum'`) so columns align.

The app is single-language UI today (English), but copy should be written so it can be localised later: short, literal, free of idioms.
