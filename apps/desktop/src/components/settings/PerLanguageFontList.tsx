import * as React from "react";
import { XStack, YStack } from "tamagui";
import { Plus, Trash2 } from "@tamagui/lucide-icons";
import {
  BodySm,
  ButtonGhost,
  Caption,
  IconButton,
  TextInput,
} from "@yt-subtitle-maker/ui";
import { FontPicker } from "./FontPicker";

interface Row {
  /** Stable client-side id so a row keeps focus while the user retypes its lang code. */
  uid: number;
  lang: string;
  font: string;
}

let _uid = 0;
const nextUid = () => ++_uid;

/**
 * Per-language font override editor for Settings → Subtitles. Renders rows of
 * `[lang code text] [font picker] [trash]` plus a "+ Add language" button.
 * Empty-lang rows are kept locally for editing but stripped when emitting the
 * Record<string, string> upstream; that way users can type a code without us
 * blowing away the in-progress row each keystroke.
 *
 * The backend matches the active sub's BCP-47 code: exact code wins ("zh-CN")
 * then primary subtag prefix ("zh" → zh-CN / zh-Hans / zh-TW). Falls back to
 * the global subFont, then a platform CJK default. See `_resolve_sub_font`
 * in backend/api/routes/library.py.
 */
export function PerLanguageFontList({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  // Local row state — needed so an empty lang field doesn't disappear mid-edit.
  // We seed from `value` once; subsequent upstream changes (e.g. preset
  // resetting to {}) re-seed via the React.useEffect below.
  const [rows, setRows] = React.useState<Row[]>(() =>
    Object.entries(value || {}).map(([lang, font]) => ({
      uid: nextUid(),
      lang,
      font,
    })),
  );

  // Re-seed when the upstream value diverges from our row contents (e.g. a
  // reset-to-defaults wiped the map). Avoid an effect-loop by only running
  // when the upstream snapshot doesn't match what we'd emit.
  const upstreamSig = React.useMemo(
    () =>
      Object.entries(value || {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("|"),
    [value],
  );
  const localSig = React.useMemo(
    () =>
      rows
        .filter((r) => r.lang.trim())
        .map((r) => [r.lang.trim(), r.font] as const)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${k}=${v}`)
        .join("|"),
    [rows],
  );
  React.useEffect(() => {
    if (upstreamSig !== localSig) {
      setRows(
        Object.entries(value || {}).map(([lang, font]) => ({
          uid: nextUid(),
          lang,
          font,
        })),
      );
    }
    // We only want this to fire on UPSTREAM changes, not on our own local
    // edits — comparing signatures gates it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upstreamSig]);

  const emit = (nextRows: Row[]) => {
    setRows(nextRows);
    const out: Record<string, string> = {};
    for (const r of nextRows) {
      const k = r.lang.trim();
      if (k && r.font) out[k] = r.font;
    }
    onChange(out);
  };

  const updateRow = (uid: number, patch: Partial<Pick<Row, "lang" | "font">>) => {
    emit(rows.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  };

  const removeRow = (uid: number) => {
    emit(rows.filter((r) => r.uid !== uid));
  };

  const addRow = () => {
    // Don't pile on empty rows — focus the existing empty one instead.
    if (rows.some((r) => !r.lang.trim())) return;
    setRows([...rows, { uid: nextUid(), lang: "", font: "" }]);
  };

  return (
    <YStack gap="$sm">
      {rows.length === 0 ? (
        <Caption color="$textMuted">
          No overrides — every sub uses the global font above.
        </Caption>
      ) : null}
      {rows.map((row) => (
        <XStack key={row.uid} gap="$sm" alignItems="center">
          <YStack width={120}>
            <TextInput
              value={row.lang}
              onChangeText={(v) => updateRow(row.uid, { lang: v })}
              placeholder="zh / zh-CN / ja"
              aria-label="Language code"
            />
          </YStack>
          <YStack flex={1}>
            <FontPicker
              value={row.font}
              onChangeText={(v) => updateRow(row.uid, { font: v })}
            />
          </YStack>
          <IconButton
            icon={<Trash2 size={14} color="$textSecondary" />}
            size={44}
            aria-label="Remove language override"
            onPress={() => removeRow(row.uid)}
          />
        </XStack>
      ))}
      <XStack>
        <ButtonGhost onPress={addRow}>
          <XStack gap="$xs" alignItems="center">
            <Plus size={14} color="$textSecondary" />
            <BodySm fontWeight="500" color="$textSecondary">
              Add language
            </BodySm>
          </XStack>
        </ButtonGhost>
      </XStack>
    </YStack>
  );
}
