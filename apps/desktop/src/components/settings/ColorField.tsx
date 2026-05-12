import * as React from "react";
import { XStack } from "tamagui";
import { TextInput } from "@yt-subtitle-maker/ui";
import { NumberStepper } from "./NumberStepper";

const HEX6 = /^#?[0-9a-fA-F]{6}$/;
const HEX8 = /^#?[0-9a-fA-F]{8}$/;
const norm6 = (s: string): string => {
  const m = s.trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(m) ? `#${m.toLowerCase()}` : "";
};
const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
const toHex2 = (n: number) => clamp255(n).toString(16).padStart(2, "0");
const pctToHex = (pct: number) => toHex2(Math.round((Math.max(0, Math.min(100, pct)) / 100) * 255));
const hexToPct = (hex2: string) => Math.round((parseInt(hex2, 16) / 255) * 100);

/**
 * Color picker (native `<input type=color>` swatch + a hex text field). When
 * `allowAlpha`, the value is a `#RRGGBBAA` string (blank ⇒ transparent) and an
 * alpha % stepper is shown; otherwise the value is `#RRGGBB` (blank ⇒ `fallback`,
 * which is what the picker shows when the value is empty/invalid — e.g. "#ffffff"
 * for text, "#000000" for outline). The hex `TextInput` stays editable either way
 * (so the user can still type a raw value, or clear it to go back to "default").
 */
export function ColorField({
  value,
  onChangeText,
  allowAlpha = false,
  fallback = "#ffffff",
  ariaLabel,
}: {
  value: string;
  onChangeText: (v: string) => void;
  allowAlpha?: boolean;
  fallback?: string; // the picker's shown color when `value` is empty/invalid
  ariaLabel?: string;
}) {
  // RGB part shown in the native picker:
  const rgb = allowAlpha
    ? (HEX8.test(value) || HEX6.test(value) ? `#${value.replace(/^#/, "").slice(0, 6).toLowerCase()}` : fallback)
    : (norm6(value) || fallback);
  const alphaPct = allowAlpha
    ? (HEX8.test(value) ? hexToPct(value.replace(/^#/, "").slice(6, 8)) : 0)
    : 100;

  const swatch = React.createElement("input" as any, {
    type: "color",
    value: rgb,
    "aria-label": ariaLabel ? `${ariaLabel} swatch` : "color swatch",
    onChange: (e: any) => {
      const picked: string = e.target.value; // "#rrggbb"
      if (!allowAlpha) {
        onChangeText(picked);
      } else {
        // keep the current alpha; if alpha was 0/blank, default to fully opaque
        const a = HEX8.test(value) ? value.replace(/^#/, "").slice(6, 8) : "ff";
        onChangeText(`${picked}${a.toLowerCase()}`);
      }
    },
    style: { width: 32, height: 32, padding: 0, border: "none", background: "transparent", cursor: "pointer", borderRadius: 6 },
  } as any);

  return (
    <XStack gap="$sm" alignItems="center">
      {swatch}
      <TextInput
        flex={1}
        value={value}
        onChangeText={onChangeText}
        placeholder={allowAlpha ? "(transparent)" : fallback}
        aria-label={ariaLabel ? `${ariaLabel} hex` : "color hex"}
      />
      {allowAlpha ? (
        <NumberStepper
          value={alphaPct}
          onValueChange={(pct) => {
            if (pct <= 0) {
              onChangeText(""); // alpha 0 ⇒ transparent ⇒ blank, per the field's "blank = transparent"
              return;
            }
            const base = (HEX8.test(value) || HEX6.test(value)) ? value.replace(/^#/, "").slice(0, 6).toLowerCase() : fallback.replace(/^#/, "");
            onChangeText(`#${base}${pctToHex(pct)}`);
          }}
          min={0}
          step={10}
          defaultSentinel={-9999} // never matches a real %, so 0 stays "0"
          placeholder="α%"
          ariaLabel={ariaLabel ? `${ariaLabel} alpha` : "alpha"}
        />
      ) : null}
    </XStack>
  );
}
