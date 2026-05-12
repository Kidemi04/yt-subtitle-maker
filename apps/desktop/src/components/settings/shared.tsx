import * as React from "react";
import { YStack, XStack } from "tamagui";
import { DisplaySm, TitleSm, BodySm, Caption } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";

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

/**
 * One configurable setting: a label/helper header + the control(s) beneath it
 * (or label-left/control-right when layout="row", e.g. for a toggle), wrapped
 * with a stable DOM id so search can scroll to + briefly highlight it.
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
  const { highlightedSettingId, setHighlightedSettingId } = useSettings();
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

  const highlightProps = highlighted
    ? ({
        borderColor: "$accent",
        borderWidth: 1,
        borderRadius: "$md",
        padding: "$xs",
      } as const)
    : undefined;

  if (layout === "row") {
    return (
      <XStack
        ref={ref}
        nativeID={id}
        alignItems="center"
        justifyContent="space-between"
        {...highlightProps}
      >
        <Field label={label} helper={helper} />
        {children}
      </XStack>
    );
  }
  return (
    <YStack ref={ref} nativeID={id} gap="$xs" {...highlightProps}>
      <Field label={label} helper={helper} />
      {children}
    </YStack>
  );
}
