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
      paddingLeft="$md"
      paddingRight="$md"
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
      // Tamagui Input under `unstyled` does NOT propagate the `color` prop
      // to the underlying web <input> reliably — RN-Web renders a real
      // <input> whose `color` falls back to the browser default (black on
      // dark surfaces, invisible). Forcing it via inline style hits the
      // <input> element's `style.color` directly and survives `unstyled`.
      // caretColor is web-only — RN style types don't list it but RN-Web
      // forwards the property to the DOM. Cast through unknown to bypass
      // the type without losing the rest of the inline style.
      style={
        {
          color: "#f5f5f7",
          caretColor: "#fb923c",
          ...((style as object) ?? {}),
        } as unknown as TextInputProps["style"]
      }
      {...rest}
    />
  );
}
