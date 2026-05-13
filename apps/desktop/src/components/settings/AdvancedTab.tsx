import * as React from "react";
import { XStack, YStack } from "tamagui";
import { GlassCard, ButtonGhost, ButtonSecondary, BodySm, Caption } from "@yt-subtitle-maker/ui";
import { ApiClient, type AppConfig } from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { ArmedField } from "./ArmedField";
import { openConfigFolder } from "../../lib/native";

export function AdvancedTab() {
  const { draft, config, update, flush, setConfig, setDraft, setError } = useSettings();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [importStatus, setImportStatus] = React.useState<string | null>(null);
  if (!draft) return null;

  const onExport = () => {
    const payload = JSON.stringify(config ?? draft, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "yt-subtitle-tool-settings.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const onImportPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<AppConfig>;
      // Strip non-config keys like `_defaults` that GET /api/config injects.
      const clean: Record<string, unknown> = { ...parsed };
      delete clean._defaults;
      const next = await apiClient.updateConfig(clean as Partial<AppConfig>);
      setConfig(next);
      setDraft(next);
      apiClient.setBaseUrl(next.backendUrl);
      setImportStatus(`Imported ${Object.keys(clean).length} fields.`);
    } catch (err) {
      setImportStatus(
        `Import failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  };

  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="Advanced" />
        <SettingRow
          id="advanced.backend-url"
          label="Backend URL"
          helper="The address the app talks to. Edit → it pings GET /api/version before applying. Default is 127.0.0.1:8000."
        >
          <ArmedField
            value={draft.backendUrl}
            placeholder="127.0.0.1:8000"
            validate={async (v) => {
              try {
                await new ApiClient(v).fetchVersion();
                return { ok: true };
              } catch (err) {
                return {
                  ok: false,
                  reason: `Couldn't reach a backend at "${v}": ${err instanceof Error ? err.message : String(err)}`,
                };
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

        <SettingRow
          id="advanced.open-config"
          label="Open config folder"
          helper="Reveal ~/.yt_subtitle_tool/ in your file manager."
        >
          <XStack>
            <ButtonSecondary
              onPress={async () => {
                const r = await openConfigFolder();
                if (!r.ok && typeof window !== "undefined") {
                  window.alert(`Couldn't open the folder: ${r.error ?? "unknown error"}`);
                }
              }}
            >
              <BodySm color="$textSecondary">Open config folder</BodySm>
            </ButtonSecondary>
          </XStack>
        </SettingRow>

        <SettingRow
          id="advanced.export-settings"
          label="Export settings"
          helper="Download all current settings as a JSON file."
        >
          <XStack>
            <ButtonSecondary onPress={onExport}>
              <BodySm color="$textSecondary">Export to JSON…</BodySm>
            </ButtonSecondary>
          </XStack>
        </SettingRow>

        <SettingRow
          id="advanced.import-settings"
          label="Import settings"
          helper="Load a JSON file previously exported. Replaces the corresponding fields."
        >
          <YStack gap="$xs">
            <XStack>
              <ButtonSecondary onPress={() => fileInputRef.current?.click()}>
                <BodySm color="$textSecondary">Import from JSON…</BodySm>
              </ButtonSecondary>
            </XStack>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={onImportPick}
              style={{ display: "none" }}
            />
            {importStatus ? <Caption color="$textSecondary">{importStatus}</Caption> : null}
          </YStack>
        </SettingRow>

        <SettingRow
          id="advanced.reset-all"
          label="Reset all to defaults"
          helper="Danger zone — overwrites your saved config with the shipped defaults."
        >
          <XStack>
            <ButtonGhost
              onPress={async () => {
                if (
                  typeof window !== "undefined" &&
                  !window.confirm(
                    "Reset every setting to its default? This overwrites your saved config and can't be undone.",
                  )
                )
                  return;
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
              <BodySm fontWeight="500" color="$error">
                Reset all to defaults
              </BodySm>
            </ButtonGhost>
          </XStack>
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
