import * as React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { apiClient } from "../../state/client";
import {
  ApiClient,
  type AppConfig,
  type TranslatorProvider,
  type DependencyStatus,
} from "@yt-subtitle-maker/api-client";
import { STT_ENGINE_LABELS, TABS, WHISPER_MODEL_IDS, type TabId } from "./shared";

export type ConnState = "untested" | "ok" | "warning" | "error";

export interface SettingsContextValue {
  // data
  config: AppConfig | undefined;
  draft: AppConfig | undefined;
  loading: boolean;
  saving: boolean;
  error: string | undefined;
  setError: (e: string | undefined) => void;
  dirty: boolean;
  // secret-field UI
  showApiKey: boolean;
  setShowApiKey: React.Dispatch<React.SetStateAction<boolean>>;
  replacingKey: Record<"gemini" | "openai" | "localOpenai", boolean>;
  setReplacingKey: React.Dispatch<
    React.SetStateAction<Record<"gemini" | "openai" | "localOpenai", boolean>>
  >;
  // connection test statuses
  backendStatus: ConnState;
  setBackendStatus: (s: ConnState) => void;
  translatorStatus: ConnState;
  cookieStatus: ConnState;
  cookieError: string | undefined;
  cookieSource: string | undefined;
  cookiesAttached: boolean | undefined;
  // version / deps derived data
  installedEngines: string[] | undefined;
  jsRuntime: string | null | undefined;
  deps: DependencyStatus | undefined;
  geminiModels: string[];
  localOpenaiModels: string[];
  openaiModels: string[];
  modelsBusy: "gemini" | "local_openai" | "openai" | undefined;
  sttEngineOptions: { label: string; value: string }[];
  whisperModelOptions: { label: string; value: string }[];
  // mutations / actions
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  onSave: () => Promise<void>;
  onDiscard: () => void;
  testBackend: () => Promise<void>;
  testTranslator: () => Promise<void>;
  testCookies: () => Promise<void>;
  refreshLocalOpenaiModels: () => Promise<void>;
  refreshOpenaiModels: () => Promise<void>;
  // setters exposed for inline handlers (e.g. "Reset all to defaults")
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | undefined>>;
  setDraft: React.Dispatch<React.SetStateAction<AppConfig | undefined>>;
  // navigation (Task 3 wires the UI; declared here so the shape is stable)
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  // search / highlight (Task 5 wires the UI)
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  highlightedSettingId: string | null;
  setHighlightedSettingId: (id: string | null) => void;
}

const SettingsContext = React.createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = React.useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within <SettingsProvider>");
  return ctx;
}

const TAB_IDS = TABS.map((t) => t.id);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = React.useState<AppConfig | undefined>();
  const [draft, setDraft] = React.useState<AppConfig | undefined>();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [replacingKey, setReplacingKey] = React.useState<
    Record<"gemini" | "openai" | "localOpenai", boolean>
  >({ gemini: false, openai: false, localOpenai: false });
  const [backendStatus, setBackendStatus] = React.useState<ConnState>("untested");
  const [translatorStatus, setTranslatorStatus] = React.useState<ConnState>("untested");
  const [cookieStatus, setCookieStatus] = React.useState<ConnState>("untested");
  const [cookieError, setCookieError] = React.useState<string | undefined>();
  const [cookieSource, setCookieSource] = React.useState<string | undefined>();
  const [cookiesAttached, setCookiesAttached] = React.useState<boolean | undefined>();
  const [installedEngines, setInstalledEngines] = React.useState<string[] | undefined>(undefined);
  const [jsRuntime, setJsRuntime] = React.useState<string | null | undefined>(undefined);
  const [geminiModels, setGeminiModels] = React.useState<string[]>([]);
  const [localOpenaiModels, setLocalOpenaiModels] = React.useState<string[]>([]);
  const [openaiModels, setOpenaiModels] = React.useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = React.useState<
    "gemini" | "local_openai" | "openai" | undefined
  >(undefined);
  const [deps, setDeps] = React.useState<DependencyStatus | undefined>();

  const params = useLocalSearchParams<{ tab?: string | string[] }>();
  const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  const activeTab: TabId =
    tabParam && (TAB_IDS as string[]).includes(tabParam) ? (tabParam as TabId) : "general";

  const setActiveTab = React.useCallback((t: TabId) => {
    router.setParams({ tab: t });
  }, []);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [highlightedSettingId, setHighlightedSettingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .fetchConfig()
      .then((c) => {
        if (cancelled) return;
        setConfig(c);
        setDraft(c);
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    apiClient
      .fetchVersion()
      .then((v) => {
        if (cancelled) return;
        setInstalledEngines(v.installedSttEngines ?? []);
        setJsRuntime(v.jsRuntime ?? null);
      })
      .catch(() => undefined);
    // Gemini list is static (KNOWN_MODELS in the backend) — fetch once on
    // mount; doesn't depend on credentials.
    apiClient
      .listTranslatorModels({ provider: "gemini" })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setGeminiModels(res.models);
      })
      .catch(() => undefined);
    apiClient
      .fetchDependencies()
      .then((d) => !cancelled && setDeps(d))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshLocalOpenaiModels = async () => {
    if (!draft) return;
    setModelsBusy("local_openai");
    try {
      const res = await apiClient.listTranslatorModels({
        provider: "local_openai",
        baseUrl: draft.localOpenaiBaseUrl,
        apiKey: draft.localOpenaiApiKey,
      });
      if (res.ok) setLocalOpenaiModels(res.models);
    } catch {
      /* surface via translator status */
    } finally {
      setModelsBusy(undefined);
    }
  };

  const refreshOpenaiModels = async () => {
    if (!draft) return;
    setModelsBusy("openai");
    try {
      const res = await apiClient.listTranslatorModels({
        provider: "openai",
        baseUrl: draft.openaiBaseUrl,
        apiKey: draft.openaiApiKey,
      });
      if (res.ok) setOpenaiModels(res.models);
    } catch {
      /* surface via translator status */
    } finally {
      setModelsBusy(undefined);
    }
  };

  const sttEngineOptions = React.useMemo(() => {
    // "auto" is always offered; the rest is exactly what the backend reports
    // as installed — never a hardcoded/aspirational engine.
    const ids = ["auto", ...(installedEngines ?? [])];
    return ids
      .filter((id, i) => ids.indexOf(id) === i) // dedupe
      .map((id) => ({ label: STT_ENGINE_LABELS[id] ?? id, value: id }));
  }, [installedEngines]);

  const whisperModelOptions = React.useMemo(() => {
    const downloaded = deps?.models ?? {};
    const ids = WHISPER_MODEL_IDS.includes(draft?.defaultWhisperModel ?? "")
      ? WHISPER_MODEL_IDS
      : [draft?.defaultWhisperModel ?? "", ...WHISPER_MODEL_IDS].filter(Boolean);
    return ids.map((id) => {
      const star = id === "turbo" ? " ⭐" : "";
      let suffix = "";
      if (deps) suffix = downloaded[id as keyof typeof downloaded] ? "  ✓ downloaded" : "  · not downloaded";
      return { label: `${id}${star}${suffix}`, value: id };
    });
  }, [deps, draft?.defaultWhisperModel]);

  const dirty = !!draft && !!config && JSON.stringify(draft) !== JSON.stringify(config);

  const update = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const next = await apiClient.updateConfig(draft);
      setConfig(next);
      setDraft(next);
      setReplacingKey({ gemini: false, openai: false, localOpenai: false });
      apiClient.setBaseUrl(next.backendUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    if (config) setDraft(config);
    setReplacingKey({ gemini: false, openai: false, localOpenai: false });
  };

  const testBackend = async () => {
    if (!draft) return;
    setBackendStatus("untested");
    try {
      const tmp = new ApiClient(draft.backendUrl);
      await tmp.fetchVersion();
      setBackendStatus("ok");
    } catch {
      setBackendStatus("error");
    }
  };

  const testTranslator = async () => {
    if (!draft) return;
    setTranslatorStatus("untested");
    try {
      const provider = draft.translatorProvider;
      const baseUrl =
        provider === "local_openai"
          ? draft.localOpenaiBaseUrl
          : provider === "openai"
          ? draft.openaiBaseUrl
          : undefined;
      const apiKey =
        provider === "local_openai"
          ? draft.localOpenaiApiKey
          : provider === "openai"
          ? draft.openaiApiKey
          : draft.geminiApiKey;
      const model =
        provider === "local_openai"
          ? draft.localOpenaiModel
          : provider === "openai"
          ? draft.openaiModel
          : draft.geminiModel;
      const res = await apiClient.testTranslator({ provider, baseUrl, apiKey, model });
      setTranslatorStatus(res.ok ? "ok" : "error");
    } catch {
      setTranslatorStatus("error");
    }
  };

  const testCookies = async () => {
    if (!draft) return;
    setCookieStatus("untested");
    setCookieError(undefined);
    setCookieSource(undefined);
    setCookiesAttached(undefined);
    try {
      const res = await apiClient.testCookies({
        cookieBrowser: draft.cookieBrowser,
        cookieProfile: draft.cookieProfile,
        cookiesTxtPath: draft.cookiesTxtPath,
      });
      setCookieStatus(res.ok ? "ok" : "error");
      setCookieError(res.error);
      setCookieSource(res.cookieSource);
      setCookiesAttached(res.cookiesAttached);
    } catch (err) {
      setCookieStatus("error");
      setCookieError(err instanceof Error ? err.message : String(err));
    }
  };

  const value: SettingsContextValue = {
    config, draft, loading, saving, error, setError, dirty,
    showApiKey, setShowApiKey, replacingKey, setReplacingKey,
    backendStatus, setBackendStatus, translatorStatus,
    cookieStatus, cookieError, cookieSource, cookiesAttached,
    installedEngines, jsRuntime, deps, geminiModels, localOpenaiModels, openaiModels, modelsBusy,
    sttEngineOptions, whisperModelOptions,
    update, onSave, onDiscard, testBackend, testTranslator, testCookies,
    refreshLocalOpenaiModels, refreshOpenaiModels,
    setConfig, setDraft,
    activeTab, setActiveTab, searchQuery, setSearchQuery, highlightedSettingId, setHighlightedSettingId,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
