import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import { TextInput, GlassCard, BodySm, Caption } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";
import { TABS } from "./shared";
import { SETTINGS_INDEX, type SearchEntry } from "./searchIndex";

/**
 * SettingsSearch — a search box that filters SETTINGS_INDEX on label + keywords
 * (≥2 chars), shows results as clickable "Tab › Setting" rows inside a GlassCard,
 * and on click: clears the query, switches to the matching tab, then defers a
 * setHighlightedSettingId call so SettingRow's scroll+pulse effect fires after
 * the tab content has re-mounted.
 */
export function SettingsSearch() {
  const { searchQuery, setSearchQuery, setActiveTab, setHighlightedSettingId } = useSettings();

  const results = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return SETTINGS_INDEX.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.keywords.some((kw) => kw.toLowerCase().includes(q)),
    );
  }, [searchQuery]);

  const jump = (e: SearchEntry) => {
    setSearchQuery("");
    setActiveTab(e.tab);
    // defer so the active tab re-mounts before SettingRow tries to scroll
    setTimeout(() => setHighlightedSettingId(e.id), 0);
  };

  const showDropdown = searchQuery.trim().length >= 2;

  return (
    <YStack gap="$sm">
      <TextInput
        placeholder="Search settings…"
        value={searchQuery}
        onChangeText={setSearchQuery}
        aria-label="Search settings"
      />

      {showDropdown ? (
        <GlassCard variant="mid" padding="$sm">
          {results.length === 0 ? (
            <Caption color="$textMuted">
              No settings match &ldquo;{searchQuery.trim()}&rdquo;.
            </Caption>
          ) : (
            <YStack gap="$xxs">
              {results.map((e) => {
                const tabLabel = TABS.find((t) => t.id === e.tab)?.label ?? e.tab;
                return (
                  <Stack
                    key={e.id}
                    tag="button"
                    role="button"
                    borderRadius="$md"
                    paddingVertical="$sm"
                    paddingHorizontal="$sm"
                    backgroundColor="transparent"
                    hoverStyle={{ backgroundColor: "$surfaceGlass" }}
                    animation="quick"
                    cursor="pointer"
                    onPress={() => jump(e)}
                    aria-label={`${tabLabel} › ${e.label}`}
                  >
                    <XStack alignItems="center" gap="$xs">
                      <Caption color="$textMuted">
                        {tabLabel} ›
                      </Caption>
                      <BodySm>{e.label}</BodySm>
                    </XStack>
                  </Stack>
                );
              })}
            </YStack>
          )}
        </GlassCard>
      ) : null}
    </YStack>
  );
}
