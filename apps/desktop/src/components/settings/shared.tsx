import * as React from "react";
import { Stack, YStack, XStack } from "tamagui";
import { RotateCcw } from "@tamagui/lucide-icons";
import { DisplaySm, TitleSm, BodySm, Caption } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";
import { SETTING_FIELD } from "./constants";

/** Section header — DisplaySm title plus optional BodySm subtitle. */
export function Section({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <YStack gap={2}>
      <DisplaySm>{title}</DisplaySm>
      {subtitle ? <BodySm color="$textSecondary">{subtitle}</BodySm> : null}
    </YStack>
  );
}

/** Field label — TitleSm primary line + optional Caption helper. */
export function Field({
  label,
  helper,
}: {
  label: string;
  helper?: string;
}) {
  return (
    <YStack gap={2} marginBottom="$xxs">
      <TitleSm>{label}</TitleSm>
      {helper ? <Caption>{helper}</Caption> : null}
    </YStack>
  );
}

/** Small, quiet circular "reset to default" button shown inline by a row's label. */
function ResetToDefaultButton({ onPress }: { onPress: () => void }) {
  return (
    <Stack
      tag="button"
      role="button"
      width={24}
      height={24}
      borderRadius="$pill"
      alignItems="center"
      justifyContent="center"
      backgroundColor="transparent"
      hoverStyle={{ backgroundColor: "$surfaceGlass" }}
      pressStyle={{ scale: 0.92 }}
      animation="quick"
      cursor="pointer"
      onPress={onPress}
      aria-label="Reset to default"
      accessibilityLabel="Reset to default"
    >
      <RotateCcw size={13} color="$textSecondary" />
    </Stack>
  );
}

/** Inline "couldn't save — retry" affordance shown beneath a row whose last save failed. */
function RetryRow({ onRetrySave }: { onRetrySave: () => void }) {
  return (
    <XStack alignItems="center" gap="$xs" marginTop="$xxs">
      <Caption color="$error">couldn&apos;t save</Caption>
      <Stack
        tag="button"
        role="button"
        paddingHorizontal="$xs"
        paddingVertical={2}
        borderRadius="$sm"
        backgroundColor="transparent"
        hoverStyle={{ backgroundColor: "$surfaceGlass" }}
        pressStyle={{ scale: 0.97 }}
        animation="quick"
        cursor="pointer"
        onPress={onRetrySave}
        aria-label="Retry saving this setting"
        accessibilityLabel="Retry saving this setting"
      >
        <Caption color="$textSecondary">retry</Caption>
      </Stack>
    </XStack>
  );
}

/**
 * One configurable setting: a label/helper header + the control(s) beneath it
 * (or label-left/control-right when layout="row", e.g. for a toggle), wrapped
 * with a stable DOM id so search can scroll to + briefly highlight it.
 *
 * When the row owns an `AppConfig` field (see `SETTING_FIELD`), it also shows:
 *   - a per-field ↺ "reset to default" button by the label, but only while the
 *     current draft value differs from the effective default;
 *   - an inline "couldn't save — retry" affordance beneath the control when the
 *     last autosave of that field failed.
 */
export function SettingRow({
  id,
  label,
  helper,
  layout = "stack",
  children,
}: {
  id: string; // unique across ALL tabs; must match an entry in searchIndex.ts if searchable
  label: string;
  helper?: string;
  layout?: "stack" | "row";
  children: React.ReactNode;
}) {
  const {
    highlightedSettingId,
    setHighlightedSettingId,
    draft,
    defaults,
    revertField,
    failedFields,
    retrySave,
  } = useSettings();
  const ref = React.useRef<any>(null);
  const highlighted = highlightedSettingId === id;

  React.useEffect(() => {
    if (!highlighted) return;
    const el = ref.current as { scrollIntoView?: (opts?: any) => void } | null;
    if (el && typeof el.scrollIntoView === "function") {
      requestAnimationFrame(() =>
        el.scrollIntoView!({ behavior: "smooth", block: "center" }),
      );
    }
    const t = setTimeout(() => setHighlightedSettingId(null), 2200);
    return () => clearTimeout(t);
  }, [highlighted, setHighlightedSettingId]);

  const rowProps = {
    borderRadius: "$md",
    padding: "$md",
    borderWidth: 1,
    borderColor: highlighted ? "$accent" : "$borderSubtle",
    backgroundColor: highlighted ? "$accentSoft" : "$bgBase",
  } as const;

  // Does this row own a config field, and does its current value differ from
  // the shipped/effective default? Only then do we show the ↺ button.
  const fieldKey = SETTING_FIELD[id];
  const draftRec = draft as Record<string, unknown> | undefined;
  const defaultsRec = defaults as Record<string, unknown> | undefined;
  const changed =
    !!fieldKey &&
    !!draftRec &&
    !!defaultsRec &&
    JSON.stringify(draftRec[fieldKey]) !== JSON.stringify(defaultsRec[fieldKey]);
  const failed = !!fieldKey && failedFields.has(fieldKey);

  const labelHeader = (
    <XStack alignItems="flex-start" gap="$xs">
      <YStack flex={1}>
        <Field label={label} helper={helper} />
      </YStack>
      {changed && fieldKey ? (
        <ResetToDefaultButton onPress={() => revertField(id)} />
      ) : null}
    </XStack>
  );

  if (layout === "row") {
    return (
      <YStack ref={ref} nativeID={id} gap="$xs" {...rowProps}>
        <XStack alignItems="center" justifyContent="space-between" gap="$sm">
          <YStack flex={1}>{labelHeader}</YStack>
          {children}
        </XStack>
        {failed ? <RetryRow onRetrySave={retrySave} /> : null}
      </YStack>
    );
  }
  return (
    <YStack ref={ref} nativeID={id} gap="$sm" {...rowProps}>
      {labelHeader}
      {children}
      {failed ? <RetryRow onRetrySave={retrySave} /> : null}
    </YStack>
  );
}
