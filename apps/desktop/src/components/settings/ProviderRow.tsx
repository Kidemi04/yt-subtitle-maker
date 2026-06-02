import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { MoreHorizontal } from "@tamagui/lucide-icons";
import {
  BadgePill,
  BodySm,
  ButtonGhost,
  ButtonSecondary,
  Caption,
  IconButton,
  StatusDot,
  TitleSm,
} from "@yt-subtitle-maker/ui";
import {
  type TranslatorProvider,
  type TranslatorTestResult,
} from "@yt-subtitle-maker/api-client";
import { ProviderForm } from "./ProviderForm";

export {
  PROVIDER_PRESETS,
  type ProviderPreset,
} from "./providerPresets";

export interface ProviderRowSavePayload {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface ProviderRowProps {
  profileId: string;
  name: string;
  baseUrl: string;
  model: string;
  apiKeyMasked: boolean;
  isActive: boolean;
  isBuiltIn: boolean;
  isEditing: boolean;
  lastTest?: TranslatorTestResult & { at: number };
  formProvider: TranslatorProvider;
  targetLang?: string;
  onActivate: () => void;
  onTest: () => Promise<void>;
  onEditToggle: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onSave: (patch: ProviderRowSavePayload) => void;
  onCancelEdit: () => void;
}

function formatTimeAgo(at: number): string {
  const secs = Math.round((Date.now() - at) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function testDotStatus(
  lastTest: (TranslatorTestResult & { at: number }) | undefined,
): "ok" | "error" | "untested" {
  if (!lastTest) return "untested";
  return lastTest.ok ? "ok" : "error";
}

export function ProviderRow({
  profileId,
  name,
  baseUrl,
  model,
  apiKeyMasked,
  isActive,
  isBuiltIn,
  isEditing,
  lastTest,
  formProvider,
  targetLang,
  onActivate,
  onTest,
  onEditToggle,
  onDuplicate,
  onDelete,
  onSave,
  onCancelEdit,
}: ProviderRowProps) {
  const [testing, setTesting] = React.useState(false);
  const [kebabOpen, setKebabOpen] = React.useState(false);

  const handleTest = async () => {
    setTesting(true);
    try {
      await onTest();
    } finally {
      setTesting(false);
    }
  };

  if (isEditing) {
    return (
      <Stack
        borderRadius="$lg"
        backgroundColor="$bgBase"
        borderWidth={1}
        borderColor="$accentDim"
        padding="$md"
      >
        <ProviderForm
          profileId={profileId}
          initialName={name}
          initialBaseUrl={baseUrl}
          initialModel={model}
          apiKeyMasked={apiKeyMasked}
          formProvider={formProvider}
          targetLang={targetLang}
          onSave={onSave}
          onCancel={onCancelEdit}
        />
      </Stack>
    );
  }

  const dotStatus = testDotStatus(lastTest);
  const hasMoreActions = Boolean(onDuplicate || onDelete);

  return (
    <YStack
      gap="$sm"
      padding="$md"
      borderRadius="$lg"
      backgroundColor={isActive ? "$accentSoft" : "$bgBase"}
      borderWidth={1}
      borderColor={isActive ? "$accent" : "$borderSubtle"}
    >
      <XStack alignItems="flex-start" gap="$sm">
        <Stack
          tag="button"
          role="radio"
          aria-label={`Activate ${name || "provider"}`}
          aria-checked={isActive}
          width={22}
          height={22}
          marginTop={3}
          borderRadius="$pill"
          borderWidth={2}
          borderColor={isActive ? "$accent" : "$borderStrong"}
          backgroundColor={isActive ? "$accent" : "transparent"}
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          pressStyle={{ scale: 0.9 }}
          animation="quick"
          onPress={onActivate}
          flexShrink={0}
        >
          {isActive ? (
            <Stack
              width={8}
              height={8}
              borderRadius="$pill"
              backgroundColor="$bgBase"
            />
          ) : null}
        </Stack>

        <YStack flex={1} minWidth={0} gap="$xs">
          <XStack alignItems="center" gap="$sm" flexWrap="wrap">
            <TitleSm>{name || "(unnamed)"}</TitleSm>
            {isActive ? <BadgePill tone="accent">Active</BadgePill> : null}
            {isBuiltIn ? <BadgePill tone="neutral">Built-in</BadgePill> : null}
            {model ? <BadgePill tone="neutral">{model}</BadgePill> : null}
          </XStack>
          <Caption color={baseUrl ? "$textSecondary" : "$textMuted"} numberOfLines={2}>
            {baseUrl || "No endpoint configured"}
          </Caption>
        </YStack>

        <XStack gap="$xs" alignItems="center" flexShrink={0}>
          <ButtonSecondary onPress={handleTest} disabled={testing} height={48}>
            {testing ? "Testing..." : "Test"}
          </ButtonSecondary>
          <ButtonGhost onPress={onEditToggle} height={48}>
            Edit
          </ButtonGhost>
          {hasMoreActions ? (
            <Stack position="relative">
              <IconButton
                icon={<MoreHorizontal size={16} color="$textSecondary" />}
                size={52}
                aria-label="More actions"
                onPress={() => setKebabOpen((v) => !v)}
              />
              {kebabOpen ? (
                <Stack
                  position="absolute"
                  top={44}
                  right={0}
                  zIndex={100}
                  backgroundColor="$bgBase"
                  borderWidth={1}
                  borderColor="$borderSubtle"
                  borderRadius="$md"
                  padding="$xs"
                  minWidth={132}
                  style={{ boxShadow: "0 12px 24px rgba(33,26,24,0.10)" }}
                >
                  {onDuplicate ? (
                    <Stack
                      tag="button"
                      role="button"
                      paddingHorizontal="$sm"
                      paddingVertical="$xs"
                      borderRadius="$sm"
                      hoverStyle={{ backgroundColor: "$surfaceGlass" }}
                      cursor="pointer"
                      onPress={() => {
                        setKebabOpen(false);
                        onDuplicate();
                      }}
                    >
                      <BodySm>Duplicate</BodySm>
                    </Stack>
                  ) : null}
                  {onDelete ? (
                    <Stack
                      tag="button"
                      role="button"
                      paddingHorizontal="$sm"
                      paddingVertical="$xs"
                      borderRadius="$sm"
                      hoverStyle={{ backgroundColor: "$surfaceGlass" }}
                      cursor="pointer"
                      onPress={() => {
                        setKebabOpen(false);
                        onDelete();
                      }}
                    >
                      <BodySm color="$error">Delete</BodySm>
                    </Stack>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </XStack>
      </XStack>

      <XStack alignItems="center" gap="$xs">
        <StatusDot status={dotStatus} size={8} />
        {lastTest ? (
          <YStack flex={1} minWidth={0}>
            <Caption
              color={lastTest.ok ? "$success" : "$warning"}
              numberOfLines={1}
            >
              {lastTest.ok
                ? `Connected${lastTest.latencyMs ? ` · ${lastTest.latencyMs}ms` : ""}`
                : lastTest.error ?? "Test failed"}
            </Caption>
            <Caption color="$textMuted" numberOfLines={1}>
              {formatTimeAgo(lastTest.at)}
            </Caption>
          </YStack>
        ) : (
          <Caption color="$textMuted">Not tested yet</Caption>
        )}
      </XStack>
    </YStack>
  );
}
