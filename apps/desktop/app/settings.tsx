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

const STT_ENGINES = [
  { label: "Auto (try YT, fall back)", value: "auto" },
  { label: "openai-whisper", value: "openai-whisper" },
  { label: "faster-whisper ⭐", value: "faster-whisper" },
  { label: "WhisperX", value: "whisperx" },
  { label: "insanely-fast-whisper", value: "insanely-fast-whisper" },
];

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
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const sttEngineOptions = React.useMemo(() => {
    const installed = installedEngines;
    if (!installed) return STT_ENGINES; // not loaded yet — show all to avoid flash
    return STT_ENGINES.filter(
      (opt) => opt.value === "auto" || installed.includes(opt.value),
    );
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

  const testCookies = async () => {
    setCookieStatus("untested");
    try {
      const res = await apiClient.testCookies();
      setCookieStatus(res.ok ? "ok" : "error");
      setCookieError(res.error);
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
            <XStack gap="$sm" alignItems="center" flex={1}>
              <StatusDot status={cookieStatus} size={8} />
              <BodySm>
                {cookieStatus === "ok"
                  ? "Cookies working"
                  : cookieStatus === "error"
                  ? `Failed: ${cookieError ?? "unknown"}`
                  : "Untested — click Test to verify."}
              </BodySm>
            </XStack>
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
                <TextInput
                  value={draft.geminiModel}
                  onChangeText={(v: string) => update("geminiModel", v)}
                  placeholder="gemini-2.5-flash-lite"
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
                <Field label="Model name" />
                <XStack gap="$sm" alignItems="center">
                  <TextInput
                    flex={1}
                    value={draft.localOpenaiModel}
                    onChangeText={(v: string) => update("localOpenaiModel", v)}
                    placeholder="gemma-3-27b-it"
                  />
                  <ButtonSecondary
                    onPress={async () => {
                      try {
                        const res = await apiClient.listTranslatorModels({
                          provider: "local_openai",
                          baseUrl: draft.localOpenaiBaseUrl,
                          apiKey: draft.localOpenaiApiKey,
                        });
                        if (res.ok && res.models[0]) {
                          update("localOpenaiModel", res.models[0]);
                        }
                      } catch {
                        /* surface in status */
                      }
                    }}
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
                <Field label="Model" />
                <TextInput
                  value={draft.openaiModel}
                  onChangeText={(v: string) => update("openaiModel", v)}
                  placeholder="gpt-4o-mini"
                />
              </YStack>
            </YStack>
          ) : null}
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
              onPress={() => {
                if (
                  typeof window !== "undefined" &&
                  window.confirm(
                    "Reset every setting on this page to defaults? This cannot be undone.",
                  )
                ) {
                  // Backend's default config — we re-fetch and overwrite draft.
                  apiClient.fetchConfig().then(setDraft);
                }
              }}
            >
              <BodySm fontWeight="500" color="$error">
                Reset to defaults
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
