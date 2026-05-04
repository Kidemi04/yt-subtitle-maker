import { YStack, Text } from "tamagui";

export default function Index() {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      backgroundColor="#0a0a0c"
      gap={16}
    >
      <Text color="#f5f5f7" fontSize={32} fontWeight="600">
        yt-subtitle-maker v2.0
      </Text>
      <Text color="#a1a1a6" fontSize={16}>
        booted — Phase 1 alpha
      </Text>
      <Text color="#fb923c" fontSize={14}>
        Tamagui + Expo stack online
      </Text>
    </YStack>
  );
}
