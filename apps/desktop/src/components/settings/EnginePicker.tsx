import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import {
  Cpu,
  Gauge,
  HardDrive,
  Info,
  Lock,
  Sparkles,
} from "@tamagui/lucide-icons";
import {
  BadgePill,
  BodySm,
  ButtonGhost,
  ButtonSecondary,
  Caption,
  CaptionUpper,
  ProgressBar,
  RadioCard,
  StatusDot,
  TitleMd,
  TitleSm,
} from "@yt-subtitle-maker/ui";
import type {
  AppConfig,
  EngineDescriptor,
  EnginePerformanceProfile,
  SystemReport,
} from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { bestEngine, engineVerdict, type VerdictLevel } from "./engineVerdict";
import { EngineTunables } from "./EngineTunables";
import { ModelRow } from "./ModelRow";

interface Props {
  engines: EngineDescriptor[];
  system: SystemReport;
  selectedEngineId: string;
  onSelectEngine: (engineId: string) => void;
  draft: AppConfig;
  update: <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void;
  refreshEngines: () => Promise<void>;
}

function formatSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

function verdictTone(level: VerdictLevel): "success" | "warning" | "error" | "neutral" {
  if (level === "works") return "success";
  if (level === "runs-no-accel") return "warning";
  if (level === "wont-help") return "error";
  return "neutral";
}

function acceleratorLabel(system: SystemReport): string {
  if (system.gpu.mpsAvailable) return "Apple MPS";
  if (system.gpu.cudaAvailable) return "NVIDIA CUDA";
  if (system.gpu.name) return system.gpu.name;
  return "CPU only";
}

function machineLabel(system: SystemReport): string {
  return `${system.os} ${system.arch}`;
}

function requirementLabel(engine: EngineDescriptor): string {
  const platforms = engine.requirements.platform.join(", ") || "any platform";
  const accelerators =
    engine.requirements.accelerators.join(", ") || "no accelerator requirement";
  return `${platforms}, ${accelerators}`;
}

function platformLabel(platform: string): string {
  if (platform === "macos") return "macOS";
  if (platform === "windows") return "Windows";
  if (platform === "linux") return "Linux";
  return platform;
}

function acceleratorName(accelerator: string): string {
  if (accelerator === "cpu") return "CPU";
  if (accelerator === "nvidia_cuda") return "NVIDIA CUDA";
  if (accelerator === "apple_mps") return "Apple MPS";
  return accelerator;
}

function supportSummary(
  engine: EngineDescriptor,
  system: SystemReport,
): {
  tone: "success" | "warning" | "error" | "neutral";
  label: string;
} {
  const platformOk = engine.requirements.platform.includes(system.os);
  if (!platformOk) {
    const platforms = engine.requirements.platform.map(platformLabel).join("/");
    return { tone: "error", label: `${platforms} only` };
  }

  const accelerators = engine.requirements.accelerators;
  if (system.gpu.cudaAvailable && accelerators.includes("nvidia_cuda")) {
    return { tone: "success", label: "CUDA acceleration detected" };
  }
  if (system.gpu.mpsAvailable && accelerators.includes("apple_mps")) {
    return { tone: "success", label: "Apple MPS detected" };
  }
  if (accelerators.includes("cpu")) {
    return { tone: "warning", label: "Runs here, CPU path available" };
  }
  return { tone: "error", label: "Required GPU not detected" };
}

const PERFORMANCE_FALLBACKS: Record<string, EnginePerformanceProfile> = {
  "openai-whisper": {
    speed: "Baseline speed",
    bestFor: "Reliable default, broad compatibility, simple setup",
    tradeoff: "Usually slower than optimized add-ons on the same hardware",
    hardware: "CPU everywhere. GPU depends on the local PyTorch install.",
  },
  "faster-whisper": {
    speed: "Fast on CPU, very fast on CUDA",
    bestFor: "Long videos, batch jobs, everyday local transcription",
    tradeoff: "Needs CTranslate2 runtime; adapter work is still pending here",
    hardware: "CPU works. NVIDIA CUDA gives the biggest speed-up.",
  },
  whisperx: {
    speed: "Medium for raw transcription, slower with alignment",
    bestFor: "Word-level timestamps, alignment, diarisation workflows",
    tradeoff: "Heavier install and more moving parts than plain Whisper",
    hardware: "Best on NVIDIA CUDA. CPU works for smaller jobs.",
  },
  "insanely-fast-whisper": {
    speed: "Very fast on Apple Silicon",
    bestFor: "Mac M-series users who want maximum local speed",
    tradeoff: "Narrow platform target; useful only on supported Apple Silicon setups",
    hardware: "Built for Apple MPS on macOS arm64.",
  },
  "whisper-cpp": {
    speed: "Good CPU speed, low memory",
    bestFor: "Portable local runs, older laptops, offline CPU workflows",
    tradeoff: "Uses GGML/GGUF-style model assets; adapter and model mapping are pending",
    hardware: "CPU-first. Native builds can use more backends, but this app has not wired them yet.",
  },
  "mlx-whisper": {
    speed: "Fast on Apple Silicon",
    bestFor: "Mac M-series users who prefer Apple's MLX stack",
    tradeoff: "macOS arm64 only; not useful on Windows or Linux",
    hardware: "Apple Silicon acceleration through MLX.",
  },
  "stable-ts": {
    speed: "Baseline to medium, depends on Whisper backend",
    bestFor: "Cleaner timestamps, fewer hallucinated silence segments, subtitle timing polish",
    tradeoff: "More processing choices and slower setup than plain OpenAI Whisper",
    hardware: "CPU works. CUDA can help when the underlying Whisper backend supports it.",
  },
};

function performanceProfile(
  engine: EngineDescriptor,
): EnginePerformanceProfile | undefined {
  return engine.performance ?? PERFORMANCE_FALLBACKS[engine.id];
}

function StatTile({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <YStack
      flex={1}
      minWidth={160}
      gap={2}
      padding="$sm"
      borderRadius="$md"
      backgroundColor="$bgBase"
      borderWidth={1}
      borderColor="$borderSubtle"
    >
      <CaptionUpper>{label}</CaptionUpper>
      <TitleSm>{value}</TitleSm>
      <Caption color="$textMuted">{helper}</Caption>
    </YStack>
  );
}

function EmptyEngineState() {
  return (
    <YStack
      gap="$sm"
      padding="$md"
      borderRadius="$md"
      backgroundColor="$bgBase"
      borderWidth={1}
      borderColor="$borderSubtle"
    >
      <XStack alignItems="center" gap="$sm">
        <Lock size={18} color="$warning" />
        <TitleSm>No local transcription engine is available</TitleSm>
      </XStack>
      <BodySm color="$textSecondary">
        You can still use YouTube captions only. Local Whisper transcription
        needs an available engine and at least one installed model.
      </BodySm>
    </YStack>
  );
}

function EngineChoiceCard({
  engine,
  system,
  selected,
  configuredDefault,
  onPress,
}: {
  engine: EngineDescriptor;
  system: SystemReport;
  selected: boolean;
  configuredDefault: boolean;
  onPress: () => void;
}) {
  const verdict = engineVerdict(engine, system);
  const support = supportSummary(engine, system);
  const installedModels = engine.models.filter((model) => model.downloaded);
  const variantsCount = engine.modelVariants?.length ?? engine.models.length;
  const installed = Boolean(engine.installed);

  return (
    <RadioCard
      selected={selected}
      onPress={onPress}
      flexGrow={1}
      flexBasis={300}
      minWidth={280}
      alignItems="flex-start"
    >
      <YStack flex={1} minWidth={0} gap="$xs">
        <XStack alignItems="center" gap="$sm" flexWrap="wrap">
          <TitleSm color={selected ? "$accent" : "$text"}>
            {engine.label}
          </TitleSm>
          {configuredDefault ? (
            <BadgePill tone="accent">Default engine</BadgePill>
          ) : null}
          {engine.available ? (
            <BadgePill tone={verdictTone(verdict.level)}>
              {verdict.line}
            </BadgePill>
          ) : (
            <BadgePill tone={installed ? "success" : support.tone}>
              {installed ? "Package installed" : "Add-on preview"}
            </BadgePill>
          )}
        </XStack>

        <XStack gap="$md" flexWrap="wrap">
          <XStack alignItems="center" gap="$xs">
            <HardDrive size={14} color="$textMuted" />
            <Caption color="$textSecondary">
              {engine.available
                ? `${installedModels.length} / ${engine.models.length} installed`
                : `${variantsCount} variants`}
            </Caption>
          </XStack>
          <XStack alignItems="center" gap="$xs">
            <Cpu size={14} color="$textMuted" />
            <Caption color="$textSecondary">
              {engine.available ? requirementLabel(engine) : support.label}
            </Caption>
          </XStack>
        </XStack>

        {engine.note ? (
          <Caption color="$textMuted" numberOfLines={2}>
            {engine.note}
          </Caption>
        ) : null}
      </YStack>
    </RadioCard>
  );
}

function VariantPreviewCard({
  name,
  sizeMb,
  note,
  selected,
  onPress,
}: {
  name: string;
  sizeMb?: number | null;
  note?: string | null;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Stack
      tag="button"
      role="radio"
      aria-checked={selected}
      flexGrow={1}
      flexBasis={180}
      minWidth={150}
      padding="$sm"
      borderRadius="$md"
      backgroundColor={selected ? "$accentSoft" : "$bgBase"}
      borderWidth={1}
      borderColor={selected ? "$accent" : "$borderSubtle"}
      cursor="pointer"
      hoverStyle={selected ? undefined : { borderColor: "$borderStrong" }}
      pressStyle={{ scale: 0.99 }}
      animation="quick"
      onPress={onPress}
    >
      <YStack gap={2}>
        <XStack alignItems="center" gap="$xs" flexWrap="wrap">
          <TitleSm color={selected ? "$accent" : "$text"}>{name}</TitleSm>
          {selected ? <BadgePill tone="accent">Preview</BadgePill> : null}
        </XStack>
        <Caption color="$textSecondary">
          {sizeMb ? formatSize(sizeMb) : "Size depends on model source"}
        </Caption>
        {note ? (
          <Caption color="$textMuted" numberOfLines={2}>
            {note}
          </Caption>
        ) : null}
      </YStack>
    </Stack>
  );
}

type AddonInstallState = "idle" | "installing" | "done" | "error";

function AddonEngineDetails({
  engine,
  system,
  refreshEngines,
  selectedVariant,
  onSelectVariant,
}: {
  engine: EngineDescriptor;
  system: SystemReport;
  refreshEngines: () => Promise<void>;
  selectedVariant: string | undefined;
  onSelectVariant: (name: string) => void;
}) {
  const [installState, setInstallState] =
    React.useState<AddonInstallState>("idle");
  const [progressMessage, setProgressMessage] = React.useState<string>();
  const [installError, setInstallError] = React.useState<string>();
  const abortRef = React.useRef<AbortController | null>(null);
  const support = supportSummary(engine, system);
  const performance = performanceProfile(engine);
  const platforms = engine.requirements.platform.map(platformLabel).join(", ");
  const accelerators = engine.requirements.accelerators
    .map(acceleratorName)
    .join(", ");
  const installed = Boolean(engine.installed) || installState === "done";
  const canInstall = Boolean(engine.installable) && !installed;
  const variants = engine.modelVariants ?? [];
  const activeVariant = selectedVariant ?? variants[0]?.name;

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const startInstall = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setInstallState("installing");
    setInstallError(undefined);
    setProgressMessage("Starting add-on install...");

    try {
      for await (const ev of apiClient.installEngine(engine.id, ctrl.signal)) {
        if (ctrl.signal.aborted) return;
        if (ev.status === "resolving" || ev.status === "installing") {
          setProgressMessage(ev.message);
        }
        if (ev.status === "done") {
          setProgressMessage(`${ev.packageName} installed`);
          setInstallState("done");
          await refreshEngines();
          return;
        }
        if (ev.status === "error") {
          setInstallError(ev.error);
          setInstallState("error");
          return;
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) {
        setInstallState("idle");
        setProgressMessage(undefined);
        return;
      }
      setInstallError(err instanceof Error ? err.message : String(err));
      setInstallState("error");
    }
  };

  const cancelInstall = () => {
    abortRef.current?.abort();
    setInstallState("idle");
    setProgressMessage(undefined);
  };

  return (
    <YStack
      gap="$sm"
      padding="$md"
      borderRadius="$lg"
      borderWidth={1}
      borderColor={installed ? "$success" : "$borderSubtle"}
      backgroundColor="$surfaceGlass"
    >
      <XStack alignItems="flex-start" gap="$sm" flexWrap="wrap">
        <Info size={18} color="$textMuted" />
        <YStack flex={1} minWidth={260} gap="$xs">
          <XStack alignItems="center" gap="$sm" flexWrap="wrap">
            <CaptionUpper>2. Choose variant</CaptionUpper>
            <BadgePill tone={installed ? "success" : support.tone}>
              {installed ? "Package installed" : support.label}
            </BadgePill>
            {engine.packageName ? (
              <BadgePill tone="neutral">{engine.packageName}</BadgePill>
            ) : null}
            <BadgePill tone="warning">Preview only</BadgePill>
          </XStack>
          <TitleMd>{engine.label} variants</TitleMd>
          <Caption color="$textSecondary">
            Pick the variant you want for this engine family. Add-ons can be
            inspected and installed here, but Generate only uses engines with a
            wired transcription adapter.
          </Caption>
        </YStack>
      </XStack>

      <XStack gap="$md" flexWrap="wrap">
        <YStack flex={1} minWidth={150} gap={2}>
          <CaptionUpper>Systems</CaptionUpper>
          <BodySm>{platforms}</BodySm>
        </YStack>
        <YStack flex={1} minWidth={180} gap={2}>
          <CaptionUpper>Device / GPU</CaptionUpper>
          <BodySm>{accelerators}</BodySm>
          {performance?.hardware ? (
            <Caption color="$textMuted">{performance.hardware}</Caption>
          ) : null}
        </YStack>
        <YStack flex={1} minWidth={180} gap={2}>
          <CaptionUpper>Performance</CaptionUpper>
          <BodySm>{performance?.speed ?? "Not benchmarked"}</BodySm>
        </YStack>
      </XStack>

      {variants.length > 0 ? (
        <XStack gap="$xs" flexWrap="wrap" role="radiogroup">
          {variants.map((variant) => (
            <VariantPreviewCard
              key={variant.name}
              name={variant.name}
              sizeMb={variant.sizeMb}
              note={variant.note}
              selected={variant.name === activeVariant}
              onPress={() => onSelectVariant(variant.name)}
            />
          ))}
        </XStack>
      ) : (
        <Caption color="$textMuted">
          This engine has no published variant list yet.
        </Caption>
      )}

      <XStack gap="$md" flexWrap="wrap">
        <YStack flex={1} minWidth={240} gap={2}>
          <CaptionUpper>Best for</CaptionUpper>
          <Caption color="$textSecondary">
            {performance?.bestFor ?? "General transcription"}
          </Caption>
        </YStack>
        <YStack flex={1} minWidth={240} gap={2}>
          <CaptionUpper>Trade-off</CaptionUpper>
          <Caption color="$textMuted">
            {performance?.tradeoff ?? "No extra trade-off listed."}
          </Caption>
        </YStack>
      </XStack>

      {installState === "installing" ? (
        <YStack gap="$xs">
          <ProgressBar value={0.35} />
          <Caption color="$textSecondary" numberOfLines={2}>
            {progressMessage ?? "Installing add-on..."}
          </Caption>
        </YStack>
      ) : null}

      {installError ? (
        <Caption color="$error">{installError}</Caption>
      ) : null}

      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$sm"
        flexWrap="wrap"
      >
        <Caption color="$textSecondary">
          {engine.packageSizeMb != null
            ? `Package size: ${formatSize(engine.packageSizeMb)}`
            : "Add-on package"}
        </Caption>
        <XStack gap="$xs">
          {installState === "installing" ? (
            <ButtonGhost onPress={cancelInstall} height={42}>
              Cancel
            </ButtonGhost>
          ) : null}
          {canInstall && installState !== "installing" ? (
            <ButtonSecondary onPress={startInstall} height={42}>
              {installState === "error" ? "Retry install" : "Install add-on"}
            </ButtonSecondary>
          ) : null}
        </XStack>
      </XStack>
    </YStack>
  );
}

function EnginePackageInstaller({
  engine,
  refreshEngines,
}: {
  engine: EngineDescriptor;
  refreshEngines: () => Promise<void>;
}) {
  const [installState, setInstallState] =
    React.useState<AddonInstallState>("idle");
  const [progressMessage, setProgressMessage] = React.useState<string>();
  const [installError, setInstallError] = React.useState<string>();
  const abortRef = React.useRef<AbortController | null>(null);
  const installed = Boolean(engine.installed) || installState === "done";

  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  if (!engine.installable || installed) return null;

  const startInstall = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setInstallState("installing");
    setInstallError(undefined);
    setProgressMessage("Starting engine install...");

    try {
      for await (const ev of apiClient.installEngine(engine.id, ctrl.signal)) {
        if (ctrl.signal.aborted) return;
        if (ev.status === "resolving" || ev.status === "installing") {
          setProgressMessage(ev.message);
        }
        if (ev.status === "done") {
          setProgressMessage(`${ev.packageName} installed`);
          setInstallState("done");
          await refreshEngines();
          return;
        }
        if (ev.status === "error") {
          setInstallError(ev.error);
          setInstallState("error");
          return;
        }
      }
    } catch (err) {
      if (ctrl.signal.aborted) {
        setInstallState("idle");
        setProgressMessage(undefined);
        return;
      }
      setInstallError(err instanceof Error ? err.message : String(err));
      setInstallState("error");
    }
  };

  const cancelInstall = () => {
    abortRef.current?.abort();
    setInstallState("idle");
    setProgressMessage(undefined);
  };

  return (
    <YStack
      gap="$xs"
      padding="$sm"
      borderRadius="$md"
      borderWidth={1}
      borderColor="$warning"
      backgroundColor="$bgBase"
    >
      <XStack alignItems="center" justifyContent="space-between" gap="$sm" flexWrap="wrap">
        <YStack flex={1} minWidth={220} gap={2}>
          <TitleSm>Install {engine.label} package</TitleSm>
          <Caption color="$textSecondary">
            {engine.packageName ?? engine.id} is required before Generate can use this engine.
          </Caption>
        </YStack>
        <XStack gap="$xs">
          {installState === "installing" ? (
            <ButtonGhost onPress={cancelInstall} height={42}>
              Cancel
            </ButtonGhost>
          ) : null}
          {installState !== "installing" ? (
            <ButtonSecondary onPress={startInstall} height={42}>
              {installState === "error" ? "Retry install" : "Install package"}
            </ButtonSecondary>
          ) : null}
        </XStack>
      </XStack>
      {installState === "installing" ? (
        <YStack gap="$xs">
          <ProgressBar value={0.35} />
          <Caption color="$textSecondary" numberOfLines={2}>
            {progressMessage ?? "Installing..."}
          </Caption>
        </YStack>
      ) : null}
      {installError ? <Caption color="$error">{installError}</Caption> : null}
    </YStack>
  );
}

export function EnginePicker({
  engines,
  system,
  selectedEngineId,
  onSelectEngine,
  draft,
  update,
  refreshEngines,
}: Props) {
  const selectableEngines = engines.filter(
    (engine) => engine.available && engine.selectable !== false,
  );
  const plannedEngines = engines.filter(
    (engine) => !engine.available || engine.selectable === false,
  );
  const best = bestEngine(selectableEngines, system);
  const selectedEngine =
    selectableEngines.find((engine) => engine.id === selectedEngineId) ??
    selectableEngines[0];
  const [previewEngineId, setPreviewEngineId] =
    React.useState(selectedEngineId);
  const [previewVariants, setPreviewVariants] = React.useState<
    Record<string, string>
  >({});

  React.useEffect(() => {
    if (selectedEngineId && engines.some((engine) => engine.id === selectedEngineId)) {
      setPreviewEngineId(selectedEngineId);
    }
  }, [engines, selectedEngineId]);

  const previewEngine =
    [...selectableEngines, ...plannedEngines].find((engine) => engine.id === previewEngineId) ??
    selectedEngine ??
    engines[0];
  const selectedModel = selectedEngine?.models.find(
    (model) => model.name === draft.defaultWhisperModel,
  );
  const selectedModelReady = Boolean(selectedModel?.downloaded);
  const previewInstalledModels =
    previewEngine?.models.filter((model) => model.downloaded) ?? [];
  const previewTotalModels = previewEngine?.models.length ?? 0;
  const previewCurrentModelReady = Boolean(
    previewEngine?.models.some(
      (model) => model.name === draft.defaultWhisperModel && model.downloaded,
    ),
  );

  const handleChooseEngine = (engine: EngineDescriptor) => {
    setPreviewEngineId(engine.id);
    if (!engine.available || engine.selectable === false) return;

    onSelectEngine(engine.id);
    const currentModel = engine.models.find(
      (model) => model.name === draft.defaultWhisperModel,
    );
    if (!currentModel?.downloaded) {
      const firstInstalled = engine.models.find((model) => model.downloaded);
      if (firstInstalled) update("defaultWhisperModel", firstInstalled.name);
    }
  };

  const handlePreviewVariant = (engineId: string, variant: string) => {
    setPreviewVariants((current) => ({ ...current, [engineId]: variant }));
  };

  return (
    <YStack gap="$md">
      <XStack
        alignItems="flex-start"
        justifyContent="space-between"
        gap="$md"
        flexWrap="wrap"
      >
        <XStack alignItems="flex-start" gap="$sm" flex={1} minWidth={280}>
          <Stack
            width={36}
            height={36}
            borderRadius="$md"
            alignItems="center"
            justifyContent="center"
            backgroundColor="$accentSoft"
            borderWidth={1}
            borderColor="$accentDim"
            flexShrink={0}
          >
            <Sparkles size={19} color="$accent" />
          </Stack>
          <YStack flex={1} minWidth={0} gap="$xs">
            <XStack alignItems="center" gap="$xs" flexWrap="wrap">
              <CaptionUpper>Engine recommendation</CaptionUpper>
              {best ? <BadgePill tone="accent">{best.label}</BadgePill> : null}
            </XStack>
            <TitleMd>Choose the engine first, then choose the variant</TitleMd>
            <BodySm color="$textSecondary">
              The engine decides runtime and hardware behavior. The variant
              decides checkpoint size, speed, accuracy, and disk usage.
            </BodySm>
          </YStack>
        </XStack>

        <XStack gap="$xs" flexWrap="wrap" justifyContent="flex-end" flex={1}>
          <StatTile
            label="Machine"
            value={machineLabel(system)}
            helper={acceleratorLabel(system)}
          />
          <StatTile
            label="Default engine"
            value={selectedEngine?.label ?? "None"}
            helper={
              selectedEngine
                ? engineVerdict(selectedEngine, system).line
                : "Use YouTube captions only until an engine is available."
            }
          />
          <StatTile
            label="Default model"
            value={draft.defaultWhisperModel || "None"}
            helper={
              selectedModelReady
                ? "Installed and ready for new jobs."
                : "Download this model before relying on it."
            }
          />
        </XStack>
      </XStack>

      {selectableEngines.length === 0 ? <EmptyEngineState /> : null}

      {engines.length > 0 ? (
        <YStack gap="$sm">
          <XStack alignItems="center" justifyContent="space-between" gap="$sm" flexWrap="wrap">
            <YStack gap={2}>
              <CaptionUpper>1. Choose model engine</CaptionUpper>
              <TitleMd>Engine / model family</TitleMd>
            </YStack>
            <XStack gap="$xs" flexWrap="wrap">
              <BadgePill tone="neutral">{machineLabel(system)}</BadgePill>
              <BadgePill
                tone={
                  system.gpu.cudaAvailable || system.gpu.mpsAvailable
                    ? "success"
                    : "warning"
                }
              >
                {acceleratorLabel(system)}
              </BadgePill>
            </XStack>
          </XStack>

          <XStack gap="$xs" flexWrap="wrap" role="radiogroup">
            {selectableEngines.map((engine) => (
              <EngineChoiceCard
                key={engine.id}
                engine={engine}
                system={system}
                selected={engine.id === previewEngine?.id}
                configuredDefault={engine.id === selectedEngine?.id}
                onPress={() => handleChooseEngine(engine)}
              />
            ))}
          </XStack>

          {plannedEngines.length > 0 ? (
            <YStack gap="$xs">
              <XStack alignItems="center" gap="$xs" flexWrap="wrap">
                <CaptionUpper>Planned engines</CaptionUpper>
                <BadgePill tone="neutral">{plannedEngines.length}</BadgePill>
              </XStack>
              <XStack gap="$xs" flexWrap="wrap">
                {plannedEngines.map((engine) => (
                  <EngineChoiceCard
                    key={engine.id}
                    engine={engine}
                    system={system}
                    selected={engine.id === previewEngine?.id}
                    configuredDefault={false}
                    onPress={() => handleChooseEngine(engine)}
                  />
                ))}
              </XStack>
            </YStack>
          ) : null}
        </YStack>
      ) : null}

      {previewEngine?.available ? (
        <YStack
          gap="$sm"
          padding="$md"
          borderRadius="$lg"
          backgroundColor="$surfaceGlass"
          borderWidth={1}
          borderColor="$borderSubtle"
        >
          <XStack alignItems="flex-start" gap="$sm" flexWrap="wrap">
            <Gauge size={18} color="$accent" />
            <YStack flex={1} minWidth={240} gap={2}>
              <CaptionUpper>2. Choose variant</CaptionUpper>
              <TitleMd>{previewEngine.label} variants</TitleMd>
              <Caption color="$textSecondary">
                {previewInstalledModels.length} installed,{" "}
                {previewTotalModels - previewInstalledModels.length} available
                to download.
              </Caption>
            </YStack>
            <XStack alignItems="center" gap="$xs">
              <StatusDot
                status={previewCurrentModelReady ? "ok" : "error"}
                size={8}
              />
              <Caption
                color={previewCurrentModelReady ? "$success" : "$warning"}
              >
                {previewCurrentModelReady
                  ? "Default variant is installed"
                  : "Default variant needs download"}
              </Caption>
            </XStack>
          </XStack>

          <EnginePackageInstaller
            engine={previewEngine}
            refreshEngines={refreshEngines}
          />

          <YStack gap="$xs">
            {previewEngine.models.map((model) => (
              <ModelRow
                key={model.name}
                model={model}
                engineId={previewEngine.id}
                selected={
                  draft.defaultWhisperModel === model.name &&
                  previewEngine.id === selectedEngine?.id &&
                  (model.downloaded || previewEngine.models.length === 1)
                }
                configuredDefault={
                  draft.defaultWhisperModel === model.name &&
                  previewEngine.id === selectedEngine?.id
                }
                onSelect={(name) => update("defaultWhisperModel", name)}
              />
            ))}
          </YStack>

          <EngineTunables
            tunables={previewEngine.tunables}
            draft={draft}
            update={update}
          />
        </YStack>
      ) : previewEngine ? (
        <AddonEngineDetails
          engine={previewEngine}
          system={system}
          refreshEngines={refreshEngines}
          selectedVariant={previewVariants[previewEngine.id]}
          onSelectVariant={(variant) =>
            handlePreviewVariant(previewEngine.id, variant)
          }
        />
      ) : null}
    </YStack>
  );
}
