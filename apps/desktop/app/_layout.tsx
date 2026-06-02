import { Slot, usePathname, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { SettingsProvider } from "../src/components/settings/SettingsContext";
import {
  TamaguiProvider,
  Stack,
  XStack,
  YStack,
  Text,
  ScrollView,
} from "tamagui";
import {
  useFonts as useFraunces,
  Fraunces_400Regular,
} from "@expo-google-fonts/fraunces";
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
} from "@expo-google-fonts/inter";
import {
  useFonts as useMono,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import {
  Film,
  Library as LibraryIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Info,
  Bell,
  Terminal,
  X as XIcon,
  Trash2,
  Plus,
  HelpCircle,
  Search,
} from "@tamagui/lucide-icons";
import {
  SidebarItem,
  IconButton,
  Dropdown,
  DisplaySm,
  TitleLg,
  TitleMd,
  Caption,
  CaptionUpper,
  Timestamp,
  glassRecipes,
} from "@yt-subtitle-maker/ui";
import { config } from "../tamagui.config";
import { useLogs, type LogLevel } from "../src/state/logs";
import { apiClient } from "../src/state/client";
import { anyModelInstalled } from "@yt-subtitle-maker/api-client";
import { useGenerate } from "../src/state/generate";

type NavRoute = "/" | "/library" | "/history" | "/settings" | "/about";

const COMPACT_SHELL_BREAKPOINT = 1040;

const NAV_ITEMS: ReadonlyArray<{
  href: NavRoute;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}> = [
  { href: "/", label: "Generate", icon: Film },
  { href: "/library", label: "Library", icon: LibraryIcon },
  { href: "/history", label: "History", icon: HistoryIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
  { href: "/about", label: "About", icon: Info },
];

const ROUTE_TITLES: Record<string, string> = {
  "/": "Generate",
  "/library": "Library",
  "/history": "History",
  "/settings": "Settings",
  "/about": "About",
  "/init": "First-run setup",
};

const ROUTE_SUBTITLES: Record<string, string> = {
  "/": "Drop a YouTube link",
  "/library": "Browse what you've made",
  "/history": "Past sessions",
  "/settings": "Backend, cookies, engines, translation",
  "/about": "yt·subtitle v2.0 alpha",
  "/init": "One-time setup",
};

function useViewportIsCompact() {
  const [isCompact, setIsCompact] = useState(
    typeof window !== "undefined"
      ? window.innerWidth <= COMPACT_SHELL_BREAKPOINT
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const update = () =>
      setIsCompact(window.innerWidth <= COMPACT_SHELL_BREAKPOINT);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isCompact;
}

function Sidebar({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const resetGenerate = useGenerate((s) => s.reset);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <YStack
      width={compact ? 88 : 300}
      height="100%"
      paddingHorizontal={compact ? "$sm" : "$md"}
      paddingTop="$lg"
      paddingBottom="$md"
      gap="$xs"
      alignItems={compact ? "center" : undefined}
      backgroundColor="$bgBase"
      borderRightWidth={1}
      borderRightColor="$borderSubtle"
    >
      <YStack
        paddingHorizontal={2}
        paddingBottom="$lg"
        gap="$md"
        alignItems={compact ? "center" : undefined}
      >
        {compact ? (
          <YStack alignItems="center" gap={2}>
            <TitleMd fontSize={20} lineHeight={24}>
              YT
            </TitleMd>
            <CaptionUpper letterSpacing={1.2} fontSize={10}>
              Beta
            </CaptionUpper>
          </YStack>
        ) : (
          <YStack paddingHorizontal="$xs" gap={2}>
            <TitleMd fontSize={20} lineHeight={28}>
              Translator Subtitle Studio
            </TitleMd>
            <CaptionUpper letterSpacing={1.2} fontSize={13}>
              Workspace Beta
            </CaptionUpper>
          </YStack>
        )}

        <Stack
          tag="button"
          role="button"
          aria-label="New Project"
          width={compact ? 52 : undefined}
          height={52}
          borderRadius="$md"
          backgroundColor="$accent"
          alignItems="center"
          justifyContent="center"
          cursor="pointer"
          pressStyle={{ scale: 0.98 }}
          onPress={() => {
            resetGenerate();
            router.push("/");
          }}
          style={{
            border: "none",
            boxShadow: "0 8px 18px rgba(146,74,49,0.14)",
          }}
        >
          <XStack alignItems="center" gap="$xs">
            <Plus size={18} color="#ffffff" />
            {compact ? null : (
              <Text
                fontFamily="$body"
                fontSize={18}
                fontWeight="500"
                color="$onAccent"
              >
                New Project
              </Text>
            )}
          </XStack>
        </Stack>
      </YStack>

      {compact ? null : (
        <YStack paddingLeft={14} paddingBottom={6}>
          <CaptionUpper letterSpacing={1.5} fontSize={13} opacity={0.65}>
            Workspace
          </CaptionUpper>
        </YStack>
      )}

      <YStack flex={1} gap={2} alignItems={compact ? "center" : undefined}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <SidebarItem
              key={item.href}
              icon={
                <Icon size={20} color={active ? "$accent" : "$textSecondary"} />
              }
              label={item.label}
              active={active}
              compact={compact}
              onPress={() => router.push(item.href as never)}
            />
          );
        })}
      </YStack>

      <XStack
        alignItems="center"
        gap="$xs"
        paddingHorizontal="$xs"
        paddingVertical="$xs"
        borderRadius="$sm"
      >
        <HelpCircle size={18} color="$textMuted" />
        {compact ? null : <Caption>Help Support</Caption>}
      </XStack>
    </YStack>
  );
}

function Topbar({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const title = ROUTE_TITLES[pathname] ?? "";
  const subtitle = ROUTE_SUBTITLES[pathname];
  const toggleDrawer = useLogs((s) => s.toggleDrawer);
  const showRouteTitle = pathname !== "/";

  return (
    <XStack
      height={82}
      paddingHorizontal="$lg"
      alignItems="center"
      justifyContent="space-between"
      borderBottomWidth={1}
      borderBottomColor="$borderSubtle"
      backgroundColor="$bgBase"
    >
      {showRouteTitle ? (
        <YStack gap={2}>
          <TitleLg>{title}</TitleLg>
          {subtitle ? <Caption>{subtitle}</Caption> : null}
        </YStack>
      ) : (
        <Stack />
      )}
      <XStack gap="$sm" alignItems="center">
        {compact ? null : (
          <XStack
            width={300}
            height={40}
            alignItems="center"
            gap="$xs"
            paddingHorizontal="$sm"
            borderRadius="$pill"
            backgroundColor="$accentSoft"
          >
            <Search size={16} color="$textMuted" />
            <Caption fontSize={15}>Search projects...</Caption>
          </XStack>
        )}
        <IconButton
          icon={<Bell size={22} color="$textSecondary" />}
          aria-label="Notifications"
          size={44}
        />
        <IconButton
          icon={<Terminal size={22} color="$textSecondary" />}
          aria-label="Toggle logs (⌘L)"
          size={44}
          onPress={toggleDrawer}
        />
      </XStack>
    </XStack>
  );
}

const LOG_FILTER_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Error", value: "error" },
  { label: "Warning", value: "warning" },
  { label: "Info", value: "info" },
  { label: "Debug", value: "debug" },
];

function logColor(level: LogLevel): string {
  switch (level) {
    case "error":
      return "$error";
    case "warning":
      return "$warning";
    case "info":
      return "$textSecondary";
    case "debug":
      return "$textMuted";
  }
}

function logRowTint(level: LogLevel): string | undefined {
  if (level === "error") return "rgba(255,90,95,0.06)";
  if (level === "warning") return "rgba(232,165,90,0.06)";
  return undefined;
}

function formatLogTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}`;
}

function LogsDrawer() {
  const open = useLogs((s) => s.drawerOpen);
  const close = useLogs((s) => () => s.setDrawerOpen(false));
  const entries = useLogs((s) => s.entries);
  const filter = useLogs((s) => s.filter);
  const setFilter = useLogs((s) => s.setFilter);
  const clear = useLogs((s) => s.clear);

  if (!open) return null;

  const visible = entries.filter(
    (e) => filter === "all" || e.level === filter,
  );

  return (
    <YStack
      position="absolute"
      top={0}
      right={0}
      bottom={0}
      width={400}
      zIndex={1000}
      backgroundColor={glassRecipes.glassHigh.bg}
      borderLeftWidth={1}
      borderLeftColor="$borderSubtle"
      style={{
        backdropFilter: glassRecipes.glassHigh.backdropFilter,
        WebkitBackdropFilter: glassRecipes.glassHigh.backdropFilter,
        boxShadow: glassRecipes.glassHigh.boxShadow,
      }}
    >
      <XStack
        height={56}
        paddingHorizontal="$md"
        alignItems="center"
        justifyContent="space-between"
        borderBottomWidth={1}
        borderBottomColor="$borderSubtle"
      >
        <TitleMd>Logs</TitleMd>
        <XStack gap="$xs" alignItems="center">
          <Dropdown
            value={filter}
            onValueChange={(v) => setFilter(v as LogLevel | "all")}
            options={LOG_FILTER_OPTIONS}
            width={120}
            aria-label="Log level filter"
          />
          <IconButton
            icon={<Trash2 size={14} color="$textSecondary" />}
            aria-label="Clear logs"
            size={44}
            onPress={clear}
          />
          <IconButton
            icon={<XIcon size={14} color="$textSecondary" />}
            aria-label="Close logs"
            size={44}
            onPress={close}
          />
        </XStack>
      </XStack>
      <ScrollView flex={1}>
        <YStack paddingHorizontal="$md" paddingVertical="$sm">
          {visible.length === 0 ? (
            <Caption fontFamily="$mono">
              {filter === "all" ? "No log entries." : `No ${filter} entries.`}
            </Caption>
          ) : (
            visible.map((e) => (
              <XStack
                key={e.id}
                paddingVertical={4}
                paddingHorizontal="$xs"
                borderRadius="$sm"
                backgroundColor={logRowTint(e.level) as never}
                gap="$sm"
              >
                <Timestamp style={{ minWidth: 60 }}>
                  {formatLogTime(e.ts)}
                </Timestamp>
                <Text
                  fontFamily="$mono"
                  fontSize={12}
                  flex={1}
                  color={logColor(e.level) as never}
                >
                  {e.message}
                </Text>
              </XStack>
            ))
          )}
          {visible.length > 0 ? (
            <Stack
              width={8}
              height={13}
              backgroundColor="$accent"
              marginTop="$xs"
              style={{ animation: "yt-ui-pulse 1s step-end infinite" }}
            />
          ) : null}
        </YStack>
      </ScrollView>
      <XStack
        height={36}
        paddingHorizontal="$md"
        alignItems="center"
        justifyContent="space-between"
        borderTopWidth={1}
        borderTopColor="$borderSubtle"
      >
        <Caption fontSize={11}>
          {visible.length} entr{visible.length === 1 ? "y" : "ies"}
        </Caption>
        <Caption fontSize={11}>⌘L to close</Caption>
      </XStack>
    </YStack>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const toggleDrawer = useLogs((s) => s.toggleDrawer);
  const compactShell = useViewportIsCompact();

  const [frauncesLoaded] = useFraunces({ Fraunces_400Regular });
  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });
  const [monoLoaded] = useMono({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  // ⌘L / Ctrl+L logs toggle.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleDrawer();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleDrawer]);

  // Init gate — check dependencies once on first mount, redirect to /init
  // if Whisper isn't installed and the user isn't already there.
  // Honors the "yt_init_skipped" localStorage flag set by Init's Skip
  // button: if a model later becomes available, clear the flag so the
  // gate's behavior matches reality.
  useEffect(() => {
    if (pathname === "/init") return;
    let cancelled = false;
    apiClient
      .fetchDependencies()
      .then((dep) => {
        if (cancelled) return;
        const installed = anyModelInstalled(dep);
        if (typeof window !== "undefined") {
          if (installed) {
            window.localStorage.removeItem("yt_init_skipped");
          } else if (window.localStorage.getItem("yt_init_skipped") === "1") {
            return;
          }
        }
        if (!installed) router.replace("/init");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!frauncesLoaded || !interLoaded || !monoLoaded) return null;

  if (typeof document !== "undefined") {
    document.body.style.backgroundColor = "#faf9f5";
  }

  // Init runs without sidebar / topbar.
  if (pathname === "/init") {
    return (
      <TamaguiProvider config={config} defaultTheme="dark">
        <SettingsProvider>
          <Stack flex={1} backgroundColor="$bgBase">
            <Slot />
          </Stack>
        </SettingsProvider>
      </TamaguiProvider>
    );
  }

  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <SettingsProvider>
        <Stack flex={1} backgroundColor="$bgBase">
          <XStack flex={1}>
            <Sidebar compact={compactShell} />
            <YStack flex={1}>
              <Topbar compact={compactShell} />
              {pathname === "/library" ? (
                <YStack flex={1}>
                  <Slot />
                </YStack>
              ) : (
                <ScrollView
                  key={pathname}
                  flex={1}
                  contentContainerStyle={{
                    flexGrow: 1,
                    paddingHorizontal: compactShell ? 24 : 48,
                    paddingVertical: compactShell ? 28 : 44,
                  }}
                >
                  <YStack
                    width="100%"
                    maxWidth={1120}
                    gap="$lg"
                    alignSelf="center"
                  >
                    <Slot />
                  </YStack>
                </ScrollView>
              )}
            </YStack>
          </XStack>
          <LogsDrawer />
        </Stack>
      </SettingsProvider>
    </TamaguiProvider>
  );
}
