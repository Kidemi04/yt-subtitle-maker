// apps/desktop/src/components/settings/EnginePicker.tsx
import * as React from "react";
import { XStack, YStack } from "tamagui";
import { RadioCard, BadgePill, Caption, TitleSm } from "@yt-subtitle-maker/ui";
import type { EngineDescriptor, SystemReport, AppConfig } from "@yt-subtitle-maker/api-client";
import { engineVerdict, bestEngine } from "./engineVerdict";
import { ModelRow } from "./ModelRow";
import { EngineTunables } from "./EngineTunables";

interface Props {
  engines: EngineDescriptor[];
  system: SystemReport;
  /** The currently-selected engine id in draft (may be "yt_captions"). */
  selectedEngineId: string;
  onSelectEngine: (engineId: string) => void;
  draft: AppConfig;
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
}

export function EnginePicker({
  engines,
  system,
  selectedEngineId,
  onSelectEngine,
  draft,
  update,
}: Props) {
  const best = bestEngine(engines, system);

  return (
    <YStack gap="$sm">
      {best ? (
        <Caption color="$textSecondary">
          Best for your machine: <Caption color="$text">{best.label}</Caption>
        </Caption>
      ) : null}

      {engines.map((engine) => {
        const verdict = engineVerdict(engine, system);
        const isSelected = engine.available && engine.id === selectedEngineId;
        const isDisabled = !engine.available;

        return (
          <RadioCard
            key={engine.id}
            selected={isSelected}
            disabled={isDisabled}
            onPress={isDisabled ? undefined : () => onSelectEngine(engine.id)}
          >
            <YStack flex={1} gap="$xs">
              {/* Header row */}
              <XStack alignItems="center" gap="$sm" flexWrap="wrap">
                <TitleSm color={isSelected ? "$accent" : isDisabled ? "$textMuted" : "$text"}>
                  {engine.label}
                </TitleSm>
                {/* Verdict badge — tone derived from the verdict level */}
                <BadgePill
                  tone={
                    verdict.level === "works"
                      ? "success"
                      : verdict.level === "runs-no-accel"
                      ? "warning"
                      : verdict.level === "wont-help"
                      ? "error"
                      : "neutral"
                  }
                >
                  {verdict.line}
                </BadgePill>
              </XStack>

              {/* Note for planned engines */}
              {engine.note ? (
                <Caption color="$textMuted">{engine.note}</Caption>
              ) : null}

              {/* Model catalog — only for available engines */}
              {engine.available && engine.models.length > 0 ? (
                <YStack gap="$xxs" marginTop="$xs">
                  {engine.models.map((model) => (
                    <ModelRow
                      key={model.name}
                      model={model}
                      engineId={engine.id}
                      selected={draft.defaultWhisperModel === model.name && isSelected}
                      onSelect={(name) => update("defaultWhisperModel", name)}
                    />
                  ))}
                </YStack>
              ) : null}

              {/* Per-engine tunables (dormant today — tunables: [] for all engines) */}
              {engine.available ? (
                <EngineTunables tunables={engine.tunables} draft={draft} update={update} />
              ) : null}
            </YStack>
          </RadioCard>
        );
      })}
    </YStack>
  );
}
