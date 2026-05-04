import { Slot, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";
import { TamaguiProvider, Stack, XStack, YStack, Text, ScrollView } from "tamagui";
import { useFonts as useFraunces, Fraunces_400Regular } from "@expo-google-fonts/fraunces";
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
} from "@tamagui/lucide-icons";
import {
  SidebarItem,
  StatusDot,
  IconButton,
  glassRecipes,
} from "@yt-subtitle-maker/ui";
import { config } from "../tamagui.config";

/**
 * Root layout — desktop sidebar + topbar shell wrapping every route.
 *
 * Layout (per docs/superpowers/specs §2):
 *   240px sidebar (left) + 64px topbar (top) + main content area.
 *
 * The sidebar's active item is computed from `usePathname()`; clicking
 * navigates via `useRouter().push()`. The Logs drawer is wired via ⌘L /
 * Ctrl+L keyboard listener (Phase 10 lands the actual drawer surface;
 * for now the IconButton no-ops).
 */

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
      {/* Wordmark */}
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

      {/* Nav rows */}
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

      {/* Backend status footer */}
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
        />
      </XStack>
    </XStack>
  );
}

export default function RootLayout() {
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

  // Cmd/Ctrl+L keyboard shortcut for logs drawer (no-op until Phase 10).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        // TODO Phase 10: open Logs drawer
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!frauncesLoaded || !interLoaded || !monoLoaded) return null;

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
              <YStack width="100%" maxWidth={960} gap="$lg" alignSelf="center">
                <Slot />
              </YStack>
            </ScrollView>
          </YStack>
        </XStack>
      </Stack>
    </TamaguiProvider>
  );
}
