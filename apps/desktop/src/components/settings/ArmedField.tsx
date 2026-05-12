import * as React from "react";
import { XStack, YStack, Stack } from "tamagui";
import { Lock, Pencil } from "@tamagui/lucide-icons";
import { TextInput, ButtonSecondary, ButtonGhost, BodySm, Caption } from "@yt-subtitle-maker/ui";

export interface ArmedFieldValidation {
  ok: boolean;
  reason?: string;
}

/**
 * A field you can't fat-finger: shows the current value read-only with an
 * "Edit" affordance. Editing reveals an input + Apply/Cancel; Apply runs an
 * async `validate(value)` first — pass → onApply(value); fail → stays open,
 * shows the reason, offers "Apply anyway" (onApply unconditionally).
 * Optional `secondaryAction` renders an always-visible extra button (e.g.
 * "Reset to 127.0.0.1:8000" for the Backend URL).
 */
export function ArmedField({
  value,
  placeholder,
  validate,
  onApply,
  secondaryAction,
}: {
  value: string;
  placeholder?: string;
  validate: (value: string) => Promise<ArmedFieldValidation>;
  onApply: (value: string) => void;
  secondaryAction?: { label: string; onPress: () => void };
}) {
  const [editing, setEditing] = React.useState(false);
  const [scratch, setScratch] = React.useState(value);
  const [checking, setChecking] = React.useState(false);
  const [failReason, setFailReason] = React.useState<string | null>(null);

  // keep scratch in sync if the underlying value changes while not editing
  React.useEffect(() => {
    if (!editing) setScratch(value);
  }, [value, editing]);

  const startEdit = () => {
    setScratch(value);
    setFailReason(null);
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setFailReason(null);
  };
  const commit = (v: string) => {
    onApply(v);
    setEditing(false);
    setFailReason(null);
  };
  const apply = async () => {
    setChecking(true);
    setFailReason(null);
    try {
      const r = await validate(scratch);
      if (r.ok) commit(scratch);
      else setFailReason(r.reason ?? "Validation failed.");
    } catch (err) {
      setFailReason(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  };

  if (!editing) {
    return (
      <XStack gap="$sm" alignItems="center">
        <Stack
          flex={1}
          padding="$sm"
          borderRadius="$md"
          backgroundColor="$surfaceGlass"
          borderWidth={1}
          borderColor="$borderSubtle"
          flexDirection="row"
          alignItems="center"
          gap="$xs"
        >
          <Lock size={12} color="$textMuted" />
          <BodySm color={value ? "$text" : "$textMuted"}>{value || placeholder || "—"}</BodySm>
        </Stack>
        <ButtonSecondary onPress={startEdit}>
          <XStack gap="$xs" alignItems="center">
            <Pencil size={12} color="$textSecondary" />
            <BodySm color="$textSecondary">Edit</BodySm>
          </XStack>
        </ButtonSecondary>
        {secondaryAction ? (
          <ButtonGhost onPress={secondaryAction.onPress}>
            <BodySm color="$textSecondary">{secondaryAction.label}</BodySm>
          </ButtonGhost>
        ) : null}
      </XStack>
    );
  }

  return (
    <YStack gap="$xs">
      <XStack gap="$sm" alignItems="center">
        <TextInput flex={1} value={scratch} onChangeText={setScratch} placeholder={placeholder} autoFocus />
        <ButtonSecondary onPress={apply} disabled={checking}>{checking ? "Checking…" : "Apply"}</ButtonSecondary>
        <ButtonGhost onPress={cancel} disabled={checking}>Cancel</ButtonGhost>
      </XStack>
      {failReason ? (
        <XStack gap="$sm" alignItems="center">
          <Caption color="$error">{failReason}</Caption>
          <ButtonGhost onPress={() => commit(scratch)}>
            <Caption color="$textSecondary">Apply anyway</Caption>
          </ButtonGhost>
        </XStack>
      ) : null}
    </YStack>
  );
}
