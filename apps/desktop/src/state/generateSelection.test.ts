import { describe, expect, it } from "vitest";
import type { AppConfig } from "@yt-subtitle-maker/api-client";
import {
  FALLBACK_SELECTION,
  defaultTranslatorFromConfig,
  deriveSourceModeFromConfig,
  isTranslatorProviderAvailable,
  mergeGenerateSelection,
  selectionDefaultsFromConfig,
} from "./generateSelection";

/** Minimal AppConfig — only the fields the selection layer reads. */
function config(over: Partial<AppConfig> = {}): AppConfig {
  return {
    defaultSttEngine: "openai-whisper",
    ytCaptionsFirst: false,
    defaultWhisperModel: "turbo",
    defaultWhisperDevice: "auto",
    defaultSourceLang: "ja",
    defaultTargetLang: "zh-CN",
    enableTranslation: true,
    vadEnabled: true,
    activeTranslator: "gemini",
    translatorProvider: "gemini",
    customTranslators: [],
    ...over,
  } as unknown as AppConfig;
}

describe("selectionDefaultsFromConfig", () => {
  it("derives the Generate screen's defaults from saved Settings", () => {
    const d = selectionDefaultsFromConfig(config());
    expect(d.sourceLang).toBe("ja");
    expect(d.targetLang).toBe("zh-CN");
    expect(d.enableTranslation).toBe(true);
    expect(d.whisperModel).toBe("turbo");
    expect(d.translatorProvider).toBe("gemini");
  });

  it("falls back cleanly when there is no config yet", () => {
    const d = selectionDefaultsFromConfig(undefined);
    expect(d).toEqual(FALLBACK_SELECTION);
  });

  it("defaults source language to auto rather than guessing a language", () => {
    // Whisper forced to a wrong language emits confident nonsense instead of
    // an error, so detection is the safe default when nothing is configured.
    expect(FALLBACK_SELECTION.sourceLang).toBe("auto");
  });

  it("does not carry over an engine that isn't installed", () => {
    const d = selectionDefaultsFromConfig(config({ defaultSttEngine: "mlx-whisper" }), {
      installedEngines: ["openai-whisper", "yt_captions"],
    });
    expect(d.sttEngine).toBe("openai-whisper");
  });

  it("keeps a configured engine that is installed", () => {
    const d = selectionDefaultsFromConfig(config({ defaultSttEngine: "mlx-whisper" }), {
      installedEngines: ["openai-whisper", "mlx-whisper"],
    });
    expect(d.sttEngine).toBe("mlx-whisper");
  });

  it("leaves VAD off while no engine exposes it", () => {
    // Both sides are deliberately gated: TranscriptionTab hard-codes
    // vadSupported = false and disables the toggle. If an engine ever grows
    // real VAD, this expectation is the reminder to pass vadSupported through.
    expect(selectionDefaultsFromConfig(config({ vadEnabled: true })).vadEnabled).toBe(false);
    expect(
      selectionDefaultsFromConfig(config({ vadEnabled: true }), { vadSupported: true })
        .vadEnabled,
    ).toBe(true);
  });
});

describe("deriveSourceModeFromConfig", () => {
  it("maps the two config fields onto the three-way mode control", () => {
    expect(deriveSourceModeFromConfig(config({ defaultSttEngine: "yt_captions" }))).toBe(
      "yt_captions",
    );
    expect(deriveSourceModeFromConfig(config({ ytCaptionsFirst: true }))).toBe("auto");
    expect(deriveSourceModeFromConfig(config({ ytCaptionsFirst: false }))).toBe("whisper");
  });
});

describe("mergeGenerateSelection", () => {
  const defaults = selectionDefaultsFromConfig(config());

  it("follows Settings for every field the user hasn't touched", () => {
    expect(mergeGenerateSelection(defaults, {}, {})).toEqual(defaults);
  });

  it("uses the per-job value once a field is marked dirty", () => {
    const merged = mergeGenerateSelection(defaults, { sourceLang: "ko" }, { sourceLang: true });
    expect(merged.sourceLang).toBe("ko");
  });

  it("ignores an override that was never marked dirty", () => {
    const merged = mergeGenerateSelection(defaults, { sourceLang: "ko" }, {});
    expect(merged.sourceLang).toBe("ja");
  });

  it("keeps untouched fields tracking Settings while one field is overridden", () => {
    // Per-field, not all-or-nothing: overriding the source language must not
    // freeze the target language at whatever it was when you touched it.
    const settingsChanged = selectionDefaultsFromConfig(
      config({ defaultTargetLang: "en", defaultSourceLang: "ja" }),
    );
    const merged = mergeGenerateSelection(
      settingsChanged,
      { sourceLang: "ko" },
      { sourceLang: true },
    );
    expect(merged.sourceLang).toBe("ko"); // overridden
    expect(merged.targetLang).toBe("en"); // still following Settings
  });
});

describe("isTranslatorProviderAvailable", () => {
  it("accepts the built-ins", () => {
    for (const p of ["gemini", "local_openai", "openai"]) {
      expect(isTranslatorProviderAvailable(p, config())).toBe(true);
    }
  });

  it("accepts a custom profile that still exists", () => {
    const cfg = config({ customTranslators: [{ id: "abc", name: "DeepSeek" }] as never });
    expect(isTranslatorProviderAvailable("custom:abc", cfg)).toBe(true);
  });

  it("rejects a custom profile that has been deleted", () => {
    expect(isTranslatorProviderAvailable("custom:gone", config())).toBe(false);
  });
});

describe("defaultTranslatorFromConfig", () => {
  it("prefers activeTranslator over the legacy translatorProvider field", () => {
    expect(
      defaultTranslatorFromConfig(
        config({ activeTranslator: "custom:x", translatorProvider: "gemini" }),
      ),
    ).toBe("custom:x");
  });
});
