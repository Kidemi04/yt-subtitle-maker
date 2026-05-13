import * as React from "react";
import { Dropdown, TextInput, ButtonGhost } from "@yt-subtitle-maker/ui";
import { XStack } from "tamagui";
import { ALL_LANGUAGES } from "./languages";
import { X } from "@tamagui/lucide-icons";

const CUSTOM_SENTINEL = "__custom__";

const optionsWithCustom = [
  ...ALL_LANGUAGES,
  { label: "Custom…", value: CUSTOM_SENTINEL },
];

type LanguagePickerProps = {
  value: string;
  onValueChange: (v: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
  width?: number | string;
};

export function LanguagePicker({
  value,
  onValueChange,
  disabled,
  "aria-label": ariaLabel,
  width,
}: LanguagePickerProps) {
  const [customText, setCustomText] = React.useState(
    !ALL_LANGUAGES.some((o) => o.value === value) ? value : ""
  );
  const isBuiltIn = ALL_LANGUAGES.some((o) => o.value === value);
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
      if (ALL_LANGUAGES.some((o) => o.value === trimmed)) {
        setShowingCustom(false);
        setCustomText("");
      }
    }
  };

  React.useEffect(() => {
    const inBuiltIn = ALL_LANGUAGES.some((o) => o.value === value);
    if (inBuiltIn) {
      setShowingCustom(false);
      setCustomText("");
    } else if (value) {
      setShowingCustom(true);
      setCustomText(value);
    }
  }, [value]);

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
      options={optionsWithCustom}
      disabled={disabled}
      aria-label={ariaLabel}
      width={width}
    />
  );
}
