import { Slot, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
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
} from "@tamagui/lucide-icons";
import {
  SidebarItem,
  StatusDot,
  IconButton,
  Dropdown,
  glassRecipes,
} from "@yt-subtitle-maker/ui";
import { config } from "../tamagui.config";
import { useLogs, type LogLevel } from "../src/state/logs";
import { apiClient } from "../src/state/client";

type NavRoute = "/" | "/library" | "/history" | "/settings" | "/about";

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

function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <YStack
      width={240}
      height="100%"
      paddingHorizontal="$sm"
      paddingVertical="$lg"
      gap="$xs"
      backgroundColor="$bgElevated"
      borderRightWidth={1}
      borderRightColor="$borderSubtle"
      style={{
        backdropFilter: glassRecipes.glassMid.backdropFilter,
        WebkitBackdropFilter: glassRecipes.glassMid.backdropFilter,
      }}
    >
      <YStack paddingHorizontal="$md" paddingBottom="$lg">
        <Text
          fontFamily="$display"
          fontSize={20}
          color="$textPrimary"
          letterSpacing={-0.4}
        >
          yt·subtitle
        </Text>
        <Text
          fontFamily="$body"
          fontSize={11}
          fontWeight="600"
          letterSpacing={1.5}
          textTransform="uppercase"
          color="$textMuted"
        >
          v2.0 · alpha
        </Text>
      </YStack>

      <YStack flex={1} gap={2}>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <SidebarItem
              key={item.href}
              icon={
                <Icon size={16} color={active ? "#fb923c" : "#a1a1a6"} />
              }
              label={item.label}
              active={active}
              onPress={() => router.push(item.href as never)}
            />
          );
        })}
      </YStack>

      <XStack
        alignItems="center"
        gap="$sm"
        paddingHorizontal="$md"
        paddingVertical="$sm"
        borderTopWidth={1}
        borderTopColor="$borderSubtle"
      >
        <StatusDot status="ok" size={8} />
        <Text fontFamily="$body" fontSize={12} color="$textMuted">
          Backend · 127.0.0.1:8000
        </Text>
      </XStack>
    </YStack>
  );
}

function Topbar() {
  const pathname = usePathname();
  const title = ROUTE_TITLES[pathname] ?? "";
  const toggleDrawer = useLogs((s) => s.toggleDrawer);

  return (
    <XStack
      height={64}
      paddingHorizontal="$lg"
      alignItems="center"
      justifyContent="space-between"
      borderBottomWidth={1}
      borderBottomColor="$borderSubtle"
      style={{
        backdropFilter: glassRecipes.glassHigh.backdropFilter,
        WebkitBackdropFilter: glassRecipes.glassHigh.backdropFilter,
      }}
    >
      <Text
        fontFamily="$display"
        fontSize={22}
        letterSpacing={-0.3}
        color="$textPrimary"
      >
        {title}
      </Text>
      <XStack gap="$xs" alignItems="center">
        <IconButton
          icon={<Bell size={16} color="#a1a1a6" />}
          aria-label="Notifications"
          size={32}
        />
        <IconButton
          icon={<Terminal size={16} color="#a1a1a6" />}
          aria-label="Toggle logs (⌘L)"
          size={32}
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
        <Text
          fontFamily="$body"
          fontSize={15}
          fontWeight="600"
          color="$textPrimary"
        >
          Logs
        </Text>
        <XStack gap="$xs" alignItems="center">
          <Dropdown
            value={filter}
            onValueChange={(v) => setFilter(v as LogLevel | "all")}
            options={LOG_FILTER_OPTIONS}
            width={120}
            aria-label="Log level filter"
          />
          <IconButton
            icon={<Trash2 size={14} color="#a1a1a6" />}
            aria-label="Clear logs"
            size={32}
            onPress={clear}
          />
          <IconButton
            icon={<XIcon size={14} color="#a1a1a6" />}
            aria-label="Close logs"
            size={32}
            onPress={close}
          />
        </XStack>
      </XStack>
      <ScrollView flex={1}>
        <YStack paddingHorizontal="$md" paddingVertical="$sm">
          {visible.length === 0 ? (
            <Text fontFamily="$mono" fontSize={12} color="$textMuted">
              {filter === "all" ? "No log entries." : `No ${filter} entries.`}
            </Text>
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
                <Text
                  fontFamily="$mono"
                  fontSize={11}
                  fontWeight="500"
                  color="$textMuted"
                  style={{
                    fontFeatureSettings: "'tnum'",
                    minWidth: 60,
                  }}
                >
                  {formatLogTime(e.ts)}
                </Text>
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
        <Text fontFamily="$body" fontSize={11} color="$textMuted">
          {visible.length} entr{visible.length === 1 ? "y" : "ies"}
        </Text>
        <Text fontFamily="$body" fontSize={11} color="$textMuted">
          ⌘L to close
        </Text>
      </XStack>
    </YStack>
  );
}

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const toggleDrawer = useLogs((s) => s.toggleDrawer);

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
  useEffect(() => {
    if (pathname === "/init") return;
    let cancelled = false;
    apiClient
      .fetchDependencies()
      .then((dep) => {
        if (cancelled) return;
        if (!dep.whisperModelInstalled) router.replace("/init");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!frauncesLoaded || !interLoaded || !monoLoaded) return null;

  // Init runs without sidebar / topbar.
  if (pathname === "/init") {
    return (
      <TamaguiProvider config={config} defaultTheme="dark">
        <Stack flex={1} backgroundColor="$bgBase">
          <Slot />
        </Stack>
      </TamaguiProvider>
    );
  }

  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <Stack flex={1} backgroundColor="$bgBase">
        <XStack flex={1}>
          <Sidebar />
          <YStack flex={1}>
            <Topbar />
            <ScrollView
              flex={1}
              contentContainerStyle={{
                flexGrow: 1,
                paddingHorizontal: 32,
                paddingVertical: 32,
              }}
            >
              <YStack
                width="100%"
                maxWidth={960}
                gap="$lg"
                alignSelf="center"
              >
                <Slot />
              </YStack>
            </ScrollView>
          </YStack>
        </XStack>
        <LogsDrawer />
      </Stack>
    </TamaguiProvider>
  );
}
