import * as React from "react";
import { Stack, Text, XStack, YStack, ScrollView } from "tamagui";
import {
  Eye,
  EyeOff,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  AlertCircle,
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

function CaptionUpper({ children }: { children: React.ReactNode }) {
  return (
    <Text
      fontFamily="$body"
      fontSize={11}
      fontWeight="600"
      letterSpacing={1.5}
      textTransform="uppercase"
      color="$textMuted"
    >
      {children}
    </Text>
  );
}

function SectionTitle({
  children,
  subtitle,
}: {
  children: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <YStack gap={2}>
      <Text
        fontFamily="$display"
        fontSize={22}
        letterSpacing={-0.3}
        color="$textPrimary"
      >
        {children}
      </Text>
      {subtitle ? (
        <Text fontFamily="$body" fontSize={13} color="$textSecondary">
          {subtitle}
        </Text>
      ) : null}
    </YStack>
  );
}

function FieldLabel({
  children,
  helper,
}: {
  children: React.ReactNode;
  helper?: string;
}) {
  return (
    <YStack gap={2} marginBottom="$xxs">
      <Text
        fontFamily="$body"
        fontSize={13}
        fontWeight="500"
        color="$textPrimary"
      >
        {children}
      </Text>
      {helper ? (
        <Text fontFamily="$body" fontSize={12} color="$textMuted">
          {helper}
        </Text>
      ) : null}
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
    return () => {
      cancelled = true;
    };
  }, []);

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
        <SectionTitle>Settings</SectionTitle>
        <GlassCard variant="mid">
          <Text fontFamily="$body" fontSize={13} color="$textSecondary">
            {error ? `Failed to load config: ${error}` : "Loading config…"}
          </Text>
        </GlassCard>
      </YStack>
    );
  }

  return (
    <YStack gap="$lg" paddingBottom={120}>
      <SectionTitle subtitle="Backend, cookies, STT engine, translation, and advanced.">
        Settings
      </SectionTitle>

      {/* GENERAL */}
      <GlassCard variant="mid">
        <YStack gap="$md">
          <SectionTitle>General</SectionTitle>
          <YStack gap="$xs">
            <FieldLabel helper="Default 127.0.0.1:8000. Change for V2 ngrok tunneling.">
              Backend URL
            </FieldLabel>
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
            <FieldLabel>Download folder</FieldLabel>
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
          <SectionTitle subtitle="Some YouTube videos require browser cookies. Firefox is the most reliable extractor.">
            Cookies (YouTube)
          </SectionTitle>
          <YStack gap="$xs">
            <FieldLabel>Cookie source</FieldLabel>
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
              <FieldLabel helper="Optional — leave blank for default profile.">
                Browser profile
              </FieldLabel>
              <TextInput
                value={draft.cookieProfile}
                onChangeText={(v: string) => update("cookieProfile", v)}
              />
            </YStack>
          ) : null}
          <YStack gap="$xs">
            <FieldLabel helper="Optional fallback — overrides browser cookies.">
              cookies.txt path
            </FieldLabel>
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
              <Text fontFamily="$body" fontSize={13} color="$textPrimary">
                {cookieStatus === "ok"
                  ? "Cookies working"
                  : cookieStatus === "error"
                  ? `Failed: ${cookieError ?? "unknown"}`
                  : "Untested — click Test to verify."}
              </Text>
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
              <Text fontFamily="$body" fontSize={12} color="$warning">
                ⚠ Chromium-based browsers (Chrome 127+) encrypt cookies with
                App-Bound Encryption. Extraction may fail. Use Firefox or
                cookies.txt fallback.
              </Text>
            </Stack>
          ) : null}
        </YStack>
      </GlassCard>

      {/* STT */}
      <GlassCard variant="mid">
        <YStack gap="$md">
          <SectionTitle subtitle="Defaults are overridable per-job in Generate.">
            STT Engine
          </SectionTitle>
          <XStack gap="$md" flexWrap="wrap">
            <YStack flex={1} minWidth={220} gap="$xs">
              <FieldLabel>Default engine</FieldLabel>
              <Dropdown
                value={draft.defaultSttEngine}
                onValueChange={(v) => update("defaultSttEngine", v)}
                options={STT_ENGINES}
                width="100%"
              />
            </YStack>
            <YStack flex={1} minWidth={220} gap="$xs">
              <FieldLabel>Default model</FieldLabel>
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
              <FieldLabel>Default device</FieldLabel>
              <Dropdown
                value={draft.defaultWhisperDevice}
                onValueChange={(v) => update("defaultWhisperDevice", v)}
                options={DEVICES}
                width="100%"
              />
            </YStack>
            <YStack flex={1} minWidth={220} gap="$xs">
              <FieldLabel helper="Setting a default prevents Whisper misdetection on intros / music.">
                Default source language
              </FieldLabel>
              <Dropdown
                value={draft.defaultSourceLang}
                onValueChange={(v) => update("defaultSourceLang", v)}
                options={LANGS}
                width="100%"
              />
            </YStack>
          </XStack>
          <XStack alignItems="center" justifyContent="space-between">
            <FieldLabel helper="Master switch for Auto mode. When off, Whisper always runs.">
              Try YouTube auto-captions first
            </FieldLabel>
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
          <SectionTitle>Translation</SectionTitle>
          <YStack gap="$xs">
            <FieldLabel>Provider</FieldLabel>
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
              <FieldLabel>Default target language</FieldLabel>
              <Dropdown
                value={draft.defaultTargetLang}
                onValueChange={(v) => update("defaultTargetLang", v)}
                options={LANGS}
                width="100%"
              />
            </YStack>
            <YStack flex={1} minWidth={220} gap="$xs">
              <XStack alignItems="center" justifyContent="space-between" flex={1}>
                <FieldLabel>Auto-translate title</FieldLabel>
                <Toggle
                  value={draft.autoTranslateTitle}
                  onValueChange={(v) => update("autoTranslateTitle", v)}
                  aria-label="Auto-translate title"
                />
              </XStack>
            </YStack>
          </XStack>

          {/* Provider-specific */}
          {draft.translatorProvider === "gemini" ? (
            <YStack gap="$sm">
              <YStack gap="$xs">
                <FieldLabel>Gemini API key</FieldLabel>
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
                            <EyeOff size={14} color="#a1a1a6" />
                          ) : (
                            <Eye size={14} color="#a1a1a6" />
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
                <FieldLabel>Gemini model</FieldLabel>
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
                <FieldLabel helper="LM Studio default 1234. Ollama is :11434.">
                  Base URL
                </FieldLabel>
                <TextInput
                  value={draft.localOpenaiBaseUrl}
                  onChangeText={(v: string) => update("localOpenaiBaseUrl", v)}
                  placeholder="http://127.0.0.1:1234/v1"
                />
              </YStack>
              <YStack gap="$xs">
                <FieldLabel>Model name</FieldLabel>
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
                    <RefreshCcw size={14} color="#a1a1a6" />
                  </ButtonSecondary>
                </XStack>
              </YStack>
              <YStack gap="$xs">
                <FieldLabel helper="Most local servers don't need one. Leave blank or 'lm-studio'.">
                  API key (optional)
                </FieldLabel>
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
                <Text fontFamily="$body" fontSize={12} color="$textMuted">
                  {translatorStatus === "ok"
                    ? "Working"
                    : translatorStatus === "error"
                    ? "Unreachable"
                    : "Untested"}
                </Text>
              </XStack>
              {translatorStatus !== "ok" ? (
                <Stack
                  padding="$sm"
                  borderRadius="$md"
                  backgroundColor="$surfaceGlass"
                  borderWidth={1}
                  borderColor="$borderSubtle"
                >
                  <Text
                    fontFamily="$body"
                    fontSize={12}
                    lineHeight={18}
                    color="$textSecondary"
                  >
                    First time using LM Studio? Download from{" "}
                    <Text color="$accent">lmstudio.ai</Text>, install a
                    translation-capable model (gemma-3-27b-it works on RTX
                    4060 Ti+), then click Local Server → Start.
                  </Text>
                </Stack>
              ) : null}
            </YStack>
          ) : null}

          {draft.translatorProvider === "openai" ? (
            <YStack gap="$sm">
              <YStack gap="$xs">
                <FieldLabel helper="OpenAI api.openai.com/v1, Groq api.groq.com/openai/v1, Together api.together.xyz/v1, etc.">
                  Base URL
                </FieldLabel>
                <TextInput
                  value={draft.openaiBaseUrl}
                  onChangeText={(v: string) => update("openaiBaseUrl", v)}
                />
              </YStack>
              <YStack gap="$xs">
                <FieldLabel>API key</FieldLabel>
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
                <FieldLabel>Model</FieldLabel>
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
          <SectionTitle>Advanced</SectionTitle>
          <YStack gap="$xs">
            <FieldLabel>MPV executable path</FieldLabel>
            <TextInput
              value={draft.mpvPath}
              onChangeText={(v: string) => update("mpvPath", v)}
              placeholder="(falls back to PATH)"
            />
          </YStack>
          <YStack gap="$xs">
            <FieldLabel>Whisper cache directory</FieldLabel>
            <TextInput
              value={draft.whisperCacheDir}
              onChangeText={(v: string) => update("whisperCacheDir", v)}
            />
          </YStack>
          <YStack gap="$xs">
            <FieldLabel>Output folder</FieldLabel>
            <TextInput
              value={draft.outputDir}
              onChangeText={(v: string) => update("outputDir", v)}
            />
          </YStack>
          <YStack gap="$xs">
            <FieldLabel>Logs verbosity</FieldLabel>
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
            <FieldLabel helper="Pre-resamples to 16 kHz mono before Whisper for timestamp accuracy.">
              FFmpeg 16 kHz pre-resample
            </FieldLabel>
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
              <Text fontFamily="$body" fontSize={13} fontWeight="500" color="$error">
                Reset to defaults
              </Text>
            </ButtonGhost>
          </XStack>
        </YStack>
      </GlassCard>

      {/* Sticky footer (position: sticky lives in inline style — Tamagui's
          position prop doesn't accept it on web targets). */}
      <XStack
        marginTop="$lg"
        padding="$md"
        backgroundColor="$bgElevated"
        borderTopWidth={1}
        borderTopColor="$borderSubtle"
        justifyContent="flex-end"
        alignItems="center"
        gap="$sm"
        style={{ position: "sticky", bottom: 0, zIndex: 50 }}
      >
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
