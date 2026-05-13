import * as React from "react";
import { XStack, YStack } from "tamagui";
import { Modal } from "./Modal";
import { ButtonGhost } from "./ButtonGhost";
import { ButtonPrimary } from "./ButtonPrimary";
import { ButtonSecondary } from "./ButtonSecondary";
import { TitleMd, BodySm } from "./Typography";

/**
 * ConfirmDialog — inline confirmation modal for destructive actions.
 *
 * Replaces native `window.confirm()` which leaks OS chrome (PRODUCT.md
 * anti-reference #3). Use for: deletes, resets, "are you sure" gates.
 *
 *   variant="destructive" (default) — primary action uses a quieter
 *       glow="none" ButtonPrimary in standard accent gradient; the
 *       semantics of the action is encoded by the explicit verb and the
 *       optional `confirmLabel`, not by red chrome. Cancel is ghost.
 *   variant="caution" — same layout but the confirm action is a
 *       ButtonSecondary; reserve for low-stakes overrides.
 *
 * The dialog matches Modal width 360 by default — confirmations should
 * feel smaller than content modals.
 */
export type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  variant?: "destructive" | "caution";
};

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  variant = "destructive",
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} width={360}>
      <YStack gap="$md">
        <YStack gap="$xs">
          <TitleMd>{title}</TitleMd>
          {message ? (
            <BodySm color="$textSecondary">{message}</BodySm>
          ) : null}
        </YStack>
        <XStack gap="$xs" justifyContent="flex-end">
          <ButtonGhost onPress={() => onOpenChange(false)}>
            {cancelLabel}
          </ButtonGhost>
          {variant === "destructive" ? (
            <ButtonPrimary glow="none" onPress={handleConfirm}>
              {confirmLabel}
            </ButtonPrimary>
          ) : (
            <ButtonSecondary onPress={handleConfirm}>
              {confirmLabel}
            </ButtonSecondary>
          )}
        </XStack>
      </YStack>
    </Modal>
  );
}
