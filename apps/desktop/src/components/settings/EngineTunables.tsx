// apps/desktop/src/components/settings/EngineTunables.tsx
// Renders per-engine tunables from the GET /api/engines descriptor.
// Today this always returns null because openai-whisper has tunables: [].
// When faster-whisper lands with real tunables, this renders them from the
// descriptor without any hardcoding:
//   type: "select"        → Dropdown
//   type: "bool"          → Toggle
//   type: "int"/"float"   → NumberStepper (local settings component from Phase 3)
//
// Each tunable calls `update(tunable.key as keyof AppConfig, value)`.
// KNOWN LIMITATION: the cast `tunable.key as keyof AppConfig` works once
// the backend adds those per-engine keys to AppConfig; until then the cast is
// intentional and documented here. The component is unreachable today
// (tunables: [] for all engines) so the cast is safe in practice.
import * as React from "react";
import { YStack } from "tamagui";
import { Dropdown, Toggle } from "@yt-subtitle-maker/ui";
import type { EngineTunable, AppConfig } from "@yt-subtitle-maker/api-client";
import { Section, SettingRow } from "./shared";
import { NumberStepper } from "./NumberStepper";

interface Props {
  tunables: EngineTunable[];
  draft: AppConfig;
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
}

export function EngineTunables({ tunables, draft, update }: Props) {
  // Returns null today — openai-whisper always emits tunables: [].
  // When a future engine ships tunables this renders them automatically.
  if (tunables.length === 0) return null;

  return (
    <YStack gap="$sm" marginTop="$sm">
      <Section title="Engine settings" subtitle="These settings are specific to this engine." />
      {tunables.map((t) => {
        const key = t.key as keyof AppConfig;
        const value = draft[key];

        if (t.type === "select" && t.choices) {
          return (
            <SettingRow
              key={t.key}
              id={`transcription.tunable.${t.key}`}
              label={t.label}
              helper={t.help}
            >
              <Dropdown
                value={String(value ?? t.default ?? "")}
                onValueChange={(v) => update(key, v as AppConfig[typeof key])}
                options={t.choices.map((c) => ({ label: c, value: c }))}
                width="100%"
              />
            </SettingRow>
          );
        }

        if (t.type === "bool") {
          return (
            <SettingRow
              key={t.key}
              layout="row"
              id={`transcription.tunable.${t.key}`}
              label={t.label}
              helper={t.help}
            >
              <Toggle
                value={Boolean(value ?? t.default)}
                onValueChange={(v) => update(key, v as AppConfig[typeof key])}
                aria-label={t.label}
              />
            </SettingRow>
          );
        }

        // int / float — use the Phase-3 NumberStepper component.
        // defaultSentinel=0 is a reasonable fallback; the actual default
        // from the tunable descriptor is shown as the stepper base.
        const numDefault =
          typeof t.default === "number" ? t.default : 0;
        const numValue =
          typeof value === "number" ? value : numDefault;
        return (
          <SettingRow
            key={t.key}
            id={`transcription.tunable.${t.key}`}
            label={t.label}
            helper={t.help}
          >
            <NumberStepper
              value={numValue}
              onValueChange={(n) => update(key, n as AppConfig[typeof key])}
              step={t.type === "float" ? 0.1 : 1}
              min={0}
              defaultSentinel={0}
              stepperBase={numDefault > 0 ? numDefault : 1}
              ariaLabel={t.label}
            />
          </SettingRow>
        );
      })}
    </YStack>
  );
}
