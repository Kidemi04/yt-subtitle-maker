/**
 * @yt-subtitle-maker/ui — shared component package.
 *
 * Phase 3 ships:
 *   - Glass surfaces : GlassCard, HeroCard
 *   - Button family  : ButtonPrimary, ButtonSecondary, ButtonGhost, IconButton
 *
 * Phase 4 adds:
 *   - Form controls  : TextInput, Dropdown, Toggle, RadioCard, FilterChip,
 *                      SegmentedControl
 *
 * Phase 5 adds:
 *   - Status / badges: BadgePill, BadgeAccent, ProgressBar, StepPill, StatusDot
 *
 * Phase 6+ will add: SidebarItem, ActionSheet, Modal, Toast, Tooltip.
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

export { TextInput } from "./components/TextInput";
export type { TextInputProps } from "./components/TextInput";

export { Dropdown } from "./components/Dropdown";
export type { DropdownProps, DropdownOption } from "./components/Dropdown";

export { Toggle } from "./components/Toggle";
export type { ToggleProps } from "./components/Toggle";

export { RadioCard } from "./components/RadioCard";
export type { RadioCardProps } from "./components/RadioCard";

export { FilterChip } from "./components/FilterChip";
export type { FilterChipProps } from "./components/FilterChip";

export { SegmentedControl } from "./components/SegmentedControl";
export type {
  SegmentedControlOption,
  SegmentedControlProps,
} from "./components/SegmentedControl";

export { BadgePill } from "./components/BadgePill";
export type { BadgePillProps, BadgePillTone } from "./components/BadgePill";

export { BadgeAccent } from "./components/BadgeAccent";
export type { BadgeAccentProps } from "./components/BadgeAccent";

export { ProgressBar } from "./components/ProgressBar";
export type { ProgressBarProps } from "./components/ProgressBar";

export { StepPill } from "./components/StepPill";
export type { StepPillProps, StepPillStatus } from "./components/StepPill";

export { StatusDot } from "./components/StatusDot";
export type { StatusDotProps, StatusDotStatus } from "./components/StatusDot";
