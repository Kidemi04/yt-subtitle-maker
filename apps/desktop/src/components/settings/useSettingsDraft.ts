// apps/desktop/src/components/settings/useSettingsDraft.ts
// Leaf hook: owns `config`/`draft` and the debounced-autosave engine. Imports
// only `react`, the singleton apiClient, the api-client types, and `./constants`
// — NOT `./SettingsContext` (the context wraps this hook; importing it back
// would reintroduce a require-cycle).
import * as React from "react";
import { apiClient } from "../../state/client";
import type { AppConfig } from "@yt-subtitle-maker/api-client";
import { MASK, SETTING_FIELD, tabOfSettingId, type TabId } from "./constants";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

// AppConfig keys that hold a masked secret on GET ("***" == "no change").
// Mirrors the backend's SECRET_KEYS — never POST a literal "***" for these.
const SECRET_KEYS: (keyof AppConfig)[] = ["geminiApiKey", "localOpenaiApiKey", "openaiApiKey"];

const DEBOUNCE_MS = 400;
const SAVED_PILL_MS = 1600;

export interface SettingsDraft {
  config: AppConfig | undefined;
  draft: AppConfig | undefined;
  defaults: AppConfig | undefined;
  loading: boolean;
  error: string | undefined;
  setError: (e: string | undefined) => void;
  saveStatus: SaveStatus;
  failedFields: Set<keyof AppConfig>;
  /** Edit a field; schedules a debounced POST of the accumulated deltas. */
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  /** Re-run the last failed save now. */
  retrySave: () => void;
  /** True if any field on `tabId` differs from its effective default. */
  tabDiffersFromDefaults: (tabId: TabId) => boolean;
  /** Revert one SettingRow's field to its effective default and save now. */
  revertField: (settingId: string) => void;
  /** Revert every field on `tabId` to its effective default and save now. */
  resetTab: (tabId: TabId) => void;
  /** Fire any pending debounced save immediately (used on unmount). */
  flush: () => void;
  // exposed for the "Reset all to defaults" path in AdvancedTab
  setConfig: React.Dispatch<React.SetStateAction<AppConfig | undefined>>;
  setDraft: React.Dispatch<React.SetStateAction<AppConfig | undefined>>;
}

export function useSettingsDraft(): SettingsDraft {
  const [config, setConfig] = React.useState<AppConfig | undefined>();
  const [draft, setDraft] = React.useState<AppConfig | undefined>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>();
  const [saveStatus, setSaveStatus] = React.useState<SaveStatus>("idle");
  const [failedFields, setFailedFields] = React.useState<Set<keyof AppConfig>>(new Set());

  // refs used by the debounce so we don't capture stale state
  const draftRef = React.useRef<AppConfig | undefined>(undefined);
  const configRef = React.useRef<AppConfig | undefined>(undefined);
  const pendingKeys = React.useRef<Set<keyof AppConfig>>(new Set());
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = React.useRef(false);
  const savedPillTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  draftRef.current = draft;
  configRef.current = config;

  React.useEffect(() => {
    let cancelled = false;
    apiClient
      .fetchConfig()
      .then((c) => {
        if (cancelled) return;
        setConfig(c);
        setDraft(c);
      })
      .catch((err) => !cancelled && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const defaults = config?._defaults;

  // Build the delta payload from pendingKeys, applying the secret-mask rule:
  // if a secret key's current draft value is the MASK sentinel, skip it
  // (the backend keeps the saved one); if it equals the saved config value,
  // also skip it (nothing changed). Returns {} if there's nothing to send.
  const buildDelta = React.useCallback((): Partial<AppConfig> => {
    const d = draftRef.current;
    const c = configRef.current;
    if (!d) return {};
    const out: Partial<AppConfig> = {};
    for (const key of pendingKeys.current) {
      const v = d[key] as unknown;
      if (SECRET_KEYS.includes(key) && v === MASK) continue; // "*** == no change"
      if (c && JSON.stringify(c[key]) === JSON.stringify(v)) continue; // unchanged
      (out as Record<string, unknown>)[key as string] = v;
    }
    return out;
  }, []);

  const runSave = React.useCallback(async () => {
    if (inFlight.current) return; // a save is mid-flight; the new edits stay in
    // pendingKeys and the post-flight code re-checks
    const delta = buildDelta();
    if (Object.keys(delta).length === 0) {
      pendingKeys.current.clear();
      return;
    }
    const sentKeys = new Set(pendingKeys.current);
    pendingKeys.current.clear();
    inFlight.current = true;
    setSaveStatus("saving");
    try {
      const next = await apiClient.updateConfig(delta);
      setConfig(next);
      // Merge the server's truth back into the draft, but DON'T clobber any
      // field the user has since re-edited (i.e. that's back in pendingKeys).
      setDraft((cur) => {
        if (!cur) return next;
        const merged = { ...next };
        const curRec = cur as unknown as Record<string, unknown>;
        const mergedRec = merged as unknown as Record<string, unknown>;
        for (const k of pendingKeys.current) {
          mergedRec[k as string] = curRec[k as string];
        }
        return merged;
      });
      apiClient.setBaseUrl(next.backendUrl);
      setFailedFields((prev) => {
        const n = new Set(prev);
        for (const k of sentKeys) n.delete(k);
        return n;
      });
      setSaveStatus("saved");
      if (savedPillTimer.current) clearTimeout(savedPillTimer.current);
      savedPillTimer.current = setTimeout(() => {
        // only drop the pill if nothing went wrong since
        setSaveStatus((s) => (s === "saved" ? "idle" : s));
      }, SAVED_PILL_MS);
    } catch (err) {
      // keep the edited values; mark the fields as failed; surface "retry"
      for (const k of sentKeys) pendingKeys.current.add(k); // so retrySave resends them
      setFailedFields((prev) => {
        const n = new Set(prev);
        for (const k of sentKeys) n.add(k);
        return n;
      });
      setError(err instanceof Error ? err.message : String(err));
      setSaveStatus("error");
    } finally {
      inFlight.current = false;
      // edits arrived during the in-flight save (or a failure re-queued some) →
      // schedule another pass
      if (pendingKeys.current.size > 0) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void runSave(), DEBOUNCE_MS);
      }
    }
  }, [buildDelta]);

  const scheduleSave = React.useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void runSave(), DEBOUNCE_MS);
  }, [runSave]);

  const update = React.useCallback(
    <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
      setDraft((d) => (d ? { ...d, [key]: value } : d));
      pendingKeys.current.add(key);
      scheduleSave();
    },
    [scheduleSave],
  );

  const retrySave = React.useCallback(() => {
    // pendingKeys already holds the failed keys (re-queued in the catch)
    if (timer.current) clearTimeout(timer.current);
    void runSave();
  }, [runSave]);

  const flush = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (pendingKeys.current.size > 0) void runSave();
  }, [runSave]);

  // flush on unmount so a mid-debounce edit isn't lost; also clear both
  // timers explicitly so no setTimeout fires on a dead component.
  React.useEffect(
    () => () => {
      flush();
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      if (savedPillTimer.current) { clearTimeout(savedPillTimer.current); savedPillTimer.current = null; }
    },
    [flush],
  );

  const tabDiffersFromDefaults = React.useCallback(
    (tabId: TabId) => {
      const d = draftRef.current;
      if (!d || !defaults) return false;
      for (const [settingId, key] of Object.entries(SETTING_FIELD)) {
        if (!key) continue;
        if (tabOfSettingId(settingId) !== tabId) continue;
        const k = key as keyof AppConfig;
        if (JSON.stringify(d[k]) !== JSON.stringify((defaults as AppConfig)[k])) return true;
      }
      return false;
    },
    [defaults],
  );

  const revertField = React.useCallback(
    (settingId: string) => {
      const key = SETTING_FIELD[settingId];
      if (!key || !defaults) return;
      update(key, (defaults as AppConfig)[key]);
    },
    [defaults, update],
  );

  const resetTab = React.useCallback(
    (tabId: TabId) => {
      if (!defaults) return;
      const d = draftRef.current;
      if (!d) return;
      const next = { ...d };
      const changedKeys: (keyof AppConfig)[] = [];
      for (const [settingId, key] of Object.entries(SETTING_FIELD)) {
        if (!key) continue;
        if (tabOfSettingId(settingId) !== tabId) continue;
        const k = key as keyof AppConfig;
        if (JSON.stringify(next[k]) === JSON.stringify((defaults as AppConfig)[k])) continue;
        (next as Record<string, unknown>)[k as string] = (defaults as AppConfig)[k];
        changedKeys.push(k);
      }
      if (changedKeys.length === 0) return;
      setDraft(next);
      for (const k of changedKeys) pendingKeys.current.add(k);
      scheduleSave();
    },
    [defaults, scheduleSave],
  );

  return {
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
  };
}
