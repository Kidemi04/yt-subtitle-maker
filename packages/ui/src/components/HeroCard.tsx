import * as React from "react";
import { GlassCard, type GlassCardProps } from "./GlassCard";

/**
 * HeroCard — same recipe as GlassCard but with the larger XL radius/padding
 * spec'd for hero surfaces (Generate URL input area, Init splash, etc.).
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   borderRadius: $xl (28px)
 *   padding:      $xl (32px)
 */
export type HeroCardProps = GlassCardProps;

export function HeroCard({ children, ...rest }: HeroCardProps) {
  return (
    <GlassCard borderRadius="$xl" padding="$xxl" {...rest}>
      {children}
    </GlassCard>
  );
}
