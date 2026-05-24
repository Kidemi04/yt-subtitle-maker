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
 *   tone     : neutral (default), success ($success border-left 3px),
 *              error   ($error   border-left 3px)
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

const TONE_BORDER: Record<ToastTone, string | undefined> = {
  neutral: undefined,
  success: "$success",
  error: "$error",
};

export function Toast({
  open,
  tone = "neutral",
  onClose,
  bottom = 32,
  children,
}: ToastProps) {
  if (!open) return null;

  const borderLeftColor = TONE_BORDER[tone];

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
        borderColor="$borderStrong"
        borderLeftWidth={borderLeftColor ? 3 : 1}
        borderLeftColor={borderLeftColor ?? "$borderStrong"}
        animation="quick"
        enterStyle={{ opacity: 0, y: 16 }}
        exitStyle={{ opacity: 0, y: 16 }}
        style={{
          backdropFilter: glassRecipes.glassHigh.backdropFilter,
          WebkitBackdropFilter: glassRecipes.glassHigh.backdropFilter,
          boxShadow: glassRecipes.glassHigh.boxShadow,
        }}
      >
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
            size={44}
            icon={<X size={14} color="#6c6a64" />}
            aria-label="Dismiss notification"
            onPress={onClose}
          />
        ) : null}
      </XStack>
    </Stack>
  );
}
