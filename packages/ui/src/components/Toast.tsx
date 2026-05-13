import * as React from "react";
import { Stack, Text, XStack } from "tamagui";
import { X } from "@tamagui/lucide-icons";
import { glassRecipes } from "../tokens";
import { IconButton } from "./IconButton";

/**
 * Toast — bottom-center transient notification.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory
 *       ("Bottom-center, glassHigh, slide-up entrance").
 *
 *   surface  : glassRecipes.glassHigh.bg + glassHigh blur + glassHigh shadow
 *   radius   : $md (12px)
 *   padding  : $sm $md
 *   entrance : opacity 0 + y 16, animation="quick" (slide-up)
 *   tone     : neutral (default), success, error — encoded by a leading
 *              status dot + a soft full-edge tone-tinted border. (DESIGN.md
 *              §6 explicitly bans border-left > 1px as a colored stripe;
 *              the sidebar active state is the one sanctioned exception.)
 *
 * The Toast renders an absolute-positioned bottom-center container so it
 * floats above page content. Caller controls visibility via `open`.
 */
export type ToastTone = "neutral" | "success" | "error";

export type ToastProps = {
  open: boolean;
  tone?: ToastTone;
  onClose?: () => void;
  /**
   * Distance from the bottom of the viewport in px. Defaults to 32. Allows
   * stacking multiple toasts without nesting absolute containers.
   */
  bottom?: number;
  children: React.ReactNode;
};

const TONE = {
  neutral: { dot: undefined, border: undefined },
  success: { dot: "$success", border: "rgba(93,184,114,0.30)" },
  error: { dot: "$error", border: "rgba(255,90,95,0.30)" },
} as const;

export function Toast({
  open,
  tone = "neutral",
  onClose,
  bottom = 32,
  children,
}: ToastProps) {
  if (!open) return null;

  const toneStyle = TONE[tone];

  return (
    <Stack
      position="absolute"
      bottom={bottom}
      left={0}
      right={0}
      alignItems="center"
      pointerEvents="box-none"
      zIndex={1000}
    >
      <XStack
        alignItems="center"
        gap="$sm"
        paddingVertical="$sm"
        paddingHorizontal="$md"
        borderRadius="$md"
        backgroundColor={glassRecipes.glassHigh.bg}
        borderWidth={1}
        borderColor={toneStyle.border ?? "$borderStrong"}
        animation="quick"
        enterStyle={{ opacity: 0, y: 16 }}
        exitStyle={{ opacity: 0, y: 16 }}
        style={{
          backdropFilter: glassRecipes.glassHigh.backdropFilter,
          WebkitBackdropFilter: glassRecipes.glassHigh.backdropFilter,
          boxShadow: glassRecipes.glassHigh.boxShadow,
        }}
      >
        {toneStyle.dot ? (
          <Stack
            width={8}
            height={8}
            borderRadius="$pill"
            backgroundColor={toneStyle.dot}
            flexShrink={0}
          />
        ) : null}
        <Text
          fontFamily="$body"
          fontSize={14}
          color="$textPrimary"
          flex={1}
        >
          {children}
        </Text>
        {onClose ? (
          <IconButton
            size={32}
            icon={<X size={14} color="#a1a1a6" />}
            aria-label="Dismiss notification"
            onPress={onClose}
          />
        ) : null}
      </XStack>
    </Stack>
  );
}
