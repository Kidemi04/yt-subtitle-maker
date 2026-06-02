import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { Check, ChevronLeft, Plus, X } from "@tamagui/lucide-icons";
import {
  BadgePill,
  BodySm,
  ButtonGhost,
  Caption,
  CaptionUpper,
  GlassCard,
  IconButton,
  TitleSm,
} from "@yt-subtitle-maker/ui";
import type { TranslatorProfile } from "@yt-subtitle-maker/api-client";
import { PROVIDER_PRESETS } from "./ProviderRow";
import { ProviderForm } from "./ProviderForm";

export interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (profile: TranslatorProfile) => void;
}

function generateProfileId(): string {
  return "custom-" + Date.now().toString(36);
}

export function AddProviderModal({
  isOpen,
  onClose,
  onAdd,
}: AddProviderModalProps) {
  const [step, setStep] = React.useState<"pick" | "form">("pick");
  const [preset, setPreset] = React.useState<{
    name: string;
    baseUrl: string;
    label: string;
    description: string;
  } | null>(null);
  const [newId, setNewId] = React.useState(() => generateProfileId());

  React.useEffect(() => {
    if (isOpen) {
      setStep("pick");
      setPreset(null);
      setNewId(generateProfileId());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePickPreset = (p: {
    label: string;
    name: string;
    baseUrl: string;
    description: string;
  }) => {
    setPreset(p);
    setStep("form");
  };

  const handleSave = (patch: {
    name: string;
    baseUrl: string;
    apiKey: string;
    model: string;
  }) => {
    onAdd({
      id: newId,
      name: patch.name || preset?.name || "Custom provider",
      baseUrl: patch.baseUrl,
      apiKey: patch.apiKey,
      model: patch.model,
    });
    onClose();
  };

  return (
    <GlassCard variant="high" padding="$lg">
      <YStack gap="$lg">
        <XStack alignItems="center" gap="$sm">
          {step === "form" ? (
            <IconButton
              icon={<ChevronLeft size={16} color="$textSecondary" />}
              size={44}
              aria-label="Back to provider list"
              onPress={() => setStep("pick")}
            />
          ) : (
            <Stack
              width={44}
              height={44}
              borderRadius="$pill"
              alignItems="center"
              justifyContent="center"
              backgroundColor="$accentSoft"
              borderWidth={1}
              borderColor="$accentDim"
            >
              <Plus size={18} color="$accent" />
            </Stack>
          )}

          <YStack flex={1} gap={2}>
            <CaptionUpper>
              {step === "pick" ? "New provider" : "Provider setup"}
            </CaptionUpper>
            <TitleSm>
              {step === "pick"
                ? "Choose a provider preset"
                : `Configure ${preset?.label || "provider"}`}
            </TitleSm>
            <Caption color="$textMuted">
              {step === "pick"
                ? "Pick a known OpenAI-compatible service, or start from a blank endpoint."
                : "Complete the fields below, test the connection, then save."}
            </Caption>
          </YStack>

          <IconButton
            icon={<X size={16} color="$textSecondary" />}
            size={44}
            aria-label="Close"
            onPress={onClose}
          />
        </XStack>

        {step === "pick" ? (
          <XStack gap="$sm" flexWrap="wrap">
            {PROVIDER_PRESETS.map((p) => {
              const isCustom = !p.baseUrl;
              return (
                <Stack
                  key={p.label}
                  tag="button"
                  role="button"
                  minWidth={240}
                  flex={1}
                  padding="$md"
                  borderRadius="$md"
                  backgroundColor="$bgBase"
                  borderWidth={1}
                  borderColor="$borderStrong"
                  hoverStyle={{ borderColor: "$accentDim", backgroundColor: "$accentSoft" }}
                  pressStyle={{ scale: 0.99 }}
                  animation="quick"
                  cursor="pointer"
                  onPress={() => handlePickPreset(p)}
                  aria-label={`Choose ${p.label}`}
                >
                  <YStack gap="$sm">
                    <XStack alignItems="center" justifyContent="space-between" gap="$sm">
                      <TitleSm>{p.label}</TitleSm>
                      <BadgePill tone={isCustom ? "neutral" : "accent"}>
                        {isCustom ? "Blank" : "Preset"}
                      </BadgePill>
                    </XStack>
                    <Caption color="$textSecondary" numberOfLines={2}>
                      {p.description}
                    </Caption>
                    {p.baseUrl ? (
                      <Caption color="$textMuted" numberOfLines={1}>
                        {p.baseUrl}
                      </Caption>
                    ) : null}
                    <XStack alignItems="center" gap="$xs">
                      <Check size={14} color="$textMuted" />
                      <BodySm color="$textSecondary">
                        Auto-fetch models after the API key is entered
                      </BodySm>
                    </XStack>
                  </YStack>
                </Stack>
              );
            })}
          </XStack>
        ) : (
          <ProviderForm
            profileId={newId}
            initialName={preset?.name ?? ""}
            initialBaseUrl={preset?.baseUrl ?? ""}
            initialModel=""
            apiKeyMasked={false}
            formProvider="openai"
            autoFetchModels
            autoFetchLabel={preset?.label}
            onSave={handleSave}
            onCancel={() => setStep("pick")}
          />
        )}

        {step === "pick" ? (
          <XStack justifyContent="flex-end">
            <ButtonGhost height={42} onPress={onClose}>
              Cancel
            </ButtonGhost>
          </XStack>
        ) : null}
      </YStack>
    </GlassCard>
  );
}
