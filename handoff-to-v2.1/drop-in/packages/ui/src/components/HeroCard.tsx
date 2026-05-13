import * as React from "react";
import { Stack } from "tamagui";
import { GlassCard, type GlassCardProps } from "./GlassCard";
import { ensureKeyframes } from "./keyframes";

/**
 * HeroCard — same recipe as GlassCard but with the larger XL radius/padding
 * spec'd for hero surfaces (Generate URL input area, Init splash, etc.).
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   borderRadius: $xl (28px)
 *   padding:      $xl (32px)
 *
 * `shimmer` (optional) overlays a slow, low-opacity diagonal sweep, used on
 * the Generate idle hero to give the screen a "breathing" presence under the
 * URL input. The handoff spec calls for a 10s loop at very low intensity
 * (Screen 2 — "Shimmer sweep animation: 10s loop, very subtle"). Honors
 * `prefers-reduced-motion`: the animation is suppressed and the overlay
 * stays static when the user has reduced motion enabled.
 */
export type HeroCardProps = GlassCardProps & {
  shimmer?: boolean;
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Safari < 14 fallback
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);
  return reduced;
}

export function HeroCard({ children, shimmer, ...rest }: HeroCardProps) {
  React.useEffect(() => {
    if (shimmer) ensureKeyframes();
  }, [shimmer]);
  const reducedMotion = usePrefersReducedMotion();

  return (
    <GlassCard
      borderRadius="$xl"
      padding="$xl"
      overflow="hidden"
      {...rest}
    >
      {shimmer ? (
        <Stack
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          pointerEvents="none"
          aria-hidden={true}
          style={{
            backgroundImage:
              "linear-gradient(115deg, transparent 30%, rgba(251,146,60,0.06) 50%, transparent 70%)",
            opacity: 0.3,
            animation: reducedMotion
              ? undefined
              : "yt-ui-shimmer 10s linear infinite",
          }}
        />
      ) : null}
      {children}
    </GlassCard>
  );
}
