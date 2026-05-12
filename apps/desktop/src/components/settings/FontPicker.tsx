import * as React from "react";
import { YStack, XStack } from "tamagui";
import { Dropdown, TextInput, ButtonGhost, BodySm } from "@yt-subtitle-maker/ui";

// Curated "probably installed somewhere / commonly bundled" font names. "" = mpv's default sans.
const CURATED_FONTS = [
  "",
  "Inter",
  "Arial",
  "Helvetica",
  "Helvetica Neue",
  "Verdana",
  "Tahoma",
  "Trebuchet MS",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Noto Sans",
  "Noto Sans CJK SC",
  "Noto Sans CJK TC",
  "Noto Sans CJK JP",
  "Noto Sans CJK KR",
  "Noto Serif CJK SC",
  "Source Han Sans SC",
  "PingFang SC",
  "Microsoft YaHei",
  "DejaVu Sans",
  "Liberation Sans",
];
const CUSTOM = "__custom__";

/**
 * Font family picker: a curated dropdown ("(mpv default sans)" + safe names + "Custom…"),
 * which flips to a plain text input when the current value isn't in the curated list or
 * the user picks "Custom…". Either control writes the same `subFont` string. mpv won't
 * download fonts — the name must be installed on the OS (warning lives on the SettingRow).
 */
export function FontPicker({
  value,
  onChangeText,
}: {
  value: string;
  onChangeText: (v: string) => void;
}) {
  const inCurated = CURATED_FONTS.includes(value);
  const [customMode, setCustomMode] = React.useState(!inCurated && value !== "");

  // If the value changes to something curated (e.g. via a preset), drop out of custom mode.
  React.useEffect(() => {
    if (inCurated) setCustomMode(false);
  }, [inCurated]);

  const options = [
    ...CURATED_FONTS.map((f) => ({ label: f === "" ? "(mpv default sans)" : f, value: f })),
    { label: "Custom…", value: CUSTOM },
  ];

  if (customMode) {
    return (
      <YStack gap="$xs">
        <XStack gap="$sm" alignItems="center">
          <TextInput
            flex={1}
            value={value}
            onChangeText={onChangeText}
            placeholder="e.g. My Custom Font"
            aria-label="Custom font family name"
          />
          <ButtonGhost
            onPress={() => {
              onChangeText("");
              setCustomMode(false);
            }}
          >
            <BodySm color="$textSecondary">↩ pick from list</BodySm>
          </ButtonGhost>
        </XStack>
      </YStack>
    );
  }

  return (
    <Dropdown
      value={inCurated ? value : ""}
      onValueChange={(v) => {
        if (v === CUSTOM) {
          setCustomMode(true);
          // keep the current value if it was already custom; otherwise leave it for the user to type
          return;
        }
        onChangeText(v);
      }}
      options={options}
      width="100%"
      aria-label="Font family"
    />
  );
}
