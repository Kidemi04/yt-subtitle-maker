import * as React from "react";
import { Stack, Text, XStack, YStack } from "tamagui";
import {
  Eye,
  EyeOff,
  RefreshCcw,
} from "@tamagui/lucide-icons";
import {
  GlassCard,
  TextInput,
  Dropdown,
  Toggle,
  SegmentedControl,
  ButtonPrimary,
  ButtonSecondary,
  ButtonGhost,
  IconButton,
  StatusDot,
  BadgePill,
  BadgeAccent,
  DisplaySm,
  TitleSm,
  BodyMd,
  BodySm,
  Caption,
} from "@yt-subtitle-maker/ui";
import { apiClient } from "../src/state/client";
import {
  ApiClient,
  type AppConfig,
  type TranslatorProvider,
} from "@yt-subtitle-maker/api-client";

type ConnState = "untested" | "ok" | "warning" | "error";

const COOKIE_BROWSERS = [
  { label: "None", value: "" },
  { label: "Firefox (recommended)", value: "firefox" },
  { label: "Chrome (may fail)", value: "chrome" },
  { label: "Edge (may fail)", value: "edge" },
  { label: "Brave (may fail)", value: "brave" },
  { label: "Opera (may fail)", value: "opera" },
];

const VERBOSITY = [
  { label: "Error", value: "error" },
  { label: "Warning", value: "warning" },
  { label: "Info", value: "info" },
  { label: "Debug", value: "debug" },
];

// Human labels for STT engine ids the backend may report as installed.
// Only ids that actually exist in core/stt/__init__.py's registry will ever
// appear (plus the synthetic "auto" mode). Adding a real engine later = add
// its label here; it shows up automatically once /api/version lists it.
const STT_ENGINE_LABELS: Record<string, string> = {
  auto: "Auto — use YouTube's captions if present, else Whisper",
  "openai-whisper": "openai-whisper (the reference engine)",
  yt_captions: "YouTube captions only",
};

const WHISPER_MODELS = [
  { label: "tiny", value: "tiny" },
  { label: "base", value: "base" },
  { label: "small", value: "small" },
  { label: "medium", value: "medium" },
  { label: "turbo ⭐", value: "turbo" },
  { label: "large-v3", value: "large-v3" },
];

const DEVICES = [
  { label: "Auto", value: "auto" },
  { label: "CPU", value: "cpu" },
  { label: "GPU", value: "gpu" },
];

const LANGS = [
  { label: "English", value: "en" },
  { label: "中文", value: "zh" },
  { label: "日本語", value: "ja" },
  { label: "한국어", value: "ko" },
  { label: "Español", value: "es" },
  { label: "Français", value: "fr" },
  { label: "Deutsch", value: "de" },
  { label: "Português", value: "pt" },
  { label: "Tiếng Việt", value: "vi" },
];

/** Section header — DisplaySm title plus optional BodySm subtitle. */
function Section({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <YStack gap={2}>
      <DisplaySm>{title}</DisplaySm>
      {subtitle ? <BodySm color="$textSecondary">{subtitle}</BodySm> : null}
    </YStack>
  );
}

/** Field label — TitleSm primary line + optional Caption helper. */
function Field({
  label,
  helper,
}: {
  label: string;
  helper?: string;
}) {
  return (
    <YStack gap={2} marginBottom="$xxs">
      <TitleSm>{label}</TitleSm>
      {helper ? <Caption>{helper}</Caption> : null}
    </YStack>
  );
}

export default function Settings() {
  const [config, setConfig] = React.useState<AppConfig | undefined>();
  const [draft, setDraft] = React.useState<AppConfig | undefined>();
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [backendStatus, setBackendStatus] = React.useState<ConnState>("untested");
  const [translatorStatus, setTranslatorStatus] = React.useState<ConnState>("untested");
  const [cookieStatus, setCookieStatus] = React.useState<ConnState>("untested");
  const [cookieError, setCookieError] = React.useState<string | undefined>();
  const [installedEngines, setInstalledEngines] = React.useState<
    string[] | undefined
  >(undefined);
  const [jsRuntime, setJsRuntime] = React.useState<string | null | undefined>(
    undefined,
  );

  // Translator model dropdown sources. Gemini's list is fetched once
  // (returns the hardcoded KNOWN_MODELS); LM Studio + OpenAI come from
  // the configured server's actual /v1/models endpoint.
  const [geminiModels, setGeminiModels] = React.useState<string[]>([]);
  const [localOpenaiModels, setLocalOpenaiModels] = React.useState<string[]>([]);
  const [openaiModels, setOpenaiModels] = React.useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = React.useState<
    "gemini" | "local_openai" | "openai" | undefined
  >(undefined);

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

  // Build dropdown option lists. If the saved value isn't in the fetched
  // list (e.g. user edited config.json by hand, or we haven't fetched yet),
  // include it as a "current" option so the dropdown can render the value
  // without showing a stale placeholder.
  const buildModelOptions = (
    fetched: string[],
    current: string | undefined,
  ): { label: string; value: string }[] => {
    const set = new Set(fetched);
    const out = fetched.map((m) => ({ label: m, value: m }));
    if (current && !set.has(current)) {
      out.unshift({ label: `${current} (current)`, value: current });
    }
    return out;
  };

  const sttEngineOptions = React.useMemo(() => {
    // "auto" is always offered; the rest is exactly what the backend reports
    // as installed — never a hardcoded/aspirational engine.
    const ids = ["auto", ...(installedEngines ?? [])];
    return ids
      .filter((id, i) => ids.indexOf(id) === i) // dedupe
      .map((id) => ({ label: STT_ENGINE_LABELS[id] ?? id, value: id }));
  }, [installedEngines]);

  const dirty =
    !!draft && !!config && JSON.stringify(draft) !== JSON.stringify(config);

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
      apiClient.setBaseUrl(next.backendUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const onDiscard = () => {
    if (config) setDraft(config);
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
      const res = await apiClient.testTranslator({
        provider,
        baseUrl,
        apiKey,
        model,
      });
      setTranslatorStatus(res.ok ? "ok" : "error");
    } catch {
      setTranslatorStatus("error");
    }
  };

  const [cookieSource, setCookieSource] = React.useState<string | undefined>();
  const [cookiesAttached, setCookiesAttached] = React.useState<boolean | undefined>();

  const testCookies = async () => {
    if (!draft) return;
    setCookieStatus("untested");
    setCookieError(undefined);
    setCookieSource(undefined);
    setCookiesAttached(undefined);
    try {
      // Pass DRAFT values so the user can verify changes BEFORE saving.
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

  if (loading || !draft) {
    return (
      <YStack gap="$lg">
        <Section title="Settings" />
        <GlassCard variant="mid">
          <BodySm color="$textSecondary">
            {error ? `Failed to load config: ${error}` : "Loading config…"}
          </BodySm>
        </GlassCard>
      </YStack>
    );
  }

  return (
    <YStack gap="$lg" paddingBottom={120}>
      <Section
        title="Settings"
        subtitle="Backend, cookies, STT engine, translation, and advanced."
      />

      {/* GENERAL */}
      <GlassCard variant="mid">
        <YStack gap="$md">
          <Section title="General" />
          <YStack gap="$xs">
            <Field
              label="Backend URL"
              helper="Default 127.0.0.1:8000. Change for V2 ngrok tunneling."
            />
            <XStack gap="$sm" alignItems="center">
              <TextInput
                flex={1}
                value={draft.backendUrl}
                onChangeText={(v: string) => update("backendUrl", v)}
              />
              <ButtonSecondary onPress={testBackend}>Test</ButtonSecondary>
              <StatusDot status={backendStatus} size={8} />
            </XStack>
          </YStack>
          <YStack gap="$xs">
            <Field label="Download folder" />
            <TextInput
              value={draft.downloadDir}
              onChangeText={(v: string) => update("downloadDir", v)}
              placeholder="C:\\Users\\you\\Downloads"
            />
          </YStack>
        </YStack>
      </GlassCard>

      {/* COOKIES */}
      <GlassCard variant="mid">
        <YStack gap="$md">
          <Section
            title="Cookies (YouTube)"
            subtitle="Some YouTube videos require browser cookies. Firefox is the most reliable extractor."
          />
          <YStack gap="$xs">
            <Field label="Cookie source" />
            <Dropdown
              value={draft.cookieBrowser}
              onValueChange={(v) =>
                update("cookieBrowser", v as AppConfig["cookieBrowser"])
              }
              options={COOKIE_BROWSERS}
              width="100%"
            />
          </YStack>
          {draft.cookieBrowser ? (
            <YStack gap="$xs">
              <Field
                label="Browser profile"
                helper="Optional — leave blank for default profile."
              />
              <TextInput
                value={draft.cookieProfile}
                onChangeText={(v: string) => update("cookieProfile", v)}
              />
            </YStack>
          ) : null}
          <YStack gap="$xs">
            <Field
              label="cookies.txt path"
              helper="Optional fallback — overrides browser cookies."
            />
            <TextInput
              value={draft.cookiesTxtPath}
              onChangeText={(v: string) => update("cookiesTxtPath", v)}
            />
          </YStack>
          <XStack
            alignItems="center"
            justifyContent="space-between"
            padding="$sm"
            borderRadius="$md"
            backgroundColor={
              cookieStatus === "ok"
                ? "rgba(93,184,114,0.10)"
                : cookieStatus === "error"
                ? "rgba(255,90,95,0.10)"
                : "$surfaceGlass"
            }
            borderWidth={1}
            borderColor={
              cookieStatus === "ok"
                ? "rgba(93,184,114,0.25)"
                : cookieStatus === "error"
                ? "rgba(255,90,95,0.25)"
                : "$borderSubtle"
            }
          >
            <YStack gap={2} flex={1}>
              <XStack gap="$sm" alignItems="center">
                <StatusDot status={cookieStatus} size={8} />
                <BodySm>
                  {cookieStatus === "ok"
                    ? cookiesAttached
                      ? `Cookies attached (${cookieSource ?? "configured"})`
                      : "Reachable, but no cookies were sent"
                    : cookieStatus === "error"
                    ? `Failed: ${cookieError ?? "unknown"}`
                    : "Untested — click Test to verify (uses your DRAFT settings)."}
                </BodySm>
              </XStack>
              {cookieStatus === "ok" && !cookiesAttached ? (
                <Caption>
                  This only verified yt-dlp can reach a public video; it does
                  not prove cookies will work on age-restricted content.
                </Caption>
              ) : null}
            </YStack>
            <ButtonSecondary onPress={testCookies}>Test</ButtonSecondary>
          </XStack>
          {["chrome", "edge", "brave", "opera"].includes(
            draft.cookieBrowser,
          ) ? (
            <Stack
              padding="$sm"
              borderRadius="$md"
              backgroundColor="rgba(232,165,90,0.10)"
              borderColor="rgba(232,165,90,0.30)"
              borderWidth={1}
            >
              <Caption color="$warning">
                ⚠ Chromium-based browsers (Chrome 127+) encrypt cookies with
                App-Bound Encryption. Extraction may fail. Use Firefox or
                cookies.txt fallback.
              </Caption>
            </Stack>
          ) : null}
        </YStack>
      </GlassCard>

      {/* STT */}
      <GlassCard variant="mid">
        <YStack gap="$md">
          <Section
            title="STT Engine"
            subtitle="Defaults are overridable per-job in Generate."
          />
          <XStack gap="$md" flexWrap="wrap">
            <YStack flex={1} minWidth={220} gap="$xs">
              <Field label="Default engine" />
              <Dropdown
                value={draft.defaultSttEngine}
                onValueChange={(v) => update("defaultSttEngine", v)}
                options={sttEngineOptions}
                width="100%"
              />
            </YStack>
            <YStack flex={1} minWidth={220} gap="$xs">
              <Field label="Default model" />
              <Dropdown
                value={draft.defaultWhisperModel}
                onValueChange={(v) => update("defaultWhisperModel", v)}
                options={WHISPER_MODELS}
                width="100%"
              />
            </YStack>
          </XStack>
          <XStack gap="$md" flexWrap="wrap">
            <YStack flex={1} minWidth={220} gap="$xs">
              <Field label="Default device" />
              <Dropdown
                value={draft.defaultWhisperDevice}
                onValueChange={(v) => update("defaultWhisperDevice", v)}
                options={DEVICES}
                width="100%"
              />
            </YStack>
            <YStack flex={1} minWidth={220} gap="$xs">
              <Field
                label="Default source language"
                helper="Setting a default prevents Whisper misdetection on intros / music."
              />
              <Dropdown
                value={draft.defaultSourceLang}
                onValueChange={(v) => update("defaultSourceLang", v)}
                options={LANGS}
                width="100%"
              />
            </YStack>
          </XStack>
          <XStack alignItems="center" justifyContent="space-between">
            <Field
              label="Try YouTube auto-captions first"
              helper="Master switch for Auto mode. When off, Whisper always runs."
            />
            <Toggle
              value={draft.ytCaptionsFirst}
              onValueChange={(v) => update("ytCaptionsFirst", v)}
              aria-label="YT captions first"
            />
          </XStack>

          <XStack alignItems="center" justifyContent="space-between">
            <Field
              label="Voice-Activity Detection (VAD) by default"
              helper="Skips silent regions before Whisper — faster on long videos. Per-job override stays on the Generate screen."
            />
            <Toggle
              value={draft.vadEnabled}
              onValueChange={(v) => update("vadEnabled", v)}
              aria-label="VAD default"
            />
          </XStack>
        </YStack>
      </GlassCard>

      {/* TRANSLATION */}
      <GlassCard variant="mid">
        <YStack gap="$md">
          <Section title="Translation" />
          <YStack gap="$xs">
            <Field label="Provider" />
            <SegmentedControl
              value={draft.translatorProvider}
              onValueChange={(v) =>
                update("translatorProvider", v as TranslatorProvider)
              }
              options={[
                { label: "Gemini", value: "gemini" },
                { label: "Local AI", value: "local_openai" },
                { label: "OpenAI-compat", value: "openai" },
              ]}
            />
          </YStack>

          <XStack gap="$md" flexWrap="wrap">
            <YStack flex={1} minWidth={220} gap="$xs">
              <Field label="Default target language" />
              <Dropdown
                value={draft.defaultTargetLang}
                onValueChange={(v) => update("defaultTargetLang", v)}
                options={LANGS}
                width="100%"
              />
            </YStack>
          </XStack>

          <XStack alignItems="center" justifyContent="space-between">
            <Field
              label="Enable translation by default"
              helper="Pre-checks the Translation toggle on the Generate screen for new jobs."
            />
            <Toggle
              value={draft.enableTranslation}
              onValueChange={(v) => update("enableTranslation", v)}
              aria-label="Enable translation default"
            />
          </XStack>

          <XStack alignItems="center" justifyContent="space-between">
            <Field
              label="Auto-translate the video title"
              helper="Also translates the YouTube title into the target language and stores it in the sidecar (titleTranslated)."
            />
            <Toggle
              value={draft.autoTranslateTitle}
              onValueChange={(v) => update("autoTranslateTitle", v)}
              aria-label="Auto-translate title"
            />
          </XStack>

          {/* Provider-specific */}
          {draft.translatorProvider === "gemini" ? (
            <YStack gap="$sm">
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
              <YStack gap="$xs">
                <Field label="Gemini model" />
                <Dropdown
                  value={draft.geminiModel}
                  onValueChange={(v) => update("geminiModel", v)}
                  options={buildModelOptions(geminiModels, draft.geminiModel)}
                  width="100%"
                  aria-label="Gemini model"
                />
              </YStack>
            </YStack>
          ) : null}

          {draft.translatorProvider === "local_openai" ? (
            <YStack gap="$sm">
              <YStack gap="$xs">
                <Field
                  label="Base URL"
                  helper="LM Studio default 1234. Ollama is :11434."
                />
                <TextInput
                  value={draft.localOpenaiBaseUrl}
                  onChangeText={(v: string) => update("localOpenaiBaseUrl", v)}
                  placeholder="http://127.0.0.1:1234/v1"
                />
              </YStack>
              <YStack gap="$xs">
                <Field
                  label="Model name"
                  helper={
                    localOpenaiModels.length === 0
                      ? "Click ↻ to fetch models from your LM Studio server."
                      : undefined
                  }
                />
                <XStack gap="$sm" alignItems="center">
                  <Stack flex={1}>
                    <Dropdown
                      value={draft.localOpenaiModel}
                      onValueChange={(v) => update("localOpenaiModel", v)}
                      options={buildModelOptions(
                        localOpenaiModels,
                        draft.localOpenaiModel,
                      )}
                      placeholder="gemma-3-27b-it"
                      width="100%"
                      aria-label="Local AI model"
                      disabled={
                        localOpenaiModels.length === 0 && !draft.localOpenaiModel
                      }
                    />
                  </Stack>
                  <ButtonSecondary
                    onPress={refreshLocalOpenaiModels}
                    disabled={modelsBusy === "local_openai"}
                  >
                    <RefreshCcw size={14} color="$textSecondary" />
                  </ButtonSecondary>
                </XStack>
              </YStack>
              <YStack gap="$xs">
                <Field
                  label="API key (optional)"
                  helper="Most local servers don't need one. Leave blank or 'lm-studio'."
                />
                <TextInput
                  value={draft.localOpenaiApiKey}
                  onChangeText={(v: string) => update("localOpenaiApiKey", v)}
                  placeholder="lm-studio"
                />
              </YStack>
              <XStack gap="$sm" alignItems="center">
                <ButtonSecondary onPress={testTranslator}>
                  Test connection
                </ButtonSecondary>
                <StatusDot status={translatorStatus} size={8} />
                <Caption>
                  {translatorStatus === "ok"
                    ? "Working"
                    : translatorStatus === "error"
                    ? "Unreachable"
                    : "Untested"}
                </Caption>
              </XStack>
              {translatorStatus !== "ok" ? (
                <Stack
                  padding="$sm"
                  borderRadius="$md"
                  backgroundColor="$surfaceGlass"
                  borderWidth={1}
                  borderColor="$borderSubtle"
                >
                  <Caption color="$textSecondary">
                    First time using LM Studio? Download from{" "}
                    <Text color="$accent">lmstudio.ai</Text>, install a
                    translation-capable model (gemma-3-27b-it works on RTX
                    4060 Ti+), then click Local Server → Start.
                  </Caption>
                </Stack>
              ) : null}
            </YStack>
          ) : null}

          {draft.translatorProvider === "openai" ? (
            <YStack gap="$sm">
              <YStack gap="$xs">
                <Field
                  label="Base URL"
                  helper="OpenAI api.openai.com/v1, Groq api.groq.com/openai/v1, Together api.together.xyz/v1, etc."
                />
                <TextInput
                  value={draft.openaiBaseUrl}
                  onChangeText={(v: string) => update("openaiBaseUrl", v)}
                />
              </YStack>
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
              <YStack gap="$xs">
                <Field
                  label="Model"
                  helper={
                    openaiModels.length === 0
                      ? "Click ↻ to fetch models from this OpenAI-compat endpoint."
                      : undefined
                  }
                />
                <XStack gap="$sm" alignItems="center">
                  <Stack flex={1}>
                    <Dropdown
                      value={draft.openaiModel}
                      onValueChange={(v) => update("openaiModel", v)}
                      options={buildModelOptions(openaiModels, draft.openaiModel)}
                      placeholder="gpt-4o-mini"
                      width="100%"
                      aria-label="OpenAI model"
                      disabled={openaiModels.length === 0 && !draft.openaiModel}
                    />
                  </Stack>
                  <ButtonSecondary
                    onPress={refreshOpenaiModels}
                    disabled={modelsBusy === "openai"}
                  >
                    <RefreshCcw size={14} color="$textSecondary" />
                  </ButtonSecondary>
                </XStack>
              </YStack>
            </YStack>
          ) : null}
        </YStack>
      </GlassCard>

      {/* SUBTITLE STYLE (mpv) */}
      <GlassCard variant="mid">
        <YStack gap="$md">
          <Section
            title="Subtitle style (mpv)"
            subtitle="How burned-in subtitles look when you Play with mpv. Leave a field blank to use mpv's default."
          />
          <YStack gap="$xs">
            <Field
              label="Font family"
              helper={
                'e.g. "Noto Sans CJK SC", "Inter", "Arial". Must be installed on the OS — mpv does not download fonts.'
              }
            />
            <TextInput
              value={draft.subFont}
              onChangeText={(v: string) => update("subFont", v)}
              placeholder="(mpv default sans)"
            />
          </YStack>
          <XStack gap="$md">
            <YStack gap="$xs" flex={1}>
              <Field label="Font size" helper="Pixels. 0 = default (≈55)." />
              <TextInput
                value={draft.subFontSize ? String(draft.subFontSize) : ""}
                onChangeText={(v: string) =>
                  update("subFontSize", parseInt(v, 10) || 0)
                }
                placeholder="0"
                keyboardType="numeric"
              />
            </YStack>
            <YStack gap="$xs" flex={1}>
              <Field
                label="Bottom margin"
                helper="Distance from bottom edge (px)."
              />
              <TextInput
                value={draft.subMarginY ? String(draft.subMarginY) : ""}
                onChangeText={(v: string) =>
                  update("subMarginY", parseInt(v, 10) || 0)
                }
                placeholder="0"
                keyboardType="numeric"
              />
            </YStack>
          </XStack>
          <XStack gap="$md">
            <YStack gap="$xs" flex={1}>
              <Field label="Text color" helper="Hex like #ffffff." />
              <TextInput
                value={draft.subColor}
                onChangeText={(v: string) => update("subColor", v)}
                placeholder="#ffffff"
              />
            </YStack>
            <YStack gap="$xs" flex={1}>
              <Field label="Outline color" helper="Hex like #000000." />
              <TextInput
                value={draft.subBorderColor}
                onChangeText={(v: string) => update("subBorderColor", v)}
                placeholder="#000000"
              />
            </YStack>
          </XStack>
          <XStack gap="$md">
            <YStack gap="$xs" flex={1}>
              <Field
                label="Outline width"
                helper="Pixels. 0 = no outline; blank = mpv default (≈3)."
              />
              <TextInput
                value={
                  draft.subBorderSize >= 0 ? String(draft.subBorderSize) : ""
                }
                onChangeText={(v: string) => {
                  if (v.trim() === "") {
                    update("subBorderSize", -1);
                    return;
                  }
                  const parsed = Number(v);
                  update("subBorderSize", Number.isFinite(parsed) ? parsed : -1);
                }}
                placeholder="(mpv default)"
                keyboardType="numeric"
              />
            </YStack>
            <YStack gap="$xs" flex={1}>
              <Field
                label="Background"
                helper="Box behind text. Hex with alpha #RRGGBBAA. Blank = transparent."
              />
              <TextInput
                value={draft.subBackColor}
                onChangeText={(v: string) => update("subBackColor", v)}
                placeholder="(transparent)"
              />
            </YStack>
          </XStack>
          <XStack alignItems="center" justifyContent="space-between">
            <Field label="Bold" helper="Render the subtitle font bold." />
            <Toggle
              value={draft.subBold}
              onValueChange={(v) => update("subBold", v)}
              aria-label="Subtitle bold"
            />
          </XStack>
        </YStack>
      </GlassCard>

      {/* ADVANCED */}
      <GlassCard variant="mid">
        <YStack gap="$md">
          <Section title="Advanced" />
          <YStack gap="$xs">
            <Field label="MPV executable path" />
            <TextInput
              value={draft.mpvPath}
              onChangeText={(v: string) => update("mpvPath", v)}
              placeholder="(falls back to PATH)"
            />
          </YStack>
          <YStack gap="$xs">
            <Field
              label="JS runtime for yt-dlp"
              helper={
                jsRuntime
                  ? `Detected: ${jsRuntime}`
                  : "⚠ No runtime detected — install Node or Deno, or set the path here. Without one, YouTube extraction degrades."
              }
            />
            <TextInput
              value={draft.jsRuntimePath}
              onChangeText={(v: string) => update("jsRuntimePath", v)}
              placeholder="(auto-detect node/deno on PATH)"
            />
          </YStack>
          <YStack gap="$xs">
            <Field label="Whisper cache directory" />
            <TextInput
              value={draft.whisperCacheDir}
              onChangeText={(v: string) => update("whisperCacheDir", v)}
            />
          </YStack>
          <YStack gap="$xs">
            <Field label="Output folder" />
            <TextInput
              value={draft.outputDir}
              onChangeText={(v: string) => update("outputDir", v)}
            />
          </YStack>
          <YStack gap="$xs">
            <Field label="Logs verbosity" />
            <Dropdown
              value={draft.logsVerbosity}
              onValueChange={(v) =>
                update("logsVerbosity", v as AppConfig["logsVerbosity"])
              }
              options={VERBOSITY}
              width={240}
            />
          </YStack>
          <XStack alignItems="center" justifyContent="space-between">
            <Field
              label="FFmpeg 16 kHz pre-resample"
              helper="Pre-resamples to 16 kHz mono before Whisper for timestamp accuracy."
            />
            <Toggle
              value={draft.ffmpegResample16k}
              onValueChange={(v) => update("ffmpegResample16k", v)}
              aria-label="FFmpeg pre-resample"
            />
          </XStack>
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
        </YStack>
      </GlassCard>

      {/* Sticky footer (position: sticky lives in inline style — Tamagui's
          position prop doesn't accept it on web targets). The left-aligned
          status sentence anchors the bar so it doesn't read as floating. */}
      <XStack
        marginTop="$lg"
        padding="$md"
        backgroundColor="$bgElevated"
        borderTopWidth={1}
        borderTopColor="$borderSubtle"
        alignItems="center"
        gap="$sm"
        style={{ position: "sticky", bottom: 0, zIndex: 50 }}
      >
        <Caption color="$textMuted">
          Click Save settings to apply changes.
        </Caption>
        <Stack flex={1} />
        {dirty ? (
          <BadgeAccent>unsaved changes</BadgeAccent>
        ) : (
          <BadgePill tone="success">all saved</BadgePill>
        )}
        <ButtonGhost onPress={onDiscard} disabled={!dirty || saving}>
          Discard
        </ButtonGhost>
        <ButtonPrimary onPress={onSave} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save settings"}
        </ButtonPrimary>
      </XStack>
    </YStack>
  );
}
