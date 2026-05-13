import * as React from "react";
import { router, useGlobalSearchParams } from "expo-router";
import { apiClient } from "../../state/client";
import {
  type AppConfig,
  type DependencyStatus,
  type EngineDescriptor,
  type SystemReport,
  type TranslatorProfile,
  type TranslatorProvider,
  type TranslatorTestResult,
} from "@yt-subtitle-maker/api-client";
import { STT_ENGINE_LABELS, TABS, WHISPER_MODEL_IDS, type TabId } from "./constants";
import { useSettingsDraft, type SaveStatus } from "./useSettingsDraft";

export type ConnState = "untested" | "ok" | "warning" | "error";

export interface SettingsContextValue {
  // data
  config: AppConfig | undefined;
  draft: AppConfig | undefined;
  defaults: AppConfig | undefined;
  loading: boolean;
  error: string | undefined;
  setError: (e: string | undefined) => void;
  // autosave status
  saveStatus: SaveStatus;
  failedFields: Set<keyof AppConfig>;
  // secret-field UI
  // TODO(4d-followup): showApiKey / setShowApiKey are unused after the 4d-frontend rewrite — remove in a follow-up.
  showApiKey: boolean;
  setShowApiKey: React.Dispatch<React.SetStateAction<boolean>>;
  // connection test statuses
  // TODO(4d-followup): translatorStatus was driven by the removed testTranslator legacy alias — remove in a follow-up.
  translatorStatus: ConnState;
  cookieStatus: ConnState;
  cookieError: string | undefined;
  cookieSource: string | undefined;
  cookiesAttached: boolean | undefined;
  // version / deps derived data
  installedEngines: string[] | undefined;
  jsRuntime: string | null | undefined;
  deps: DependencyStatus | undefined;
  sttEngineOptions: { label: string; value: string }[];
  whisperModelOptions: { label: string; value: string }[];
  engines: EngineDescriptor[] | undefined;
  system: SystemReport | undefined;
  refreshEngines: () => Promise<void>;
  // mutations / actions
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  retrySave: () => void;
  tabDiffersFromDefaults: (t: TabId) => boolean;
  revertField: (id: string) => void;
  resetTab: (t: TabId) => void;
  flush: () => void;
  // Phase 4d-frontend: named provider profiles
  customTranslators: TranslatorProfile[] | undefined;
  activeTranslator: string | undefined;
  lastTestResult: Record<string, TranslatorTestResult & { at: number }>;
  recordTestResult: (profileId: string, result: TranslatorTestResult) => void;
  testProfile: (profileId: string) => Promise<TranslatorTestResult>;
  testAdhoc: (
    spec:
      | { provider: TranslatorProvider; baseUrl?: string; apiKey?: string; model?: string; targetLang?: string }
      | { profileId: string; useSavedKey: true; targetLang?: string },
  ) => Promise<TranslatorTestResult>;
  setActiveTranslator: (id: string) => void;
  addCustomTranslator: (profile: TranslatorProfile) => void;
  removeCustomTranslator: (id: string) => void;
  updateCustomTranslator: (id: string, patch: Partial<TranslatorProfile>) => void;
  testCookies: () => Promise<void>;
  // setters exposed for inline handlers (e.g. "Reset all to defaults")
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | undefined>>;
  setDraft: React.Dispatch<React.SetStateAction<AppConfig | undefined>>;
  // navigation
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  // search / highlight
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
  const ds = useSettingsDraft();
  const {
    config,
    draft,
    defaults,
    loading,
    error,
    setError,
    saveStatus,
    failedFields,
    update,
    retrySave,
    tabDiffersFromDefaults,
    revertField,
    resetTab,
    flush,
    setConfig,
    setDraft,
  } = ds;

  const [showApiKey, setShowApiKey] = React.useState(false);
  const [translatorStatus, setTranslatorStatus] = React.useState<ConnState>("untested");
  const [cookieStatus, setCookieStatus] = React.useState<ConnState>("untested");
  const [cookieError, setCookieError] = React.useState<string | undefined>();
  const [cookieSource, setCookieSource] = React.useState<string | undefined>();
  const [cookiesAttached, setCookiesAttached] = React.useState<boolean | undefined>();
  const [installedEngines, setInstalledEngines] = React.useState<string[] | undefined>(undefined);
  const [jsRuntime, setJsRuntime] = React.useState<string | null | undefined>(undefined);
  const [lastTestResult, setLastTestResult] = React.useState<
    Record<string, TranslatorTestResult & { at: number }>
  >({});
  const [deps, setDeps] = React.useState<DependencyStatus | undefined>();
  const [engines, setEngines] = React.useState<EngineDescriptor[] | undefined>(undefined);
  const [system, setSystem] = React.useState<SystemReport | undefined>(undefined);

  // useGlobalSearchParams (not useLocalSearchParams) — this provider lives in
  // app/_layout.tsx so the Generate-screen safety banner can read
  // lastTestResult (Phase 4d-frontend Task 6). useLocalSearchParams in a
  // layout returns the layout segment's params (empty for the root layout),
  // so the ?tab= query string was invisible and tab clicks didn't switch.
  const params = useGlobalSearchParams<{ tab?: string | string[] }>();
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
      .fetchVersion()
      .then((v) => {
        if (cancelled) return;
        setInstalledEngines(v.installedSttEngines ?? []);
        setJsRuntime(v.jsRuntime ?? null);
      })
      .catch(() => undefined);
    apiClient
      .fetchDependencies()
      .then((d) => !cancelled && setDeps(d))
      .catch(() => undefined);
    apiClient
      .getEngines()
      .then((e) => !cancelled && setEngines(e))
      .catch(() => undefined);
    apiClient
      .getSystem()
      .then((s) => !cancelled && setSystem(s))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshEngines = React.useCallback(async () => {
    try {
      const e = await apiClient.getEngines();
      setEngines(e);
    } catch {
      /* best-effort — ModelRow handles its own local error state */
    }
  }, []);

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
      if (deps)
        suffix = downloaded[id as keyof typeof downloaded] ? "  ✓ downloaded" : "  · not downloaded";
      return { label: `${id}${star}${suffix}`, value: id };
    });
  }, [deps, draft?.defaultWhisperModel]);

  const recordTestResult = React.useCallback(
    (profileId: string, result: TranslatorTestResult) => {
      setLastTestResult((prev) => ({
        ...prev,
        [profileId]: { ...result, at: Date.now() },
      }));
    },
    [],
  );

  const testProfile = React.useCallback(
    async (profileId: string): Promise<TranslatorTestResult> => {
      if (!draft) throw new Error("No draft");
      const result = await apiClient.testTranslator({
        profileId,
        useSavedKey: true,
        targetLang: draft.defaultTargetLang,
      });
      recordTestResult(profileId, result);
      return result;
    },
    [draft, recordTestResult],
  );

  const testAdhoc = React.useCallback(
    async (
      spec:
        | { provider: TranslatorProvider; baseUrl?: string; apiKey?: string; model?: string; targetLang?: string }
        | { profileId: string; useSavedKey: true; targetLang?: string },
    ): Promise<TranslatorTestResult> => {
      const result = await apiClient.testTranslator(spec);
      // For ad-hoc specs with a profileId, record the result
      if ("profileId" in spec) {
        recordTestResult(spec.profileId, result);
      }
      return result;
    },
    [recordTestResult],
  );

  const setActiveTranslator = React.useCallback(
    (id: string) => {
      update("activeTranslator", id);
    },
    [update],
  );

  const addCustomTranslator = React.useCallback(
    (profile: TranslatorProfile) => {
      update("customTranslators", [
        ...(draft?.customTranslators ?? []),
        profile,
      ]);
    },
    [draft, update],
  );

  const removeCustomTranslator = React.useCallback(
    (id: string) => {
      update(
        "customTranslators",
        (draft?.customTranslators ?? []).filter((p) => p.id !== id),
      );
    },
    [draft, update],
  );

  const updateCustomTranslator = React.useCallback(
    (id: string, patch: Partial<TranslatorProfile>) => {
      update(
        "customTranslators",
        (draft?.customTranslators ?? []).map((p) =>
          p.id === id ? { ...p, ...patch } : p,
        ),
      );
    },
    [draft, update],
  );

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
    config,
    draft,
    defaults,
    loading,
    error,
    setError,
    saveStatus,
    failedFields,
    showApiKey,
    setShowApiKey,
    translatorStatus,
    cookieStatus,
    cookieError,
    cookieSource,
    cookiesAttached,
    installedEngines,
    jsRuntime,
    deps,
    sttEngineOptions,
    whisperModelOptions,
    engines,
    system,
    refreshEngines,
    update,
    retrySave,
    tabDiffersFromDefaults,
    revertField,
    resetTab,
    flush,
    customTranslators: draft?.customTranslators,
    activeTranslator: draft?.activeTranslator,
    lastTestResult,
    recordTestResult,
    testProfile,
    testAdhoc,
    setActiveTranslator,
    addCustomTranslator,
    removeCustomTranslator,
    updateCustomTranslator,
    testCookies,
    setConfig,
    setDraft,
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    highlightedSettingId,
    setHighlightedSettingId,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
