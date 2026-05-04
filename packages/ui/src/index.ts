/**
 * @yt-subtitle-maker/ui — shared component package.
 *
 * Phase 3 ships:
 *   - Glass surfaces : GlassCard, HeroCard
 *   - Button family  : ButtonPrimary, ButtonSecondary, ButtonGhost, IconButton
 *
 * Phase 4+ will add: TextInput, Dropdown, Toggle, RadioCard, ProgressBar,
 * StepPill, BadgePill, BadgeAccent, SidebarItem, FilterChip, SegmentedControl,
 * StatusDot, ActionSheet, Modal, Toast.
 *
 * Tokens (`glassRecipes`, `EASING`, `DURATION`) live here so apps/desktop's
 * tamagui.config can re-export them without a circular workspace dep.
 */
export { glassRecipes, EASING, DURATION } from "./tokens";

export { GlassCard } from "./components/GlassCard";
export type { GlassCardProps, GlassCardVariant } from "./components/GlassCard";

export { HeroCard } from "./components/HeroCard";
export type { HeroCardProps } from "./components/HeroCard";

export { ButtonPrimary } from "./components/ButtonPrimary";
export type { ButtonPrimaryProps } from "./components/ButtonPrimary";

export { ButtonSecondary } from "./components/ButtonSecondary";
export type { ButtonSecondaryProps } from "./components/ButtonSecondary";

export { ButtonGhost } from "./components/ButtonGhost";
export type { ButtonGhostProps } from "./components/ButtonGhost";

export { IconButton } from "./components/IconButton";
export type { IconButtonProps } from "./components/IconButton";
