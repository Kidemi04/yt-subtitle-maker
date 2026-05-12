import * as React from "react";
import { XStack, YStack } from "tamagui";
import { GlassCard, ButtonGhost, BodySm } from "@yt-subtitle-maker/ui";
import { ApiClient } from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { ArmedField } from "./ArmedField";

export function AdvancedTab() {
  const { draft, update, flush, setConfig, setDraft, setError } = useSettings();
  if (!draft) return null;
  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="Advanced" />
        <SettingRow id="advanced.backend-url" label="Backend URL" helper="The address the app talks to. Edit → it pings GET /api/version before applying. Default is 127.0.0.1:8000.">
          <ArmedField
            value={draft.backendUrl}
            placeholder="127.0.0.1:8000"
            validate={async (v) => {
              try {
                await new ApiClient(v).fetchVersion();
                return { ok: true };
              } catch (err) {
                return { ok: false, reason: `Couldn't reach a backend at "${v}": ${err instanceof Error ? err.message : String(err)}` };
              }
            }}
            onApply={(v) => {
              update("backendUrl", v);
              apiClient.setBaseUrl(v);
              flush();
            }}
            secondaryAction={{
              label: "Reset to 127.0.0.1:8000",
              onPress: () => {
                update("backendUrl", "127.0.0.1:8000");
                apiClient.setBaseUrl("127.0.0.1:8000");
                flush();
              },
            }}
          />
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
