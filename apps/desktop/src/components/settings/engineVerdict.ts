// apps/desktop/src/components/settings/engineVerdict.ts
// Pure helpers — no React, no imports from the settings folder.
// Consumed by EnginePicker.tsx.
import type { EngineDescriptor, SystemReport } from "@yt-subtitle-maker/api-client";

export type VerdictLevel = "works" | "runs-no-accel" | "wont-help" | "unavailable";

export interface Verdict {
  level: VerdictLevel;
  line: string;
}

/**
 * Map a system GPU state to the accelerator tokens the backend uses in
 * `requirements.accelerators`. Order matters — mps before nvidia before cpu.
 */
function availableAccelerators(system: SystemReport): string[] {
  const acc: string[] = ["cpu"]; // cpu is always present
  if (system.gpu.mpsAvailable) acc.push("apple_mps");
  if (system.gpu.cudaAvailable) acc.push("nvidia_cuda");
  return acc;
}

/**
 * Compute the human-readable verdict for one engine on this machine.
 *
 * Logic:
 *  1. If `engine.available === false` → "unavailable" (show note + packageSizeMb).
 *  2. If `system.os` is not in `engine.requirements.platform` → "wont-help"
 *     (wrong OS — e.g. insanely-fast-whisper is macOS-only).
 *  3. If the engine's required accelerators are all present → "works"
 *     (e.g. openai-whisper needs only "cpu" — always works).
 *  4. If the engine needs a GPU accelerator that is NOT present but the engine
 *     still runs on cpu (cpu is in its accelerators) → "runs-no-accel".
 *  5. Otherwise → "wont-help" (engine needs a GPU that isn't here and has no
 *     cpu fallback — e.g. an MPS-only engine on a Linux box without MPS).
 */
export function engineVerdict(engine: EngineDescriptor, system: SystemReport): Verdict {
  if (!engine.available) {
    const sizePart = engine.packageSizeMb != null ? ` · ${(engine.packageSizeMb / 1024).toFixed(1)} GB add-on` : "";
    return {
      level: "unavailable",
      line: `Add-on / planned${sizePart}`,
    };
  }

  const required = engine.requirements;
  const myAccel = availableAccelerators(system);

  // Platform check
  if (required.platform.length > 0 && !required.platform.includes(system.os)) {
    const supported = required.platform.join(", ");
    return {
      level: "wont-help",
      line: `✗ won't help on this hardware (requires ${supported})`,
    };
  }

  // Accelerator check
  const hasAll = required.accelerators.every((a) => myAccel.includes(a));
  if (hasAll) {
    // Works — report which accelerator is active
    if (system.gpu.mpsAvailable && required.accelerators.includes("apple_mps")) {
      return { level: "works", line: "✓ works (Apple MPS)" };
    }
    if (system.gpu.cudaAvailable && required.accelerators.includes("nvidia_cuda")) {
      return { level: "works", line: "✓ works (NVIDIA CUDA)" };
    }
    return { level: "works", line: "✓ works (CPU)" };
  }

  // Not all accelerators present — does the engine still run on CPU?
  const hasCpuFallback = required.accelerators.includes("cpu");
  if (hasCpuFallback) {
    return {
      level: "runs-no-accel",
      line: "⚠ runs but no acceleration here (CPU only — install a GPU driver to speed up)",
    };
  }

  // Engine needs a GPU that isn't here and can't fall back to CPU
  const missing = required.accelerators.filter((a) => !myAccel.includes(a)).join(", ");
  return {
    level: "wont-help",
    line: `✗ won't help on this hardware (needs ${missing})`,
  };
}

/**
 * Return the first available engine for which verdict level is "works",
 * falling back to the first available engine (any verdict), or undefined
 * if there are no available engines at all.
 */
export function bestEngine(
  engines: EngineDescriptor[],
  system: SystemReport,
): EngineDescriptor | undefined {
  const available = engines.filter((e) => e.available);
  return (
    available.find((e) => engineVerdict(e, system).level === "works") ??
    available[0]
  );
}
