import * as React from "react";
import { Stack, XStack, YStack } from "tamagui";
import {
  GlassCard,
  TextInput,
  Dropdown,
  ButtonSecondary,
  StatusDot,
  BodySm,
  Caption,
} from "@yt-subtitle-maker/ui";
import { type AppConfig } from "@yt-subtitle-maker/api-client";
import { apiClient } from "../../state/client";
import { useSettings } from "./SettingsContext";
import { Section, SettingRow } from "./shared";
import { COOKIE_BROWSERS } from "./constants";
import { ArmedField } from "./ArmedField";
import { isTauri, openExecutableDialog } from "../../lib/native";

export function YouTubeTab() {
  const {
    draft,
    update,
    flush,
    cookieStatus,
    cookieError,
    cookieSource,
    cookiesAttached,
    testCookies,
    jsRuntime,
  } = useSettings();
  if (!draft) return null;
  return (
    <GlassCard variant="mid">
      <YStack gap="$md">
        <Section
          title="Cookies & YouTube"
          subtitle="Some YouTube videos require browser cookies. Firefox is the most reliable extractor."
        />
        <SettingRow id="youtube.cookie-source" label="Cookie source">
          <Dropdown
            value={draft.cookieBrowser}
            onValueChange={(v) =>
              update("cookieBrowser", v as AppConfig["cookieBrowser"])
            }
            options={COOKIE_BROWSERS}
            width="100%"
          />
        </SettingRow>
        {draft.cookieBrowser ? (
          <SettingRow
            id="youtube.cookie-profile"
            label="Browser profile"
            helper="Optional — leave blank for default profile."
          >
            <TextInput
              value={draft.cookieProfile}
              onChangeText={(v: string) => update("cookieProfile", v)}
            />
          </SettingRow>
        ) : null}
        <SettingRow
          id="youtube.cookies-txt-path"
          label="cookies.txt path"
          helper="Optional fallback — overrides browser cookies."
        >
          <TextInput
            value={draft.cookiesTxtPath}
            onChangeText={(v: string) => update("cookiesTxtPath", v)}
          />
        </SettingRow>
        <XStack
          alignItems="center"
          justifyContent="space-between"
          padding="$sm"
          borderRadius="$md"
          backgroundColor={
            cookieStatus === "ok"
              ? "rgba(93,184,114,0.10)"
              : cookieStatus === "error"
              ? "rgba(255,90,95,0.10)"
              : "$surfaceGlass"
          }
          borderWidth={1}
          borderColor={
            cookieStatus === "ok"
              ? "rgba(93,184,114,0.25)"
              : cookieStatus === "error"
              ? "rgba(255,90,95,0.25)"
              : "$borderSubtle"
          }
        >
          <YStack gap={2} flex={1}>
            <XStack gap="$sm" alignItems="center">
              <StatusDot status={cookieStatus} size={8} />
              <BodySm>
                {cookieStatus === "ok"
                  ? cookiesAttached
                    ? `Cookies attached (${cookieSource ?? "configured"})`
                    : "Reachable, but no cookies were sent"
                  : cookieStatus === "error"
                  ? `Failed: ${cookieError ?? "unknown"}`
                  : "Untested — click Test to verify (uses your DRAFT settings)."}
              </BodySm>
            </XStack>
            {cookieStatus === "ok" && !cookiesAttached ? (
              <Caption>
                This only verified yt-dlp can reach a public video; it does
                not prove cookies will work on age-restricted content.
              </Caption>
            ) : null}
          </YStack>
          <ButtonSecondary onPress={testCookies}>Test</ButtonSecondary>
        </XStack>
        {["chrome", "edge", "brave", "opera"].includes(draft.cookieBrowser) ? (
          <Stack
            padding="$sm"
            borderRadius="$md"
            backgroundColor="rgba(232,165,90,0.10)"
            borderColor="rgba(232,165,90,0.30)"
            borderWidth={1}
          >
            <Caption color="$warning">
              ⚠ Chromium-based browsers (Chrome 127+) encrypt cookies with
              App-Bound Encryption. Extraction may fail. Use Firefox or
              cookies.txt fallback.
            </Caption>
          </Stack>
        ) : null}
        <SettingRow
          id="youtube.js-runtime-path"
          label="JS runtime for yt-dlp"
          helper={
            jsRuntime
              ? `Detected: ${jsRuntime}`
              : "⚠ No runtime detected — install Node or Deno, or set the path here. Without one, YouTube extraction degrades."
          }
        >
          <ArmedField
            value={draft.jsRuntimePath}
            placeholder="(auto-detect node/deno on PATH)"
            validate={async (v) => {
              if (!v.trim()) return { ok: true };
              try {
                const r = await apiClient.checkFs({ path: v, kind: "executable" });
                if (r.exists && r.executable) return { ok: true };
                return {
                  ok: false,
                  reason: r.exists
                    ? `Found but not executable: ${v}`
                    : `Runtime not found: ${v}`,
                };
              } catch (err) {
                return {
                  ok: false,
                  reason: `Couldn't check the path: ${err instanceof Error ? err.message : String(err)}`,
                };
              }
            }}
            onApply={(v) => {
              update("jsRuntimePath", v);
              flush();
            }}
            secondaryAction={
              isTauri()
                ? {
                    label: "Browse…",
                    onPress: async () => {
                      const picked = await openExecutableDialog();
                      if (picked) {
                        update("jsRuntimePath", picked);
                        flush();
                      }
                    },
                  }
                : undefined
            }
          />
        </SettingRow>
      </YStack>
    </GlassCard>
  );
}
