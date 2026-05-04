import * as React from "react";
import { Input, type InputProps } from "tamagui";
import { glassRecipes } from "../tokens";

/**
 * TextInput — single-line text field on a glassLow surface.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   height       : 44
 *   borderRadius : $md (12px)
 *   surface      : glassRecipes.glassLow.bg (rgba 0.04) — Component Inventory
 *                  says "glassLow", which is the recipe alpha (0.04), NOT the
 *                  $surfaceGlass token (0.05).
 *   border       : 1px $borderSubtle
 *   focused      : 2px $accent border + 0 0 0 3px $accentSoft ring
 *   text         : Inter 14px / 400 / $textPrimary
 *   placeholder  : $textMuted
 *
 * Wraps Tamagui's `Input` primitive. We pass `unstyled` to drop the default
 * outline + size variants and apply our own. Focus lights up the border
 * to 2px $accent and adds an outer halo via outlineColor + outlineWidth
 * (RN-Web maps that to a real `outline` and the resulting halo behaves as
 * the spec'd `0 0 0 3px accentSoft` ring).
 */
export type TextInputProps = Omit<InputProps, "size">;

export function TextInput({ style, ...rest }: TextInputProps) {
  return (
    <Input
      unstyled
      height={44}
      borderRadius="$md"
      paddingHorizontal="$md"
      backgroundColor={glassRecipes.glassLow.bg}
      borderWidth={1}
      borderColor="$borderSubtle"
      fontFamily="$body"
      fontSize={14}
      color="$textPrimary"
      placeholderTextColor="$textMuted"
      animation="quick"
      focusStyle={{
        borderColor: "$accent",
        borderWidth: 2,
        // Tamagui passes through `outlineWidth` / `outlineColor` to RN-Web's
        // outline CSS, which renders the soft halo without affecting layout.
        outlineWidth: 3,
        outlineColor: "$accentSoft",
        outlineStyle: "solid",
        outlineOffset: 0,
      }}
      style={style}
      {...rest}
    />
  );
}
