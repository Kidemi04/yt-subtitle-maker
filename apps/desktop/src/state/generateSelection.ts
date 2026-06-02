import type * as React from "react";
import type {
  AppConfig,
  DependencyStatus,
  EngineDescriptor,
  SttEngine,
  SttSource,
  WhisperDevice,
  WhisperModel,
} from "@yt-subtitle-maker/api-client";

export type GenerateSelectionFields = {
  sttSource: SttSource;
  sttEngine: SttEngine;
  whisperModel: WhisperModel;
  whisperDevice: WhisperDevice;
  vadEnabled: boolean;
  sourceLang: string;
  enableTranslation: boolean;
  targetLang: string;
  translatorProvider: string;
  downloadOnly: boolean;
};

export type GenerateSelectionOverrides = Partial<GenerateSelectionFields>;
export type GenerateSelectionDirty = Partial<Record<keyof GenerateSelectionFields, boolean>>;

const BUILTIN_TRANSLATORS = ["gemini", "local_openai", "openai"] as const;

function isBuiltinTranslator(provider: string): boolean {
  return (BUILTIN_TRANSLATORS as readonly string[]).includes(provider);
}

export const FALLBACK_SELECTION: GenerateSelectionFields = {
  sttSource: "whisper",
  sttEngine: "openai-whisper",
  whisperModel: "turbo",
  whisperDevice: "auto",
  vadEnabled: false,
  sourceLang: "en",
  enableTranslation: false,
  targetLang: "zh-CN",
  translatorProvider: "gemini",
  downloadOnly: false,
};

export function deriveSourceModeFromConfig(
  config: Pick<AppConfig, "defaultSttEngine" | "ytCaptionsFirst"> | undefined,
): SttSource {
  if (!config) return FALLBACK_SELECTION.sttSource;
  if (config.defaultSttEngine === "yt_captions") return "yt_captions";
  return config.ytCaptionsFirst ? "auto" : "whisper";
}

function firstInstalledWhisperModel(deps: DependencyStatus | undefined): WhisperModel | undefined {
  const models = deps?.models ?? {};
  return Object.entries(models).find(([, installed]) => installed === true)?.[0] as
    | WhisperModel
    | undefined;
}

function engineModelDownloaded(
  engines: EngineDescriptor[] | undefined,
  engineId: string,
  modelName: string,
): boolean {
  return Boolean(
    engines
      ?.find((engine) => engine.id === engineId)
      ?.models.some((model) => model.name === modelName && model.downloaded),
  );
}

function resolveSttEngine(
  config: AppConfig | undefined,
  installedEngines: string[] | undefined,
): SttEngine {
  const saved = config?.defaultSttEngine;
  if (
    saved &&
    saved !== "yt_captions" &&
    (!installedEngines || installedEngines.includes(saved))
  ) {
    return saved as SttEngine;
  }
  const first = installedEngines?.find((engine) => engine !== "yt_captions");
  return (first ?? FALLBACK_SELECTION.sttEngine) as SttEngine;
}

function resolveWhisperModel(
  config: AppConfig | undefined,
  deps: DependencyStatus | undefined,
  engines: EngineDescriptor[] | undefined,
  sttEngine: string,
): WhisperModel {
  const saved = (config?.defaultWhisperModel || FALLBACK_SELECTION.whisperModel) as WhisperModel;
  if (!deps && !engines) return saved;
  if (engineModelDownloaded(engines, sttEngine, saved)) return saved;
  const installed = firstInstalledWhisperModel(deps);
  return installed ?? saved;
}

export function defaultTranslatorFromConfig(config: AppConfig | undefined): string {
  return config?.activeTranslator || config?.translatorProvider || FALLBACK_SELECTION.translatorProvider;
}

export function isTranslatorProviderAvailable(
  provider: string,
  config: AppConfig | undefined,
): boolean {
  if (isBuiltinTranslator(provider)) return true;
  if (!provider.startsWith("custom:")) return false;
  const id = provider.slice("custom:".length);
  return Boolean(config?.customTranslators?.some((profile) => profile.id === id));
}

export function selectionDefaultsFromConfig(
  config: AppConfig | undefined,
  options: {
    installedEngines?: string[];
    deps?: DependencyStatus;
    engines?: EngineDescriptor[];
    vadSupported?: boolean;
  } = {},
): GenerateSelectionFields {
  const sttEngine = resolveSttEngine(config, options.installedEngines);
  return {
    sttSource: deriveSourceModeFromConfig(config),
    sttEngine,
    whisperModel: resolveWhisperModel(config, options.deps, options.engines, sttEngine),
    whisperDevice: (config?.defaultWhisperDevice || FALLBACK_SELECTION.whisperDevice) as WhisperDevice,
    vadEnabled:
      options.vadSupported === true
        ? config?.vadEnabled ?? FALLBACK_SELECTION.vadEnabled
        : false,
    sourceLang: config?.defaultSourceLang || FALLBACK_SELECTION.sourceLang,
    enableTranslation: config?.enableTranslation ?? FALLBACK_SELECTION.enableTranslation,
    targetLang: config?.defaultTargetLang || FALLBACK_SELECTION.targetLang,
    translatorProvider: defaultTranslatorFromConfig(config),
    downloadOnly: FALLBACK_SELECTION.downloadOnly,
  };
}

export function mergeGenerateSelection(
  defaults: GenerateSelectionFields,
  overrides: GenerateSelectionOverrides,
  dirty: GenerateSelectionDirty,
): GenerateSelectionFields {
  return {
    sttSource: dirty.sttSource ? overrides.sttSource ?? defaults.sttSource : defaults.sttSource,
    sttEngine: dirty.sttEngine ? overrides.sttEngine ?? defaults.sttEngine : defaults.sttEngine,
    whisperModel: dirty.whisperModel ? overrides.whisperModel ?? defaults.whisperModel : defaults.whisperModel,
    whisperDevice: dirty.whisperDevice ? overrides.whisperDevice ?? defaults.whisperDevice : defaults.whisperDevice,
    vadEnabled: dirty.vadEnabled ? overrides.vadEnabled ?? defaults.vadEnabled : defaults.vadEnabled,
    sourceLang: dirty.sourceLang ? overrides.sourceLang ?? defaults.sourceLang : defaults.sourceLang,
    enableTranslation: dirty.enableTranslation
      ? overrides.enableTranslation ?? defaults.enableTranslation
      : defaults.enableTranslation,
    targetLang: dirty.targetLang ? overrides.targetLang ?? defaults.targetLang : defaults.targetLang,
    translatorProvider: dirty.translatorProvider
      ? overrides.translatorProvider ?? defaults.translatorProvider
      : defaults.translatorProvider,
    downloadOnly: dirty.downloadOnly ? overrides.downloadOnly ?? defaults.downloadOnly : defaults.downloadOnly,
  };
}

export function setGenerateSelectionField<K extends keyof GenerateSelectionFields>(
  key: K,
  value: GenerateSelectionFields[K],
  setOverrides: React.Dispatch<React.SetStateAction<GenerateSelectionOverrides>>,
  setDirty: React.Dispatch<React.SetStateAction<GenerateSelectionDirty>>,
): void {
  setOverrides((current) => ({ ...current, [key]: value }));
  setDirty((current) => ({ ...current, [key]: true }));
}
