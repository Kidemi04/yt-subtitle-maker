import * as React from "react";
import { Input, Stack, XStack, YStack } from "tamagui";
import { Eye, EyeOff, RefreshCcw } from "@tamagui/lucide-icons";
import {
  Dropdown,
  ButtonSecondary,
  ButtonGhost,
  IconButton,
  Caption,
  TitleSm,
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
  apiKey: string;
  model: string;
}

export interface ProviderFormProps {
  profileId: string;
  initialName: string;
  initialBaseUrl: string;
  initialModel: string;
  apiKeyMasked: boolean;
  formProvider: TranslatorProvider;
  targetLang?: string;
  autoFetchModels?: boolean;
  autoFetchLabel?: string;
  onSave: (patch: ProviderFormSavePayload) => void;
  onCancel: () => void;
}

function ProviderInput({
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  right,
  ariaLabel,
  invalid = false,
  autoFocus = false,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  right?: React.ReactNode;
  ariaLabel: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const [focused, setFocused] = React.useState(false);
  const borderColor = invalid
    ? "$error"
    : focused
      ? "$accent"
      : "$borderStrong";

  return (
    <XStack
      alignItems="center"
      minHeight={56}
      borderRadius="$md"
      borderWidth={focused ? 2 : 1}
      borderColor={borderColor}
      backgroundColor="$bgBase"
      paddingLeft="$md"
      paddingRight={right ? "$xs" : "$md"}
      gap="$xs"
      hoverStyle={{ borderColor: invalid ? "$error" : "$accentDim" }}
      style={{
        boxShadow: focused
          ? "0 0 0 3px rgba(169, 88, 62, 0.12), inset 0 1px 0 rgba(20,20,19,0.03)"
          : "inset 0 1px 0 rgba(20,20,19,0.03)",
      }}
    >
      <Input
        unstyled
        flex={1}
        minWidth={0}
        height={54}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        secureTextEntry={secureTextEntry}
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        fontFamily="$body"
        fontSize={17}
        color="$textPrimary"
        placeholderTextColor="$textMuted"
        style={
          {
            color: "#141413",
            caretColor: "#a9583e",
            outline: "none",
          } as React.CSSProperties as never
        }
      />
      {right}
    </XStack>
  );
}

function FieldBlock({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <YStack gap="$xs" flex={1} minWidth={240}>
      <YStack gap={2}>
        <TitleSm>{label}</TitleSm>
        {helper ? <Caption color="$textMuted">{helper}</Caption> : null}
      </YStack>
      {children}
    </YStack>
  );
}

export function ProviderForm({
  profileId,
  initialName,
  initialBaseUrl,
  initialModel,
  apiKeyMasked,
  formProvider,
  targetLang,
  autoFetchModels = false,
  autoFetchLabel,
  onSave,
  onCancel,
}: ProviderFormProps) {
  const [name, setName] = React.useState(initialName);
  const [baseUrl, setBaseUrl] = React.useState(initialBaseUrl);
  const [model, setModel] = React.useState(initialModel);
  const [isReplacingKey, setIsReplacingKey] = React.useState(!apiKeyMasked);
  const [apiKey, setApiKey] = React.useState("");
  const [showKey, setShowKey] = React.useState(false);
  const [fetchedModels, setFetchedModels] = React.useState<string[]>([]);
  const [modelsBusy, setModelsBusy] = React.useState(false);
  const [modelsStatus, setModelsStatus] = React.useState<
    "idle" | "needs-key" | "loading" | "loaded" | "empty" | "error"
  >("idle");
  const [modelsError, setModelsError] = React.useState<string | undefined>(
    undefined,
  );
  const [testResult, setTestResult] = React.useState<
    TranslatorTestResult | undefined
  >(undefined);
  const [testing, setTesting] = React.useState(false);

  const urlValid =
    baseUrl === "" ||
    baseUrl.startsWith("http://") ||
    baseUrl.startsWith("https://");
  const useSavedKey = apiKeyMasked && !isReplacingKey;
  const modelReady = model.trim().length > 0;
  const apiKeyReady =
    useSavedKey || formProvider !== "openai" || apiKey.trim().length > 0;
  const requiresApiKeyForModels = formProvider === "openai" && !useSavedKey;
  const canFetchModels =
    urlValid && (!requiresApiKeyForModels || apiKey.trim().length > 0);
  const canSave =
    name.trim().length > 0 && urlValid && modelReady && apiKeyReady;

  const handleFetchModels = React.useCallback(async () => {
    if (!urlValid) {
      setModelsStatus("idle");
      return;
    }
    if (!canFetchModels) {
      setFetchedModels([]);
      setModelsError(undefined);
      setModelsStatus("needs-key");
      return;
    }

    setModelsBusy(true);
    setModelsStatus("loading");
    setModelsError(undefined);
    try {
      const res = useSavedKey
        ? await apiClient.listTranslatorModels({ profileId, useSavedKey: true })
        : await apiClient.listTranslatorModels({
            provider: formProvider,
            baseUrl: baseUrl || undefined,
            apiKey: apiKey || undefined,
          });
      if (!res.ok) {
        setFetchedModels([]);
        setModelsError(res.error ?? "Model fetch failed");
        setModelsStatus("error");
        return;
      }

      setFetchedModels(res.models);
      if (res.models.length > 0) {
        setModelsStatus("loaded");
        setModel((current) => (current.trim() ? current : res.models[0]));
      } else {
        setModelsStatus("empty");
      }
    } catch (err) {
      setFetchedModels([]);
      setModelsError(err instanceof Error ? err.message : String(err));
      setModelsStatus("error");
    } finally {
      setModelsBusy(false);
    }
  }, [
    apiKey,
    baseUrl,
    canFetchModels,
    formProvider,
    profileId,
    urlValid,
    useSavedKey,
  ]);

  React.useEffect(() => {
    if (!autoFetchModels) return;
    if (!baseUrl && !useSavedKey) return;

    const timeout = window.setTimeout(() => {
      void handleFetchModels();
    }, canFetchModels ? 650 : 100);

    return () => window.clearTimeout(timeout);
  }, [
    autoFetchModels,
    baseUrl,
    canFetchModels,
    handleFetchModels,
    useSavedKey,
  ]);

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
    onSave({
      name: name.trim(),
      baseUrl: baseUrl.trim(),
      apiKey: isReplacingKey ? apiKey : "***",
      model: model.trim(),
    });
  };

  const modelDropdownOptions = buildModelOptions(fetchedModels, model);
  const modelsSource = autoFetchLabel || name || "provider";

  return (
    <YStack gap="$md">
      <XStack gap="$md" flexWrap="wrap">
        <FieldBlock
          label="Provider name"
          helper="Shown in Generate and in this provider list."
        >
          <ProviderInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. DeepSeek"
            ariaLabel="Provider name"
          />
        </FieldBlock>

        <FieldBlock
          label="Endpoint"
          helper="OpenAI-compatible base URL. Leave blank only for Gemini."
        >
          <ProviderInput
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="https://api.example.com/v1"
            ariaLabel="Provider endpoint"
            invalid={!urlValid}
          />
          {!urlValid ? (
            <Caption color="$error">Must start with http:// or https://</Caption>
          ) : null}
        </FieldBlock>
      </XStack>

      <FieldBlock
        label="API key"
        helper={
          useSavedKey
            ? "A saved key is on file. Replace it only if you need to update it."
            : "Stored in the backend config after you save."
        }
      >
        {apiKeyMasked && !isReplacingKey ? (
          <XStack gap="$sm" alignItems="center">
            <XStack
              flex={1}
              minHeight={56}
              alignItems="center"
              borderRadius="$md"
              borderWidth={1}
              borderColor="$borderStrong"
              backgroundColor="$bgBase"
              paddingHorizontal="$md"
            >
              <Caption color="$textSecondary">Key saved securely</Caption>
            </XStack>
            <ButtonGhost
              height={56}
              onPress={() => {
                setIsReplacingKey(true);
                setApiKey("");
              }}
            >
              Replace key
            </ButtonGhost>
          </XStack>
        ) : (
          <YStack gap="$xs">
            <ProviderInput
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry={!showKey}
              placeholder="sk-..."
              ariaLabel="Provider API key"
              autoFocus={isReplacingKey}
              invalid={!apiKeyReady}
              right={
                <IconButton
                  icon={
                    showKey ? (
                      <EyeOff size={14} color="$textSecondary" />
                    ) : (
                      <Eye size={14} color="$textSecondary" />
                    )
                  }
                  aria-label="Toggle key visibility"
                  size={44}
                  onPress={() => setShowKey((v) => !v)}
                />
              }
            />
            {!apiKeyReady ? (
              <Caption color="$error">API key is required for this provider.</Caption>
            ) : null}
          </YStack>
        )}
      </FieldBlock>

      <FieldBlock
        label="Model"
        helper="Type a model id, or fetch available models from the endpoint."
      >
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
              <ProviderInput
                value={model}
                onChangeText={setModel}
                placeholder="e.g. deepseek-chat"
                ariaLabel="Provider model"
                invalid={!modelReady}
              />
            )}
          </Stack>
          <IconButton
            icon={<RefreshCcw size={14} color="$textSecondary" />}
            aria-label="Fetch models from this endpoint"
            size={52}
            onPress={() => {
              void handleFetchModels();
            }}
            disabled={modelsBusy || !urlValid || !canFetchModels}
          />
        </XStack>
        {modelsStatus === "needs-key" ? (
          <Caption color="$textMuted">
            Models will fetch automatically after an API key is entered.
          </Caption>
        ) : null}
        {modelsStatus === "loading" ? (
          <Caption color="$textSecondary">
            Fetching models from {modelsSource}...
          </Caption>
        ) : null}
        {modelsStatus === "loaded" ? (
          <Caption color="$success">
            Loaded {fetchedModels.length} model{fetchedModels.length === 1 ? "" : "s"} from {modelsSource}.
          </Caption>
        ) : null}
        {modelsStatus === "empty" ? (
          <Caption color="$warning">
            The endpoint responded, but did not return any models. You can type a model id manually.
          </Caption>
        ) : null}
        {modelsStatus === "error" ? (
          <Caption color="$warning">
            Could not fetch models{modelsError ? `: ${modelsError}` : ""}. You can type a model id manually.
          </Caption>
        ) : null}
        {!modelReady ? (
          <Caption color="$error">Choose or type a model before saving.</Caption>
        ) : null}
      </FieldBlock>

      {testResult ? (
        <Stack
          padding="$sm"
          borderRadius="$md"
          backgroundColor={testResult.ok ? "rgba(93,184,114,0.10)" : "rgba(232,165,90,0.10)"}
          borderWidth={1}
          borderColor={testResult.ok ? "$success" : "$warning"}
        >
          {testResult.ok ? (
            <Caption color="$success">
              {testResult.sample
                ? `Connected: ${testResult.sample.src} -> ${testResult.sample.dst}${
                    testResult.latencyMs ? ` · ${testResult.latencyMs}ms` : ""
                  }`
                : `Connected${
                    testResult.model ? ` · ${testResult.model}` : ""
                  }${testResult.latencyMs ? ` · ${testResult.latencyMs}ms` : ""}`}
            </Caption>
          ) : (
            <Caption color="$warning">{testResult.error ?? "Test failed"}</Caption>
          )}
        </Stack>
      ) : null}

      <XStack gap="$sm" alignItems="center" justifyContent="flex-end">
        <ButtonGhost onPress={handleTest} disabled={testing || !urlValid}>
          {testing ? "Testing..." : "Test connection"}
        </ButtonGhost>
        <ButtonGhost onPress={onCancel}>Cancel</ButtonGhost>
        <ButtonSecondary onPress={handleSave} disabled={!canSave}>
          Save provider
        </ButtonSecondary>
      </XStack>
    </YStack>
  );
}
