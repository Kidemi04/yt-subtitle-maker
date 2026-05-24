import * as React from "react";
import { Stack, type StackProps } from "tamagui";
import { glassRecipes } from "../tokens";

/**
 * GlassCard — the canonical surface for v2.0.
 *
 * Three elevation variants map to the design-handoff "glass recipes":
 *   - low  : blur 24px, faint bg + border (peripheral cards)
 *   - mid  : blur 40px, default surface for most cards
 *   - high : blur 60px, deep shadow (modals, action sheets)
 *
 * `backdropFilter` is a CSS-only property — V1 ships web/Tauri only, so we
 * apply it via `style` (RN-Web passes it through to the underlying div).
 * On native the property is silently ignored; that's a Phase 12+ concern.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   borderRadius: $lg (20px)
 *   padding:      $lg (24px)
 *   borderWidth:  1
 */
export type GlassCardVariant = "low" | "mid" | "high";

export type GlassCardProps = Omit<StackProps, "style"> & {
  variant?: GlassCardVariant;
  style?: StackProps["style"];
};

const recipeFor = (variant: GlassCardVariant) => {
  switch (variant) {
    case "low":
      return glassRecipes.glassLow;
    case "high":
      return glassRecipes.glassHigh;
    case "mid":
    default:
      return glassRecipes.glassMid;
  }
};

export function GlassCard({
  variant = "mid",
  style,
  children,
  ...rest
}: GlassCardProps) {
  const recipe = recipeFor(variant);
  // boxShadow only exists on glassHigh — narrow the type access.
  const boxShadow =
    "boxShadow" in recipe ? (recipe as { boxShadow: string }).boxShadow : undefined;

  return (
    <Stack
      backgroundColor={recipe.bg}
      borderColor={recipe.border}
      borderWidth={1}
      borderRadius="$lg"
      padding="$xl"
      style={{
        backdropFilter: recipe.backdropFilter,
        // RN-Web also recognises `WebkitBackdropFilter` for Safari < 18.
        WebkitBackdropFilter: recipe.backdropFilter,
        ...(boxShadow ? { boxShadow } : null),
        backgroundImage:
          variant === "mid"
            ? "radial-gradient(circle at 1px 1px, rgba(20,20,19,0.055) 1px, transparent 0)"
            : undefined,
        backgroundSize: variant === "mid" ? "18px 18px" : undefined,
        ...(style as object | null | undefined),
      }}
      {...rest}
    >
      {children}
    </Stack>
  );
}
