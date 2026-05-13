/**
 * ProviderForm — inline edit form for one translator profile.
 *
 * Pure presentational component (Task 5 `TranslationTab` will wire it to
 * `SettingsContext`). All side-effecting callbacks come through props
 * (`onSave`, `onCancel`); the form reads `targetLang` + `formProvider` as
 * props rather than calling `useSettings()` directly.
 *
 * Fields:
 *  1. Name              — TextInput
 *  2. Endpoint / baseUrl— TextInput (validates http:// or https://; blank
 *                         allowed for the Gemini form, which has no baseUrl)
 *  3. API key           — masked pill with "Replace" toggle OR a
 *                         `secureTextEntry` TextInput with Show/Hide eye.
 *                         The "Replace" state is local to this form
 *                         (`isReplacingKey: boolean`) — on Save, send "***"
 *                         to keep the saved key, or the typed value to
 *                         overwrite it.
 *  4. Model             — TextInput free-text fallback + Dropdown overlay
 *                         once `↻` populates the fetched list.
 *  5. Test result       — inline `✓ src → dst · ms` or `⚠ error`
 *  6. Test / Save / Cancel buttons
 *
 * The `formProvider` prop ("gemini" | "openai") tells the Test / list-models
 * calls which provider shape to send when the user is editing ad-hoc fields
 * (i.e. the saved key isn't being reused). For saved-key flows, we route
 * through `{ profileId, useSavedKey: true }` regardless.
 */

import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { Eye, EyeOff, RefreshCcw } from "@tamagui/lucide-icons";
import {
  TextInput,
  Dropdown,
  ButtonSecondary,
  ButtonGhost,
  IconButton,
  Caption,
  TitleSm,
  BodySm,
} from "@yt-subtitle-maker/ui";
import {
  type TranslatorProvider,
  type TranslatorTestResult,
} from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { buildModelOptions } from "./constants";

export interface ProviderFormSavePayload {
  name: string;
  baseUrl: string;
  /** Either `"***"` (keep saved key) or the new key the user typed. */
  apiKey: string;
  model: string;
}

export interface ProviderFormProps {
  /** Stable id of the profile being edited. Used for saved-key Test/Models. */
  profileId: string;
  initialName: string;
  initialBaseUrl: string;
  initialModel: string;
  /** true when the profile currently has a non-empty saved apiKey
   *  (returned as `"***"` by GET /api/config). */
  apiKeyMasked: boolean;
  /** Which provider shape to send when calling `testTranslator` /
   *  `listTranslatorModels` with ad-hoc form fields. Pick `"gemini"` when
   *  editing the built-in Gemini row, `"openai"` for everything else
   *  (built-in local_openai + every custom OpenAI-compatible profile). */
  formProvider: TranslatorProvider;
  /** Target language to round-trip through the Test endpoint. */
  targetLang?: string;
  onSave: (patch: ProviderFormSavePayload) => void;
  onCancel: () => void;
}

export function ProviderForm({
  profileId,
  initialName,
  initialBaseUrl,
  initialModel,
  apiKeyMasked,
  formProvider,
  targetLang,
  onSave,
  onCancel,
}: ProviderFormProps) {
  const [name, setName] = React.useState(initialName);
  const [baseUrl, setBaseUrl] = React.useState(initialBaseUrl);
  const [model, setModel] = React.useState(initialModel);

  // API-key replacement flow: this state is LOCAL to ProviderForm (per the
  // plan's "Replace local-only" decision). It does NOT extend the global
  // `replacingKey` map in SettingsContext.
  //
  // - When the profile already has a saved key (`apiKeyMasked === true`),
  //   we start with `isReplacingKey === false` → render the "•••• key on
  //   file [Replace]" pill. Clicking Replace flips it to true → real input.
  // - When the profile has no saved key yet (new profile or empty key), we
  //   start with `isReplacingKey === true` → render the input immediately.
  const [isReplacingKey, setIsReplacingKey] = React.useState(!apiKeyMasked);
  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);

  // Model-fetch state
  const [fetchedModels, setFetchedModels] = React.useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = React.useState(false);

  // Test state
  const [testResult, setTestResult] = React.useState<TranslatorTestResult | undefined>(
    undefined,
  );
  const [testing, setTesting] = React.useState(false);

  // URL validation — blank is allowed (gemini has no baseUrl); otherwise
  // must be http:// or https://.
  const urlValid =
    baseUrl === "" ||
    baseUrl.startsWith("http://") ||
    baseUrl.startsWith("https://");

  // Whether we should route Test / Models through the saved profile
  // (server-side credentials) vs. send the ad-hoc form values.
  const useSavedKey = apiKeyMasked && !isReplacingKey;

  const handleFetchModels = async () => {
    setModelsBusy(true);
    try {
      const res = useSavedKey
        ? await apiClient.listTranslatorModels({ profileId, useSavedKey: true })
        : await apiClient.listTranslatorModels({
            provider: formProvider,
            baseUrl: baseUrl || undefined,
            apiKey: apiKey || undefined,
          });
      if (res.ok) setFetchedModels(res.models);
    } catch {
      /* swallow — the dropdown stays in free-text mode */
    } finally {
      setModelsBusy(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(undefined);
    try {
      const res = useSavedKey
        ? await apiClient.testTranslator({
            profileId,
            useSavedKey: true,
            targetLang,
          })
        : await apiClient.testTranslator({
            provider: formProvider,
            baseUrl: baseUrl || undefined,
            apiKey: apiKey || undefined,
            model: model || undefined,
            targetLang,
          });
      setTestResult(res);
    } catch (err) {
      setTestResult({
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    // If we haven't replaced the saved key, send "***" so the backend
    // keeps the existing credential. Otherwise send whatever the user
    // typed (which may be "" for "clear the key").
    const finalApiKey = isReplacingKey ? apiKey : "***";
    onSave({ name, baseUrl, apiKey: finalApiKey, model });
  };

  const modelDropdownOptions = buildModelOptions(fetchedModels, model);

  return (
    <YStack gap="$sm">
      {/* Name */}
      <YStack gap={2}>
        <TitleSm>Name</TitleSm>
        <TextInput value={name} onChangeText={setName} placeholder="e.g. DeepSeek" />
      </YStack>

      {/* Endpoint */}
      <YStack gap={2}>
        <TitleSm>Endpoint</TitleSm>
        <TextInput
          value={baseUrl}
          onChangeText={setBaseUrl}
          placeholder="https://api.example.com/v1"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {!urlValid ? (
          <Caption color="$error">Must start with http:// or https://</Caption>
        ) : null}
      </YStack>

      {/* API key */}
      <YStack gap={2}>
        <TitleSm>API key</TitleSm>
        {apiKeyMasked && !isReplacingKey ? (
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
                setIsReplacingKey(true);
                setApiKey("");
              }}
            >
              Replace
            </ButtonGhost>
          </XStack>
        ) : (
          <XStack alignItems="center" position="relative">
            <TextInput
              flex={1}
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showKey}
              placeholder="sk-…"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Stack position="absolute" right={8}>
              <IconButton
                icon={
                  showKey ? (
                    <EyeOff size={14} color="$textSecondary" />
                  ) : (
                    <Eye size={14} color="$textSecondary" />
                  )
                }
                aria-label="Toggle key visibility"
                size={32}
                onPress={() => setShowKey((v) => !v)}
              />
            </Stack>
          </XStack>
        )}
      </YStack>

      {/* Model */}
      <YStack gap={2}>
        <TitleSm>Model</TitleSm>
        <XStack gap="$sm" alignItems="center">
          <Stack flex={1}>
            {fetchedModels.length > 0 ? (
              <Dropdown
                value={model}
                onValueChange={setModel}
                options={modelDropdownOptions}
                placeholder="e.g. deepseek-chat"
                width="100%"
              />
            ) : (
              <TextInput
                value={model}
                onChangeText={setModel}
                placeholder="e.g. deepseek-chat"
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}
          </Stack>
          <IconButton
            icon={<RefreshCcw size={14} color="$textSecondary" />}
            aria-label="Fetch models from this endpoint"
            size={32}
            onPress={handleFetchModels}
            disabled={modelsBusy}
          />
        </XStack>
        {fetchedModels.length === 0 ? (
          <Caption color="$textSecondary">
            Click ↻ to fetch models from this endpoint.
          </Caption>
        ) : null}
      </YStack>

      {/* Test result inline */}
      {testResult ? (
        <Stack
          padding="$sm"
          borderRadius="$md"
          backgroundColor="$surfaceGlass"
          borderWidth={1}
          borderColor={testResult.ok ? "$success" : "$warning"}
        >
          {testResult.ok && testResult.sample ? (
            <Caption color="$success">
              {`✓ ${testResult.sample.src} → ${testResult.sample.dst}${
                testResult.latencyMs ? ` · ${testResult.latencyMs}ms` : ""
              }`}
            </Caption>
          ) : (
            <Caption color="$warning">{`⚠ ${testResult.error ?? "Unknown error"}`}</Caption>
          )}
        </Stack>
      ) : null}

      {/* Test + Cancel + Save */}
      <XStack gap="$sm" alignItems="center" justifyContent="flex-end">
        <ButtonGhost onPress={handleTest} disabled={testing}>
          {testing ? "Testing…" : "Test"}
        </ButtonGhost>
        <ButtonGhost onPress={onCancel}>Cancel</ButtonGhost>
        <ButtonSecondary onPress={handleSave} disabled={!urlValid}>
          Save
        </ButtonSecondary>
      </XStack>
    </YStack>
  );
}
