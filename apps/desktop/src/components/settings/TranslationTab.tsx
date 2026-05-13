import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { Plus } from "@tamagui/lucide-icons";
import {
  GlassCard,
  Dropdown,
  Toggle,
  BadgePill,
  Caption,
} from "@yt-subtitle-maker/ui";
import type {
  AppConfig,
  TranslatorProfile,
} from "@yt-subtitle-maker/api-client";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { LANGS, isMasked } from "./constants";
import { ProviderRow, type ProviderRowSavePayload } from "./ProviderRow";
import { AddProviderModal } from "./AddProviderModal";

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Given the `activeTranslator` selector string ("gemini" | "local_openai" |
 * "custom:<id>"), return the short profile id used as a key in
 * `lastTestResult` and for `isActive` comparisons against custom rows.
 */
function activeProfileId(activeTranslator: string | undefined): string {
  if (!activeTranslator) return "gemini";
  if (activeTranslator.startsWith("custom:")) return activeTranslator.slice(7);
  return activeTranslator; // "gemini" | "local_openai"
}

// ─── Built-in profile shapes (derived from draft) ───────────────────────────

function geminiProfile(draft: AppConfig) {
  return {
    profileId: "gemini",
    name: "Gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    model: draft.geminiModel ?? "",
    apiKeyMasked: isMasked(draft.geminiApiKey),
  };
}

function localOpenaiProfile(draft: AppConfig) {
  return {
    profileId: "local_openai",
    name: "Local AI (LM Studio / Ollama)",
    baseUrl: draft.localOpenaiBaseUrl ?? "",
    model: draft.localOpenaiModel ?? "",
    apiKeyMasked: isMasked(draft.localOpenaiApiKey),
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TranslationTab() {
  const {
    draft,
    update,
    customTranslators,
    activeTranslator,
    lastTestResult,
    testProfile,
    testAdhoc,
    setActiveTranslator,
    addCustomTranslator,
    removeCustomTranslator,
    updateCustomTranslator,
  } = useSettings();

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  // Per-profile delete-guard: id of the profile the user tried to delete
  // while it was active. Cleared on next action.
  const [deleteGuardId, setDeleteGuardId] = React.useState<string | null>(null);

  if (!draft) return null;

  const currentProfileId = activeProfileId(activeTranslator);

  // Safety banner: active profile's last test failed
  const activeLastTest = lastTestResult[currentProfileId];
  const showBanner = activeLastTest && !activeLastTest.ok;

  // ── Built-in row handlers ──────────────────────────────────────────────

  const handleSaveGemini = (patch: ProviderRowSavePayload) => {
    // Only apiKey + model are editable for Gemini built-in; name + baseUrl
    // are ignored (Gemini has a fixed endpoint).
    if (patch.apiKey !== "***") {
      // The user replaced the key (or cleared it).
      update("geminiApiKey", patch.apiKey);
    }
    update("geminiModel", patch.model);
    setEditingId(null);
  };

  const handleSaveLocalOpenai = (patch: ProviderRowSavePayload) => {
    update("localOpenaiBaseUrl", patch.baseUrl);
    update("localOpenaiModel", patch.model);
    if (patch.apiKey !== "***") {
      update("localOpenaiApiKey", patch.apiKey);
    }
    setEditingId(null);
  };

  // ── Custom profile handlers ────────────────────────────────────────────

  const handleSaveCustom =
    (profileId: string) => (patch: ProviderRowSavePayload) => {
      // For custom profiles, "***" means "keep saved key" — skip the apiKey
      // update so the saved value survives the autosave round-trip. (The
      // backend also re-masks incoming "***" as a defensive measure, but the
      // cleanest path is to omit it from the patch entirely.)
      const cleanPatch: Partial<TranslatorProfile> = {
        name: patch.name,
        baseUrl: patch.baseUrl,
        model: patch.model,
      };
      if (patch.apiKey !== "***") {
        cleanPatch.apiKey = patch.apiKey;
      }
      updateCustomTranslator(profileId, cleanPatch);
      setEditingId(null);
    };

  const handleDuplicate = (profile: TranslatorProfile) => {
    const newId = "custom-" + Date.now().toString(36);
    addCustomTranslator({
      ...profile,
      id: newId,
      name: profile.name + " (copy)",
    });
  };

  const handleDeleteCustom = (profileId: string) => {
    if (currentProfileId === profileId) {
      // Refuse + nudge: render an inline BadgePill above the row.
      setDeleteGuardId(profileId);
      return;
    }
    setDeleteGuardId(null);
    removeCustomTranslator(profileId);
  };

  const profiles = customTranslators ?? [];

  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="Translation" />

        {/* Safety banner — active profile's last test failed */}
        {showBanner ? (
          <BadgePill tone="warning">
            <Caption>
              Translation may fail — {currentProfileId}&apos;s last test
              failed{activeLastTest.error ? `: ${activeLastTest.error}` : ""}
            </Caption>
          </BadgePill>
        ) : null}

        {/* Provider list */}
        <Section
          title="Translation provider"
          subtitle="Choose which service translates your subtitles. Built-in providers can't be deleted."
        />

        <YStack gap="$sm">
          {/* Gemini (built-in) */}
          <ProviderRow
            {...geminiProfile(draft)}
            formProvider="gemini"
            targetLang={draft.defaultTargetLang}
            isActive={currentProfileId === "gemini"}
            isBuiltIn
            isEditing={editingId === "gemini"}
            lastTest={lastTestResult["gemini"]}
            onActivate={() => setActiveTranslator("gemini")}
            onTest={async () => {
              await testAdhoc({
                provider: "gemini",
                apiKey: draft.geminiApiKey,
                model: draft.geminiModel,
                targetLang: draft.defaultTargetLang,
              });
            }}
            onEditToggle={() =>
              setEditingId((v) => (v === "gemini" ? null : "gemini"))
            }
            onSave={handleSaveGemini}
            onCancelEdit={() => setEditingId(null)}
          />

          {/* Local AI (built-in) */}
          <ProviderRow
            {...localOpenaiProfile(draft)}
            formProvider="local_openai"
            targetLang={draft.defaultTargetLang}
            isActive={currentProfileId === "local_openai"}
            isBuiltIn
            isEditing={editingId === "local_openai"}
            lastTest={lastTestResult["local_openai"]}
            onActivate={() => setActiveTranslator("local_openai")}
            onTest={async () => {
              await testAdhoc({
                provider: "local_openai",
                baseUrl: draft.localOpenaiBaseUrl,
                apiKey: draft.localOpenaiApiKey,
                model: draft.localOpenaiModel,
                targetLang: draft.defaultTargetLang,
              });
            }}
            onEditToggle={() =>
              setEditingId((v) =>
                v === "local_openai" ? null : "local_openai",
              )
            }
            onSave={handleSaveLocalOpenai}
            onCancelEdit={() => setEditingId(null)}
          />

          {/* Custom profiles */}
          {profiles.map((profile) => (
            <YStack key={profile.id} gap="$xs">
              {deleteGuardId === profile.id ? (
                <BadgePill tone="warning">
                  <Caption>
                    This is the active translator. Make another provider
                    active first, then delete this one.
                  </Caption>
                </BadgePill>
              ) : null}
              <ProviderRow
                profileId={profile.id}
                name={profile.name}
                baseUrl={profile.baseUrl}
                model={profile.model}
                apiKeyMasked={isMasked(profile.apiKey)}
                formProvider="openai"
                targetLang={draft.defaultTargetLang}
                isActive={currentProfileId === profile.id}
                isBuiltIn={false}
                isEditing={editingId === profile.id}
                lastTest={lastTestResult[profile.id]}
                onActivate={() =>
                  setActiveTranslator(`custom:${profile.id}`)
                }
                onTest={async () => {
                  await testProfile(profile.id);
                }}
                onEditToggle={() =>
                  setEditingId((v) => (v === profile.id ? null : profile.id))
                }
                onDuplicate={() => handleDuplicate(profile)}
                onDelete={() => handleDeleteCustom(profile.id)}
                onSave={handleSaveCustom(profile.id)}
                onCancelEdit={() => {
                  setEditingId(null);
                  setDeleteGuardId(null);
                }}
              />
            </YStack>
          ))}

          {/* + Add provider */}
          {!addOpen ? (
            <Stack
              tag="button"
              role="button"
              paddingHorizontal="$md"
              paddingVertical="$sm"
              borderRadius="$lg"
              backgroundColor="transparent"
              borderWidth={1}
              borderColor="$borderSubtle"
              borderStyle="dashed"
              alignItems="center"
              justifyContent="center"
              hoverStyle={{ backgroundColor: "$surfaceGlass" }}
              cursor="pointer"
              onPress={() => setAddOpen(true)}
            >
              <XStack gap="$xs" alignItems="center">
                <Plus size={14} color="$textSecondary" />
                <Caption color="$textSecondary">Add provider</Caption>
              </XStack>
            </Stack>
          ) : null}
        </YStack>

        {/* Add provider modal (inline) */}
        <AddProviderModal
          isOpen={addOpen}
          onClose={() => setAddOpen(false)}
          onAdd={(profile) => {
            addCustomTranslator(profile);
            setActiveTranslator(`custom:${profile.id}`);
          }}
        />

        {/* Unchanged setting rows */}
        <SettingRow id="translation.target-lang" label="Default target language">
          <Dropdown
            value={draft.defaultTargetLang}
            onValueChange={(v) => update("defaultTargetLang", v)}
            options={LANGS}
            width="100%"
          />
        </SettingRow>

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
      </YStack>
    </GlassCard>
  );
}
