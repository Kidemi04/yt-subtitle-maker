import * as React from "react";
import { Stack, Text, XStack, type StackProps } from "tamagui";
import { glassRecipes } from "../tokens";

/**
 * SegmentedControl — N-way exclusive choice in a glass container.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   container : glassRecipes.glassLow.bg (rgba 0.04) + $borderSubtle border,
 *               $md radius, padding 4 (literal — < $xxs)
 *               (Component Inventory says "glassLow" → recipe alpha 0.04,
 *               NOT $surfaceGlass.)
 *   option    : $sm radius, padding $xs $md (8 vertical, 16 horizontal)
 *   active    : bg $accentSoft, text $accent
 *   inactive  : bg transparent, text $textSecondary
 *   text      : Inter 13px / 500
 *   anim      : 150ms quick on bg/text colour swap
 */
export type SegmentedControlOption<T extends string = string> = {
  label: string;
  value: T;
};

export type SegmentedControlProps<T extends string = string> = {
  options: ReadonlyArray<SegmentedControlOption<T>>;
  value: T;
  onValueChange: (v: T) => void;
  disabled?: boolean;
} & Omit<StackProps, "value" | "onValueChange" | "disabled">;

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  disabled,
  ...rest
}: SegmentedControlProps<T>) {
  return (
    <XStack
      backgroundColor={glassRecipes.glassLow.bg}
      borderWidth={1}
      borderColor="$borderSubtle"
      borderRadius="$md"
      padding={4}
      gap={4}
      alignSelf="flex-start"
      opacity={disabled ? 0.4 : 1}
      {...rest}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Stack
            key={opt.value}
            tag="button"
            role="button"
            aria-pressed={active}
            paddingVertical="$xs"
            paddingHorizontal="$md"
            borderRadius="$sm"
            borderWidth={0}
            backgroundColor={active ? "$accentSoft" : "transparent"}
            alignItems="center"
            justifyContent="center"
            animation="quick"
            onPress={disabled ? undefined : () => onValueChange(opt.value)}
            disabled={disabled}
            cursor={disabled ? "not-allowed" : "pointer"}
            hoverStyle={
              disabled || active
                ? undefined
                : { backgroundColor: "$surfaceGlass" }
            }
            pressStyle={disabled ? undefined : { scale: 0.97 }}
          >
            <Text
              fontFamily="$body"
              fontSize={13}
              fontWeight="500"
              color={active ? "$accent" : "$textSecondary"}
            >
              {opt.label}
            </Text>
          </Stack>
        );
      })}
    </XStack>
  );
}
