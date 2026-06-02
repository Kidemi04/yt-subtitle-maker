import * as React from "react";
import { Search } from "@tamagui/lucide-icons";
import { Input, Stack, XStack, YStack } from "tamagui";
import { GlassCard, BodySm, Caption, CaptionUpper } from "@yt-subtitle-maker/ui";
import { useSettings } from "./SettingsContext";
import { TABS } from "./constants";
import { SETTINGS_INDEX, type SearchEntry } from "./searchIndex";

export function SettingsSearch() {
  const { searchQuery, setSearchQuery, setActiveTab, setHighlightedSettingId } =
    useSettings();

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
    setTimeout(() => setHighlightedSettingId(e.id), 0);
  };

  const showDropdown = searchQuery.trim().length >= 2;

  return (
    <YStack gap="$sm">
      <XStack alignItems="center" justifyContent="space-between">
        <CaptionUpper>Find a setting</CaptionUpper>
        <Caption color="$textMuted">Type at least 2 characters</Caption>
      </XStack>

      <XStack
        alignItems="center"
        height={54}
        paddingHorizontal="$md"
        gap="$sm"
        borderRadius="$md"
        borderWidth={1}
        borderColor="$borderSubtle"
        backgroundColor="$bgBase"
        hoverStyle={{ borderColor: "$borderStrong" }}
        focusStyle={{ borderColor: "$accent", borderWidth: 2 }}
      >
        <Search size={18} color="$textMuted" />
        <Input
          unstyled
          flex={1}
          height="100%"
          placeholder="Search paths, cookies, model, subtitles..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          aria-label="Search settings"
          fontFamily="$body"
          fontSize={17}
          color="$textPrimary"
          placeholderTextColor="$textMuted"
          style={
            {
              color: "#141413",
              caretColor: "#a9583e",
              outline: "none",
            } as React.CSSProperties as never
          }
        />
      </XStack>

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
                    borderRadius="$sm"
                    paddingVertical="$sm"
                    paddingHorizontal="$sm"
                    backgroundColor="transparent"
                    hoverStyle={{ backgroundColor: "$surfaceGlass" }}
                    animation="quick"
                    cursor="pointer"
                    onPress={() => jump(e)}
                    aria-label={`${tabLabel} > ${e.label}`}
                  >
                    <XStack alignItems="center" gap="$xs">
                      <Caption color="$textMuted">{tabLabel} &gt;</Caption>
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
