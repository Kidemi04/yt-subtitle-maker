/**
 * AddProviderModal — "+ Add provider" two-step flow.
 *
 * Rendered inline (as a `GlassCard` below the provider list) when `isOpen`.
 * The parent (`TranslationTab`) owns the open/close state.
 *
 * Step (a) — preset picker: shows all `PROVIDER_PRESETS` (9 entries) as
 * clickable rows. Clicking one moves to step (b) with `name` + `baseUrl`
 * prefilled.
 *
 * Step (b) — form: a `<ProviderForm>` pre-filled with the preset values.
 *   • `formProvider="openai"` — all custom providers are OpenAI-compatible.
 *   • `apiKeyMasked={false}` — new profile, no saved key yet.
 *   • Cancel → Back button returns to step (a).
 *   • Save → builds a `TranslatorProfile`, calls `onAdd(profile)` + `onClose()`.
 *
 * Props: `{ isOpen, onClose, onAdd }` — no `useSettings()` / `apiClient` here.
 * Wiring happens in Task 5 (`TranslationTab`).
 */

import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { X, ChevronLeft } from "@tamagui/lucide-icons";
import {
  GlassCard,
  ButtonGhost,
  IconButton,
  TitleSm,
  BodySm,
  Caption,
} from "@yt-subtitle-maker/ui";
import type { TranslatorProfile } from "@yt-subtitle-maker/api-client";
import { PROVIDER_PRESETS } from "./ProviderRow";
import { ProviderForm } from "./ProviderForm";

// ─── Public interface ────────────────────────────────────────────────────────

export interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the completed profile when the user clicks Save. */
  onAdd: (profile: TranslatorProfile) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Generates a stable, unique id for each new custom profile. */
function generateProfileId(): string {
  return "custom-" + Date.now().toString(36);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AddProviderModal({ isOpen, onClose, onAdd }: AddProviderModalProps) {
  const [step, setStep] = React.useState<"pick" | "form">("pick");
  const [preset, setPreset] = React.useState<{ name: string; baseUrl: string } | null>(null);
  // Generate a stable id once per open so the form always has a consistent
  // profileId (even if the user clicks Back → re-picks a different preset).
  const [newId, setNewId] = React.useState(() => generateProfileId());

  // Reset to the preset-picker step every time the modal opens.
  React.useEffect(() => {
    if (isOpen) {
      setStep("pick");
      setPreset(null);
      setNewId(generateProfileId());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // ── Step handlers ──────────────────────────────────────────────────────────

  const handlePickPreset = (p: { name: string; baseUrl: string }) => {
    setPreset(p);
    setStep("form");
  };

  const handleBack = () => {
    setStep("pick");
    // Keep preset so re-visiting the same preset re-populates form.
  };

  const handleSave = (patch: {
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
  }) => {
    const profile: TranslatorProfile = {
      id: newId,
      name: patch.name || preset?.name || "Custom",
      baseUrl: patch.baseUrl,
      apiKey: patch.apiKey,
      model: patch.model,
    };
    onAdd(profile);
    onClose();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        {/* Header row: title + (back button on form step) + close X */}
        <XStack alignItems="center" gap="$sm">
          {step === "form" ? (
            <IconButton
              icon={<ChevronLeft size={16} color="$textSecondary" />}
              size={44}
              aria-label="Back to provider list"
              onPress={handleBack}
            />
          ) : null}

          <TitleSm flex={1}>
            {step === "pick"
              ? "Choose a provider"
              : `Configure ${preset?.name || "provider"}`}
          </TitleSm>

          <IconButton
            icon={<X size={16} color="$textSecondary" />}
            size={44}
            aria-label="Close"
            onPress={onClose}
          />
        </XStack>

        {/* ── Step (a): Preset picker ─────────────────────────────────────── */}
        {step === "pick" ? (
          <YStack gap="$xs">
            {PROVIDER_PRESETS.map((p) => (
              <Stack
                key={p.label}
                tag="button"
                role="button"
                paddingHorizontal="$md"
                paddingVertical="$sm"
                borderRadius="$md"
                backgroundColor="$surfaceGlass"
                borderWidth={1}
                borderColor="$borderSubtle"
                hoverStyle={{ backgroundColor: "$surfaceGlassHover" }}
                pressStyle={{ scale: 0.98 }}
                animation="quick"
                cursor="pointer"
                onPress={() => handlePickPreset({ name: p.name, baseUrl: p.baseUrl })}
              >
                <XStack alignItems="center" gap="$sm">
                  <YStack flex={1} gap={2}>
                    <BodySm>{p.label}</BodySm>
                    {p.baseUrl ? (
                      <Caption color="$textSecondary">{p.baseUrl}</Caption>
                    ) : (
                      <Caption color="$textMuted">Enter your own endpoint</Caption>
                    )}
                  </YStack>
                </XStack>
              </Stack>
            ))}
          </YStack>
        ) : (
          /* ── Step (b): ProviderForm pre-filled with preset values ─────── */
          <ProviderForm
            profileId={newId}
            initialName={preset?.name ?? ""}
            initialBaseUrl={preset?.baseUrl ?? ""}
            initialModel=""
            apiKeyMasked={false}
            formProvider="openai"
            onSave={handleSave}
            onCancel={handleBack}
          />
        )}
      </YStack>
    </GlassCard>
  );
}
