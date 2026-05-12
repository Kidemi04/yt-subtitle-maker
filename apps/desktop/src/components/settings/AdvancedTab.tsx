import * as React from "react";
import { XStack, YStack } from "tamagui";
import { GlassCard, TextInput, ButtonSecondary, ButtonGhost, StatusDot, BodySm } from "@yt-subtitle-maker/ui";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";

export function AdvancedTab() {
  const { draft, update, setConfig, setDraft, setError, backendStatus, testBackend } = useSettings();
  if (!draft) return null;
  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="Advanced" />
        <SettingRow id="advanced.backend-url" label="Backend URL" helper="Default 127.0.0.1:8000. Change for V2 ngrok tunneling.">
          <XStack gap="$sm" alignItems="center">
            <TextInput flex={1} value={draft.backendUrl} onChangeText={(v: string) => update("backendUrl", v)} />
            <ButtonSecondary onPress={testBackend}>Test</ButtonSecondary>
            <StatusDot status={backendStatus} size={8} />
          </XStack>
        </SettingRow>
        <SettingRow id="advanced.reset-all" label="Reset all to defaults" helper="Danger zone — overwrites your saved config with the shipped defaults.">
          <XStack>
            <ButtonGhost
              onPress={async () => {
                if (typeof window !== "undefined" && !window.confirm("Reset every setting to its default? This overwrites your saved config and can't be undone.")) return;
                try {
                  const next = await apiClient.resetConfig();
                  setConfig(next);
                  setDraft(next);
                  apiClient.setBaseUrl(next.backendUrl);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                }
              }}
            >
              <BodySm fontWeight="500" color="$error">Reset all to defaults</BodySm>
            </ButtonGhost>
          </XStack>
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
