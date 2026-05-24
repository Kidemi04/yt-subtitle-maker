import * as React from "react";
import { XStack } from "tamagui";
import { Minus, Plus } from "@tamagui/lucide-icons";
import { TextInput, IconButton } from "@yt-subtitle-maker/ui";

/**
 * A numeric field with −/+ steppers. The value is a plain number; `defaultSentinel`
 * is the value that means "use the default" (0 for font-size/margin, -1 for outline
 * width) — when the value equals it, the text box shows empty and the steppers start
 * from `stepperBase` instead of the sentinel. Clearing the text box emits the sentinel;
 * the value is clamped to `>= min`.
 */
export function NumberStepper({
  value,
  onValueChange,
  min = 0,
  step = 1,
  defaultSentinel = 0,
  stepperBase,
  placeholder,
  ariaLabel,
}: {
  value: number;
  onValueChange: (n: number) => void;
  min?: number;
  step?: number;
  defaultSentinel?: number;
  stepperBase?: number; // where ± start when the value is currently the sentinel; defaults to `min` (clamped) — pass e.g. 55 / 18 / 3
  placeholder?: string;
  ariaLabel?: string;
}) {
  const isDefault = value === defaultSentinel;
  const base = stepperBase ?? Math.max(min, 0);
  const text = isDefault ? "" : String(value);

  const emit = (n: number) => onValueChange(Math.max(min, Math.round(n)));
  const bump = (delta: number) => emit((isDefault ? base : value) + delta);

  return (
    <XStack gap="$sm" alignItems="center">
      <IconButton
        icon={<Minus size={14} color="$textSecondary" />}
        aria-label={`${ariaLabel ?? "value"} minus`}
        size={44}
        onPress={() => bump(-step)}
      />
      <TextInput
        flex={1}
        value={text}
        onChangeText={(v: string) => {
          if (v.trim() === "") {
            onValueChange(defaultSentinel);
            return;
          }
          const n = Number(v);
          onValueChange(Number.isFinite(n) ? Math.max(min, Math.round(n)) : defaultSentinel);
        }}
        placeholder={placeholder}
        keyboardType="numeric"
        aria-label={ariaLabel}
      />
      <IconButton
        icon={<Plus size={14} color="$textSecondary" />}
        aria-label={`${ariaLabel ?? "value"} plus`}
        size={44}
        onPress={() => bump(step)}
      />
    </XStack>
  );
}
