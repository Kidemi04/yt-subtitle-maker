import * as React from "react";
import { Stack, Text, XStack, type StackProps } from "tamagui";
import { Check } from "@tamagui/lucide-icons";
import { glassRecipes } from "../tokens";
import { ensureKeyframes } from "./keyframes";

/**
 * StepPill — multi-step progress indicator chip used in Screen 4
 * (Generate — Processing).
 *
 * Spec: docs/superpowers/design-handoff/README.md → Screen 4.
 *   shape   : $pill radius
 *   padding : $xs $md  (8 vertical, 16 horizontal)
 *   text    : Inter 13px / 500
 *
 *   done    : bg $surfaceGlass, border $success, text $success, ✓ left
 *   active  : bg $accentSoft,   border $accentDim, text $accent,
 *             pulsing 8px accent dot left (opacity 0.4↔1, 1s loop)
 *   pending : bg glassRecipes.glassLow.bg, border $borderSubtle,
 *             text $textMuted, ○ outline circle left
 *
 * Note on glassLow vs $surfaceGlass: Component Inventory consistently
 * distinguishes `glassLow` (recipe alpha 0.04) from `$surfaceGlass` (0.05).
 * "done" uses `$surfaceGlass`; "pending" uses `glassRecipes.glassLow.bg`.
 */
export type StepPillStatus = "done" | "active" | "pending";

export type StepPillProps = {
  status: StepPillStatus;
  children: React.ReactNode;
} & Omit<StackProps, "children">;

const VISUAL: Record<
  StepPillStatus,
  {
    bg: string;
    border: `$${string}` | string;
    color: `$${string}`;
  }
> = {
  done: {
    bg: "$surfaceGlass",
    border: "$success",
    color: "$success",
  },
  active: {
    bg: "$accentSoft",
    border: "$accentDim",
    color: "$accent",
  },
  pending: {
    bg: glassRecipes.glassLow.bg,
    border: "$borderSubtle",
    color: "$textMuted",
  },
};

function StatusIcon({ status }: { status: StepPillStatus }) {
  if (status === "done") {
    // lucide Check icon — colored via the token equivalent of $success.
    return <Check size={12} color="#5db872" strokeWidth={3} />;
  }
  if (status === "active") {
    // Soft/dim convention matches the container's $accentSoft/$accentDim
    // recipe so the dot reads as a brightening of the same surface, not a
    // foreign solid puck.
    return (
      <Stack
        width={8}
        height={8}
        borderRadius="$pill"
        backgroundColor="$accentSoft"
        borderWidth={1}
        borderColor="$accentDim"
        style={{
          animation: "yt-ui-pulse 1s cubic-bezier(0.4, 0, 0.2, 1) infinite",
        }}
      />
    );
  }
  // pending — outline circle (○) on the same glassLow surface as the pill
  // body, so the dot behaves like a small container ghost.
  return (
    <Stack
      width={8}
      height={8}
      borderRadius="$pill"
      borderWidth={1}
      borderColor="$borderSubtle"
      backgroundColor={glassRecipes.glassLow.bg}
    />
  );
}

export function StepPill({ status, children, ...rest }: StepPillProps) {
  React.useEffect(() => {
    ensureKeyframes();
  }, []);

  const v = VISUAL[status];

  return (
    <XStack
      paddingVertical="$xs"
      paddingHorizontal="$md"
      borderRadius="$pill"
      borderWidth={1}
      backgroundColor={v.bg}
      borderColor={v.border}
      alignItems="center"
      gap="$xs"
      {...rest}
    >
      <StatusIcon status={status} />
      <Text fontFamily="$body" fontSize={13} fontWeight="500" color={v.color}>
        {children}
      </Text>
    </XStack>
  );
}
