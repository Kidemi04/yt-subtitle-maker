import * as React from "react";
import { Dropdown, TextInput, ButtonGhost } from "@yt-subtitle-maker/ui";
import { XStack } from "tamagui";
import { ALL_LANGUAGES } from "./languages";
import { X } from "@tamagui/lucide-icons";

const CUSTOM_SENTINEL = "__custom__";
export const AUTO_LANG = "auto";

const AUTO_OPTION = { label: "Auto detect", value: AUTO_LANG };

type LanguagePickerProps = {
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
  width?: number | string;
  /**
   * Offer "Auto detect" as the first option. Source-language pickers only —
   * a *target* language of "auto" is meaningless. The backend accepts
   * sourceLang="auto" and every Whisper engine maps it to its own
   * language-detection path.
   */
  allowAuto?: boolean;
};

export function LanguagePicker({
  value,
  onValueChange,
  disabled,
  "aria-label": ariaLabel,
  width,
  allowAuto,
}: LanguagePickerProps) {
  // "auto" counts as a built-in when offered, otherwise it would fall through
  // to the free-text "Custom…" branch.
  const builtIns = React.useMemo(
    () => (allowAuto ? [AUTO_OPTION, ...ALL_LANGUAGES] : ALL_LANGUAGES),
    [allowAuto]
  );
  const options = React.useMemo(
    () => [...builtIns, { label: "Custom…", value: CUSTOM_SENTINEL }],
    [builtIns]
  );

  const [customText, setCustomText] = React.useState(
    !builtIns.some((o) => o.value === value) ? value : ""
  );
  const isBuiltIn = builtIns.some((o) => o.value === value);
  const [showingCustom, setShowingCustom] = React.useState(
    !isBuiltIn && value !== ""
  );

  const handleDropdownChange = (v: string) => {
    if (v === CUSTOM_SENTINEL) {
      setShowingCustom(true);
      setCustomText(value);
    } else {
      onValueChange(v);
    }
  };

  const handleCustomConfirm = () => {
    const trimmed = customText.trim();
    if (trimmed) {
      onValueChange(trimmed);
      if (builtIns.some((o) => o.value === trimmed)) {
        setShowingCustom(false);
        setCustomText("");
      }
    }
  };

  React.useEffect(() => {
    const inBuiltIn = builtIns.some((o) => o.value === value);
    if (inBuiltIn) {
      setShowingCustom(false);
      setCustomText("");
    } else if (value) {
      setShowingCustom(true);
      setCustomText(value);
    }
  }, [value, builtIns]);

  const handleCustomDismiss = () => {
    onValueChange("");
    setShowingCustom(false);
    setCustomText("");
  };

  if (showingCustom) {
    return (
      <XStack gap="$xs" alignItems="center" width={width}>
        <TextInput
          value={customText}
          onChangeText={setCustomText}
          placeholder="zh-CN, pt-BR…"
          onSubmitEditing={handleCustomConfirm}
          aria-label={ariaLabel ? `${ariaLabel} custom` : "Custom language code"}
          disabled={disabled}
          width="100%"
        />
        <ButtonGhost
          onPress={handleCustomDismiss}
          aria-label="Back to language list"
        >
          <X size={16} />
        </ButtonGhost>
      </XStack>
    );
  }

  return (
    <Dropdown
      value={value}
      onValueChange={handleDropdownChange}
      options={options}
      disabled={disabled}
      aria-label={ariaLabel}
      width={width}
    />
  );
}
