import { Stack } from "expo-router";
import { TamaguiProvider } from "tamagui";
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
import { config } from "../tamagui.config";

export default function RootLayout() {
  // Only the weights actually referenced in tokens are loaded:
  //   Fraunces 400 (display) — single weight by design.
  //   Inter 400/500/600     — body, captionUpper-600, timestamp-500-via-mono fallback unused here.
  //   JetBrainsMono 400/500 — code, timestamp.
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

  if (!frauncesLoaded || !interLoaded || !monoLoaded) {
    // Tauri shell is the splash; rendering null here just delays the first
    // paint until fonts have registered with the browser.
    return null;
  }

  return (
    <TamaguiProvider config={config} defaultTheme="dark">
      <Stack screenOptions={{ headerShown: false }} />
    </TamaguiProvider>
  );
}
