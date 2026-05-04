import * as React from "react";
import { Tooltip as TamaguiTooltip, Text } from "tamagui";
import { glassRecipes } from "../tokens";

/**
 * Tooltip — inline ⓘ explainer wrapper around Tamagui's Tooltip primitive.
 *
 * Spec: docs/superpowers/design-handoff/README.md → Component Inventory.
 *   surface : glassHigh
 *   radius  : $sm (8px)
 *   padding : $sm (12px)
 *   max-w   : 320
 *   text    : Inter 13 / 400 / $textSecondary (body-sm)
 *
 * Caller passes the trigger element as `children` (typically an ⓘ icon, an
 * inline `<Text>`, or any focusable). `content` accepts a string for the
 * default body-sm rendering or an arbitrary node for custom layouts.
 *
 * Tamagui's Tooltip uses Popper under the hood — the content portals to
 * document.body and floats relative to the trigger.
 */
export type TooltipProps = {
  content: React.ReactNode | string;
  children: React.ReactNode;
};

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <TamaguiTooltip>
      {/* No `asChild` — that forwards the ref to children, which crashes when
          children is a function component without forwardRef (e.g. a lucide
          icon). Letting Tamagui render its own wrapper attaches the ref to a
          real DOM node. */}
      <TamaguiTooltip.Trigger>{children}</TamaguiTooltip.Trigger>
      <TamaguiTooltip.Content
        unstyled
        animation="quick"
        enterStyle={{ opacity: 0, y: -4 }}
        exitStyle={{ opacity: 0, y: -4 }}
        padding="$sm"
        borderRadius="$sm"
        backgroundColor={glassRecipes.glassHigh.bg}
        borderWidth={1}
        borderColor="$borderStrong"
        maxWidth={320}
        zIndex={3000}
        style={{
          backdropFilter: glassRecipes.glassHigh.backdropFilter,
          WebkitBackdropFilter: glassRecipes.glassHigh.backdropFilter,
          boxShadow: glassRecipes.glassHigh.boxShadow,
        }}
      >
        <TamaguiTooltip.Arrow size={8} backgroundColor="$borderStrong" />
        {typeof content === "string" ? (
          <Text
            fontFamily="$body"
            fontSize={13}
            fontWeight="400"
            lineHeight={20}
            color="$textSecondary"
          >
            {content}
          </Text>
        ) : (
          content
        )}
      </TamaguiTooltip.Content>
    </TamaguiTooltip>
  );
}
