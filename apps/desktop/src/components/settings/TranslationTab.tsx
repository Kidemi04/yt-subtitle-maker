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
  SegmentedControl,
  Toggle,
  ButtonSecondary,
  ButtonGhost,
  IconButton,
  StatusDot,
  BodySm,
  Caption,
} from "@yt-subtitle-maker/ui";
import { type TranslatorProvider } from "@yt-subtitle-maker/api-client";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { buildModelOptions, isMasked, LANGS } from "./constants";

export function TranslationTab() {
  const {
    draft,
    update,
    showApiKey,
    setShowApiKey,
    replacingKey,
    setReplacingKey,
    translatorStatus,
    testTranslator,
    geminiModels,
    localOpenaiModels,
    openaiModels,
    modelsBusy,
    refreshLocalOpenaiModels,
    refreshOpenaiModels,
  } = useSettings();
  if (!draft) return null;
  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="Translation" />
        <SettingRow id="translation.provider" label="Provider">
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
        </SettingRow>

        <XStack gap="$md" flexWrap="wrap">
          <YStack flex={1} minWidth={220}>
            <SettingRow id="translation.target-lang" label="Default target language">
              <Dropdown
                value={draft.defaultTargetLang}
                onValueChange={(v) => update("defaultTargetLang", v)}
                options={LANGS}
                width="100%"
              />
            </SettingRow>
          </YStack>
        </XStack>

        <SettingRow
          layout="row"
          id="translation.enable-by-default"
          label="Enable translation by default"
          helper="Pre-checks the Translation toggle on the Generate screen for new jobs."
        >
          <Toggle
            value={draft.enableTranslation}
            onValueChange={(v) => update("enableTranslation", v)}
            aria-label="Enable translation default"
          />
        </SettingRow>

        <SettingRow
          layout="row"
          id="translation.auto-translate-title"
          label="Auto-translate the video title"
          helper="Also translates the YouTube title into the target language and stores it in the sidecar (titleTranslated)."
        >
          <Toggle
            value={draft.autoTranslateTitle}
            onValueChange={(v) => update("autoTranslateTitle", v)}
            aria-label="Auto-translate title"
          />
        </SettingRow>

        {/* Provider-specific */}
        {draft.translatorProvider === "gemini" ? (
          <YStack gap="$sm">
            <SettingRow id="translation.gemini-api-key" label="Gemini API key">
              {isMasked(draft.geminiApiKey) && !replacingKey.gemini ? (
                <XStack gap="$sm" alignItems="center">
                  <Stack
                    flex={1}
                    padding="$sm"
                    borderRadius="$md"
                    backgroundColor="$surfaceGlass"
                    borderWidth={1}
                    borderColor="$borderSubtle"
                  >
                    <BodySm color="$textSecondary">•••• key on file</BodySm>
                  </Stack>
                  <ButtonGhost
                    onPress={() => {
                      update("geminiApiKey", "");
                      setReplacingKey((r) => ({ ...r, gemini: true }));
                    }}
                  >
                    Replace
                  </ButtonGhost>
                  <ButtonSecondary onPress={testTranslator}>Test</ButtonSecondary>
                  <StatusDot status={translatorStatus} size={8} />
                </XStack>
              ) : (
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
              )}
            </SettingRow>
            <SettingRow id="translation.gemini-model" label="Gemini model">
              <Dropdown
                value={draft.geminiModel}
                onValueChange={(v) => update("geminiModel", v)}
                options={buildModelOptions(geminiModels, draft.geminiModel)}
                width="100%"
                aria-label="Gemini model"
              />
            </SettingRow>
          </YStack>
        ) : null}

        {draft.translatorProvider === "local_openai" ? (
          <YStack gap="$sm">
            <SettingRow
              id="translation.local-base-url"
              label="Base URL"
              helper="LM Studio default 1234. Ollama is :11434."
            >
              <TextInput
                value={draft.localOpenaiBaseUrl}
                onChangeText={(v: string) => update("localOpenaiBaseUrl", v)}
                placeholder="http://127.0.0.1:1234/v1"
              />
            </SettingRow>
            <SettingRow
              id="translation.local-model"
              label="Model name"
              helper={
                localOpenaiModels.length === 0
                  ? "Click ↻ to fetch models from your LM Studio server."
                  : undefined
              }
            >
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
            </SettingRow>
            <SettingRow
              id="translation.local-api-key"
              label="API key (optional)"
              helper="Most local servers don't need one. Leave blank or 'lm-studio'."
            >
              {isMasked(draft.localOpenaiApiKey) && !replacingKey.localOpenai ? (
                <XStack gap="$sm" alignItems="center">
                  <Stack
                    flex={1}
                    padding="$sm"
                    borderRadius="$md"
                    backgroundColor="$surfaceGlass"
                    borderWidth={1}
                    borderColor="$borderSubtle"
                  >
                    <BodySm color="$textSecondary">•••• key on file</BodySm>
                  </Stack>
                  <ButtonGhost
                    onPress={() => {
                      update("localOpenaiApiKey", "");
                      setReplacingKey((r) => ({ ...r, localOpenai: true }));
                    }}
                  >
                    Replace
                  </ButtonGhost>
                </XStack>
              ) : (
                <TextInput
                  value={draft.localOpenaiApiKey}
                  onChangeText={(v: string) => update("localOpenaiApiKey", v)}
                  placeholder="lm-studio"
                />
              )}
            </SettingRow>
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
            <SettingRow
              id="translation.openai-base-url"
              label="Base URL"
              helper="OpenAI api.openai.com/v1, Groq api.groq.com/openai/v1, Together api.together.xyz/v1, etc."
            >
              <TextInput
                value={draft.openaiBaseUrl}
                onChangeText={(v: string) => update("openaiBaseUrl", v)}
              />
            </SettingRow>
            <SettingRow id="translation.openai-api-key" label="API key">
              {isMasked(draft.openaiApiKey) && !replacingKey.openai ? (
                <XStack gap="$sm" alignItems="center">
                  <Stack
                    flex={1}
                    padding="$sm"
                    borderRadius="$md"
                    backgroundColor="$surfaceGlass"
                    borderWidth={1}
                    borderColor="$borderSubtle"
                  >
                    <BodySm color="$textSecondary">•••• key on file</BodySm>
                  </Stack>
                  <ButtonGhost
                    onPress={() => {
                      update("openaiApiKey", "");
                      setReplacingKey((r) => ({ ...r, openai: true }));
                    }}
                  >
                    Replace
                  </ButtonGhost>
                  <ButtonSecondary onPress={testTranslator}>Test</ButtonSecondary>
                  <StatusDot status={translatorStatus} size={8} />
                </XStack>
              ) : (
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
              )}
            </SettingRow>
            <SettingRow
              id="translation.openai-model"
              label="Model"
              helper={
                openaiModels.length === 0
                  ? "Click ↻ to fetch models from this OpenAI-compat endpoint."
                  : undefined
              }
            >
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
            </SettingRow>
          </YStack>
        ) : null}
      </YStack>
    </GlassCard>
  );
}
