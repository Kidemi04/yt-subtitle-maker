import * as React from "react";
import { YStack } from "tamagui";
import { GlassCard, Dropdown } from "@yt-subtitle-maker/ui";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { VERBOSITY } from "./constants";
import { ArmedField } from "./ArmedField";
import { isTauri, openDirectoryDialog } from "../../lib/native";
import type { AppConfig } from "@yt-subtitle-maker/api-client";

/**
 * Render an armed folder field with optional native "Browse…" secondary.
 * The validator calls `apiClient.checkFs({path, kind:"dir"})` and reports a
 * human reason on failure; `ArmedField`'s built-in "Apply anyway" handles the
 * "I know what I'm doing" escape hatch.
 */
function FolderField({
  field,
  placeholder,
}: {
  field: "outputDir" | "downloadDir" | "whisperCacheDir";
  placeholder?: string;
}) {
  const { draft, update, flush } = useSettings();
  if (!draft) return null;
  const value = (draft as AppConfig)[field] ?? "";

  return (
    <ArmedField
      value={value}
      placeholder={placeholder}
      validate={async (v) => {
        // Empty string is always OK — it means "fall back to default".
        if (!v.trim()) return { ok: true };
        try {
          const r = await apiClient.checkFs({ path: v, kind: "dir" });
          if (r.exists && r.isDir && r.writable) return { ok: true };
          if (!r.exists) return { ok: false, reason: `Path doesn't exist: ${v}` };
          if (!r.isDir) return { ok: false, reason: `Not a directory: ${v}` };
          return { ok: false, reason: `Directory isn't writable: ${v}` };
        } catch (err) {
          return {
            ok: false,
            reason: `Couldn't check the path: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      }}
      onApply={(v) => {
        update(field, v);
        flush();
      }}
      secondaryAction={
        isTauri()
          ? {
              label: "Browse…",
              onPress: async () => {
                const picked = await openDirectoryDialog({
                  defaultPath: value || placeholder,
                });
                if (picked) {
                  update(field, picked);
                  flush();
                }
              },
            }
          : undefined
      }
    />
  );
}

export function GeneralTab() {
  const { draft, update, defaults } = useSettings();
  if (!draft) return null;
  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section title="General" />
        <SettingRow
          id="general.output-dir"
          label="Output folder"
          helper="Where finished .srt files are written. Leave blank to use the default location."
        >
          <FolderField field="outputDir" placeholder={defaults?.outputDir || ""} />
        </SettingRow>
        <SettingRow
          id="general.download-dir"
          label="Download folder"
          helper="Where downloaded audio is kept. Leave blank to use the default location."
        >
          <FolderField field="downloadDir" placeholder={defaults?.downloadDir || ""} />
        </SettingRow>
        <SettingRow
          id="general.whisper-cache-dir"
          label="Whisper cache directory"
          helper="Where Whisper model weights are cached. Leave blank for the default."
        >
          <FolderField
            field="whisperCacheDir"
            placeholder={defaults?.whisperCacheDir || ""}
          />
        </SettingRow>
        <SettingRow id="general.logs-verbosity" label="Logs verbosity">
          <Dropdown
            value={draft.logsVerbosity}
            onValueChange={(v) =>
              update("logsVerbosity", v as typeof draft.logsVerbosity)
            }
            options={VERBOSITY}
            width={240}
          />
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
