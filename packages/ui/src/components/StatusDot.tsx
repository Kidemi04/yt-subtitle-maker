import * as React from "react";
import { Stack, type StackProps } from "tamagui";
import { ensureKeyframes } from "./keyframes";

/**
 * StatusDot — small colored dot used in sidebar / system-status rows.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Screen 13 + Component Inventory.
 *   size   : 6 / 8 / 10 (default 8) — circle, $pill radius
 *   ok     : $success, default pulse
 *   warning: $warning, no pulse
 *   error  : $error,   no pulse
 *   untested:$textMuted, no pulse
 *
 *   pulse  : opacity 0.5↔1.0, 1s loop (CSS keyframe `yt-ui-pulse`).
 *            Default `pulse` is true for `ok`, false otherwise. Override
 *            via the `pulse` prop.
 */
export type StatusDotStatus = "ok" | "warning" | "error" | "untested";

export type StatusDotProps = {
  status: StatusDotStatus;
  pulse?: boolean;
  size?: 6 | 8 | 10;
} & Omit<StackProps, "size">;

const COLOR: Record<StatusDotStatus, `$${string}`> = {
  ok: "$success",
  warning: "$warning",
  error: "$error",
  untested: "$textMuted",
};

export function StatusDot({
  status,
  pulse,
  size = 8,
  ...rest
}: StatusDotProps) {
  React.useEffect(() => {
    ensureKeyframes();
  }, []);

  const shouldPulse = pulse ?? status === "ok";

  return (
    <Stack
      width={size}
      height={size}
      borderRadius="$pill"
      backgroundColor={COLOR[status]}
      style={
        shouldPulse
          ? {
              animation:
                "yt-ui-pulse 1s cubic-bezier(0.4, 0, 0.2, 1) infinite",
            }
          : undefined
      }
      {...rest}
    />
  );
}
