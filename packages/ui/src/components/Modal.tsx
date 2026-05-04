import * as React from "react";
import { Dialog, Stack, Text, XStack, YStack } from "tamagui";
import { X } from "@tamagui/lucide-icons";
import { glassRecipes } from "../tokens";
import { IconButton } from "./IconButton";

/**
 * Modal — centered overlay built on Tamagui's Dialog primitive.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Screen 8 (Library Detail
 * Modal) + Component Inventory ("Centered overlay, glassMid+extra,
 * borderRadius xl, boxShadow").
 *
 *   backdrop  : rgba(10,10,12,0.75) + blur(8px)
 *   container : glassMid bg + glassHigh-ish blur (60px / sat 200%) for the
 *               surface itself, $xl radius (28px), boxShadow
 *               0 24px 48px rgba(0,0,0,0.5)
 *   width     : default 480, accepts override
 *   title     : Inter 18 / 600 if provided, sits above content
 *
 * Close-X (lucide `X`) is rendered top-right via IconButton — matches the
 * Library detail modal in Screen 8. The Dialog's own `onOpenChange` wires
 * the close button.
 */
export type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  width?: number | string;
  children: React.ReactNode;
};

export function Modal({
  open,
  onOpenChange,
  title,
  width = 480,
  children,
}: ModalProps) {
  return (
    <Dialog modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          key="overlay"
          animation="quick"
          opacity={1}
          enterStyle={{ opacity: 0 }}
          exitStyle={{ opacity: 0 }}
          backgroundColor="rgba(10,10,12,0.75)"
          style={{
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        />

        <Dialog.Content
          key="content"
          unstyled
          animation="quick"
          enterStyle={{ opacity: 0, scale: 0.96 }}
          exitStyle={{ opacity: 0, scale: 0.96 }}
          width={width}
          maxWidth="90vw"
          padding="$lg"
          borderRadius="$xl"
          // Spec: "glassMid + extra opacity" — pure glassMid
          // (rgba(255,255,255,0.06)) is too transparent against the 0.75-alpha
          // black backdrop. We use the Library Detail Modal's opaque-glass
          // value (~95% alpha on a slightly brightened bgElevated) so the
          // modal reads as a distinct surface above the overlay.
          backgroundColor="rgba(36,36,40,0.96)"
          borderWidth={1}
          borderColor="$borderStrong"
          style={{
            backdropFilter: glassRecipes.glassHigh.backdropFilter,
            WebkitBackdropFilter: glassRecipes.glassHigh.backdropFilter,
            boxShadow: "0 24px 48px rgba(0,0,0,0.5)",
          }}
        >
          {/* Tamagui Dialog requires a Dialog.Title for a11y. When no title is
              provided, render a visually-hidden one so screen readers still
              get an accessible label. */}
          {title ? (
            <XStack
              alignItems="center"
              justifyContent="space-between"
              marginBottom="$md"
            >
              <Dialog.Title asChild>
                <Text
                  fontFamily="$body"
                  fontSize={18}
                  fontWeight="600"
                  color="$textPrimary"
                >
                  {title}
                </Text>
              </Dialog.Title>
              <IconButton
                size={32}
                icon={<X size={16} color="#a1a1a6" />}
                aria-label="Close"
                onPress={() => onOpenChange(false)}
              />
            </XStack>
          ) : (
            <>
              <Dialog.Title
                style={{
                  position: "absolute",
                  width: 1,
                  height: 1,
                  margin: -1,
                  padding: 0,
                  overflow: "hidden",
                  clip: "rect(0,0,0,0)",
                  border: 0,
                }}
              >
                Dialog
              </Dialog.Title>
              <Stack position="absolute" top="$md" right="$md" zIndex={1}>
                <IconButton
                  size={32}
                  icon={<X size={16} color="#a1a1a6" />}
                  aria-label="Close"
                  onPress={() => onOpenChange(false)}
                />
              </Stack>
            </>
          )}
          <YStack>{children}</YStack>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
