import * as React from "react";
import { XStack, Stack, type InputProps } from "tamagui";
import { Eye, EyeOff } from "@tamagui/lucide-icons";
import { TextInput } from "./TextInput";

/**
 * MaskedInput — single-line credential field with a per-field show/hide
 * toggle. Used for API keys across Settings (Gemini / OpenAI / Local AI).
 *
 * Each instance owns its own visibility state — shared state across
 * providers was the previous source of inconsistency (Gemini's toggle
 * persisting visibility into OpenAI's field).
 *
 *   height       : 44 (inherits TextInput)
 *   eye affordance: 36px tap target, right-anchored, `$textMuted` icon
 *                   that hover-lifts to `$textSecondary`. Never accent
 *                   (the eye is decoration, not affordance for action).
 */
export type MaskedInputProps = Omit<InputProps, "size" | "secureTextEntry">;

export function MaskedInput({ style, ...rest }: MaskedInputProps) {
  const [visible, setVisible] = React.useState(false);
  return (
    <XStack alignItems="center" position="relative">
      <TextInput
        flex={1}
        // Right padding leaves room for the absolute-positioned eye button.
        paddingRight={44}
        // secureTextEntry on RN-Web maps to type="password". Toggle via state.
        secureTextEntry={!visible}
        style={style}
        {...rest}
      />
      <Stack
        tag="button"
        role="button"
        aria-label={visible ? "Hide API key" : "Show API key"}
        position="absolute"
        right={4}
        top={4}
        width={36}
        height={36}
        alignItems="center"
        justifyContent="center"
        borderRadius="$pill"
        cursor="pointer"
        animation="quick"
        hoverStyle={{ backgroundColor: "$surfaceGlass" }}
        onPress={() => setVisible((v) => !v)}
      >
        {visible ? (
          <EyeOff size={16} color="$textMuted" />
        ) : (
          <Eye size={16} color="$textMuted" />
        )}
      </Stack>
    </XStack>
  );
}
