/**
 * ProviderRow — a single row in the Translation tab's provider list.
 *
 * Pure presentational component; all side effects come through props
 * (`onActivate`, `onTest`, `onEditToggle`, `onDuplicate`, `onDelete`,
 * `onSave`, `onCancelEdit`). Task 5 `TranslationTab` will wire these to
 * `SettingsContext`.
 *
 * Two visual states:
 *  - Collapsed (default): radio + name + endpoint subtitle + model badge
 *    + last-test StatusDot + relative timestamp + Test / Edit / ⋯ kebab.
 *  - Expanded (`isEditing === true`): the row body is replaced by an
 *    inline `<ProviderForm>` (see ProviderForm.tsx).
 *
 * `PROVIDER_PRESETS` lives in `./providerPresets.ts`; we re-export it
 * here for back-compat with any caller that imports from this module.
 */

import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { MoreHorizontal } from "@tamagui/lucide-icons";
import {
  BadgePill,
  StatusDot,
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
import { ProviderForm } from "./ProviderForm";

// Re-export so existing imports (and Task 4 `AddProviderModal`) can grab
// the preset list from either location.
export {
  PROVIDER_PRESETS,
  type ProviderPreset,
} from "./providerPresets";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProviderRowSavePayload {
  name: string;
  baseUrl: string;
  /** Either `"***"` (keep saved key) or the new key the user typed. */
  apiKey: string;
  model: string;
}

export interface ProviderRowProps {
  profileId: string;
  name: string;
  baseUrl: string;
  model: string;
  /** true when the profile's saved apiKey is non-empty (masked to `"***"`
   *  on GET /api/config). */
  apiKeyMasked: boolean;
  isActive: boolean;
  isBuiltIn: boolean;
  isEditing: boolean;
  /** Last `apiClient.testTranslator(...)` result for this profile, plus
   *  the wall-clock time it was recorded (driven by `SettingsContext`'s
   *  `recordTestResult`). */
  lastTest?: TranslatorTestResult & { at: number };
  /** Which provider shape to send when the form runs ad-hoc Test/Models.
   *  `"gemini"` for the built-in Gemini row; `"openai"` for built-in
   *  `local_openai` and every custom OpenAI-compatible profile. */
  formProvider: TranslatorProvider;
  /** Default target language for the form's Test round-trip. */
  targetLang?: string;
  onActivate: () => void;
  onTest: () => Promise<void>;
  onEditToggle: () => void;
  onDuplicate?: () => void;
  /** Absent for built-in profiles (gemini / local_openai). */
  onDelete?: () => void;
  onSave: (patch: ProviderRowSavePayload) => void;
  onCancelEdit: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Component ──────────────────────────────────────────────────────────────

export function ProviderRow({
  profileId,
  name,
  baseUrl,
  model,
  apiKeyMasked,
  isActive,
  isBuiltIn: _isBuiltIn,
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

  const dotStatus = testDotStatus(lastTest);

  if (isEditing) {
    return (
      <Stack
        borderRadius="$lg"
        backgroundColor="$surfaceGlass"
        borderWidth={1}
        borderColor="$borderSubtle"
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

  return (
    <XStack
      alignItems="center"
      gap="$sm"
      paddingHorizontal="$md"
      paddingVertical="$sm"
      borderRadius="$lg"
      backgroundColor="$surfaceGlass"
      borderWidth={1}
      borderColor={isActive ? "$accent" : "$borderSubtle"}
    >
      {/* Radio selector */}
      <Stack
        tag="button"
        role="radio"
        aria-checked={isActive}
        width={20}
        height={20}
        borderRadius="$pill"
        borderWidth={2}
        borderColor={isActive ? "$accent" : "$borderSubtle"}
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
          <Stack width={8} height={8} borderRadius="$pill" backgroundColor="$background" />
        ) : null}
      </Stack>

      {/* Name + endpoint */}
      <YStack flex={1} minWidth={0} gap={2}>
        <TitleSm numberOfLines={1}>{name || "(unnamed)"}</TitleSm>
        {baseUrl ? (
          <Caption color="$textSecondary" numberOfLines={1}>
            {baseUrl}
          </Caption>
        ) : null}
      </YStack>

      {/* Model badge */}
      {model ? <BadgePill tone="neutral">{model}</BadgePill> : null}

      {/* Last-test dot + timestamp */}
      <XStack alignItems="center" gap="$xs">
        <StatusDot status={dotStatus} size={8} />
        {lastTest ? (
          <Caption color="$textMuted">{formatTimeAgo(lastTest.at)}</Caption>
        ) : null}
      </XStack>

      {/* Actions */}
      <XStack gap="$xs" alignItems="center">
        <ButtonSecondary onPress={handleTest} disabled={testing}>
          {testing ? "Testing…" : "Test"}
        </ButtonSecondary>
        <ButtonGhost onPress={onEditToggle}>Edit</ButtonGhost>
        {/* Kebab menu — Duplicate + Delete (built-ins: only Duplicate) */}
        <Stack position="relative">
          <IconButton
            icon={<MoreHorizontal size={16} color="$textSecondary" />}
            size={32}
            aria-label="More actions"
            onPress={() => setKebabOpen((v) => !v)}
          />
          {kebabOpen ? (
            <Stack
              position="absolute"
              top={36}
              right={0}
              zIndex={100}
              backgroundColor="$surfaceGlass"
              borderWidth={1}
              borderColor="$borderSubtle"
              borderRadius="$md"
              padding="$xs"
              minWidth={120}
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
      </XStack>
    </XStack>
  );
}
