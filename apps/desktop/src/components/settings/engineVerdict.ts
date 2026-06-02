import type {
  EngineDescriptor,
  SystemReport,
} from "@yt-subtitle-maker/api-client";

export type VerdictLevel =
  | "works"
  | "runs-no-accel"
  | "wont-help"
  | "unavailable";

export interface Verdict {
  level: VerdictLevel;
  line: string;
}

function availableAccelerators(system: SystemReport): string[] {
  const accelerators = ["cpu"];
  if (system.gpu.mpsAvailable) accelerators.push("apple_mps");
  if (system.gpu.cudaAvailable) accelerators.push("nvidia_cuda");
  return accelerators;
}

function formatPackageSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function engineVerdict(
  engine: EngineDescriptor,
  system: SystemReport,
): Verdict {
  if (!engine.available) {
    const sizePart =
      engine.packageSizeMb != null
        ? `, ${formatPackageSize(engine.packageSizeMb)} add-on`
        : "";
    return {
      level: "unavailable",
      line: `Planned add-on${sizePart}`,
    };
  }

  const required = engine.requirements;
  const machineAccelerators = availableAccelerators(system);

  if (required.platform.length > 0 && !required.platform.includes(system.os)) {
    return {
      level: "wont-help",
      line: `Not useful on this hardware, requires ${required.platform.join(", ")}`,
    };
  }

  const hasAllAccelerators = required.accelerators.every((accelerator) =>
    machineAccelerators.includes(accelerator),
  );

  if (hasAllAccelerators) {
    if (
      system.gpu.mpsAvailable &&
      required.accelerators.includes("apple_mps")
    ) {
      return { level: "works", line: "Works with Apple MPS" };
    }
    if (
      system.gpu.cudaAvailable &&
      required.accelerators.includes("nvidia_cuda")
    ) {
      return { level: "works", line: "Works with NVIDIA CUDA" };
    }
    return { level: "works", line: "Works on CPU" };
  }

  if (required.accelerators.includes("cpu")) {
    return {
      level: "runs-no-accel",
      line: "Runs on CPU, no accelerator detected",
    };
  }

  const missing = required.accelerators
    .filter((accelerator) => !machineAccelerators.includes(accelerator))
    .join(", ");

  return {
    level: "wont-help",
    line: `Not useful on this hardware, needs ${missing}`,
  };
}

export function bestEngine(
  engines: EngineDescriptor[],
  system: SystemReport,
): EngineDescriptor | undefined {
  const available = engines.filter((engine) => engine.available);
  return (
    available.find(
      (engine) => engineVerdict(engine, system).level === "works",
    ) ?? available[0]
  );
}
