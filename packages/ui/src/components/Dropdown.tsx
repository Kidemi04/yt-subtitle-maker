import * as React from "react";
import { Select, XStack, YStack } from "tamagui";
import { ChevronDown, Check } from "@tamagui/lucide-icons";
import { glassRecipes } from "../tokens";

/**
 * Dropdown — a Select-backed picker with our visual recipe.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   trigger      : height 44, $md radius, glassRecipes.glassLow.bg + $borderSubtle
 *                  border, ChevronDown icon right
 *                  (Component Inventory says "glassLow" → recipe alpha 0.04,
 *                  NOT $surfaceGlass.)
 *   listbox      : glassMid surface, $md radius, $borderSubtle border
 *   selected row : $accentSoft bg, $accent text, Check icon right
 *
 * V1 ships web/Tauri only — no `Adapt` / `Sheet` is wired, since touch-first
 * mobile is a Phase 12+ concern. On the desktop floating popover path,
 * `Select.Content` portals into the document and renders `Select.Viewport`.
 */
export type DropdownOption = {
  label: string;
  value: string;
};

export type DropdownProps = {
  value?: string;
  onValueChange?: (v: string) => void;
  options: ReadonlyArray<DropdownOption>;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
  width?: number | string;
};

export function Dropdown({
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
  width,
}: DropdownProps) {
  return (
    <Select
      value={value}
      onValueChange={onValueChange}
      disablePreventBodyScroll
    >
      <Select.Trigger
        unstyled
        width={width}
        height={44}
        borderRadius="$md"
        paddingHorizontal="$md"
        backgroundColor={glassRecipes.glassLow.bg}
        borderWidth={1}
        borderColor="$borderSubtle"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        gap="$sm"
        animation="quick"
        disabled={disabled}
        opacity={disabled ? 0.4 : 1}
        cursor={disabled ? "not-allowed" : "pointer"}
        hoverStyle={
          disabled ? undefined : { borderColor: "$borderStrong" }
        }
        aria-label={ariaLabel}
      >
        <Select.Value
          placeholder={placeholder}
          fontFamily="$body"
          fontSize={14}
          color={value ? "$textPrimary" : "$textMuted"}
        />
        <ChevronDown size={16} color="#a1a1a6" />
      </Select.Trigger>

      <Select.Content zIndex={2000}>
        <Select.Viewport
          unstyled
          minWidth={200}
          backgroundColor={glassRecipes.glassMid.bg}
          borderColor="$borderSubtle"
          borderWidth={1}
          borderRadius="$md"
          paddingVertical="$xs"
          // Glass blur on the popover surface.
          style={{
            backdropFilter: glassRecipes.glassMid.backdropFilter,
            WebkitBackdropFilter: glassRecipes.glassMid.backdropFilter,
            boxShadow: "0 24px 48px rgba(0,0,0,0.4)",
          }}
        >
          <Select.Group>
            <YStack>
              {options.map((opt, index) => (
                <Select.Item
                  key={opt.value}
                  index={index}
                  value={opt.value}
                  paddingVertical="$xs"
                  paddingHorizontal="$md"
                  cursor="pointer"
                  hoverStyle={{ backgroundColor: "$surfaceGlass" }}
                >
                  <XStack
                    flex={1}
                    alignItems="center"
                    justifyContent="space-between"
                    gap="$sm"
                  >
                    <Select.ItemText
                      fontFamily="$body"
                      fontSize={14}
                      color={
                        opt.value === value ? "$accent" : "$textPrimary"
                      }
                    >
                      {opt.label}
                    </Select.ItemText>
                    <Select.ItemIndicator>
                      <Check size={14} color="#fb923c" />
                    </Select.ItemIndicator>
                  </XStack>
                </Select.Item>
              ))}
            </YStack>
          </Select.Group>
        </Select.Viewport>
      </Select.Content>
    </Select>
  );
}

