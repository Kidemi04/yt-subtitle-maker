import { XStack, YStack, Text } from "tamagui";
import {
  Modal,
  ButtonPrimary,
  ButtonSecondary,
  BodyMd,
  BodySm,
  Caption,
} from "@yt-subtitle-maker/ui";
import { useDependencies } from "../../state/dependencies";

export interface InstallMpvDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a successful install — the caller typically retries the original Play. */
  onInstalled?: () => void;
}

export function InstallMpvDialog({ open, onOpenChange, onInstalled }: InstallMpvDialogProps) {
  const progress = useDependencies((s) => s.installProgress);
  const error = useDependencies((s) => s.installError);
  const unsupportedUrl = useDependencies((s) => s.unsupportedManualUrl);
  const installMpv = useDependencies((s) => s.installMpv);

  // Note: unsupportedManualUrl is set lazily after the first install attempt; no pre-probe needed.

  const handleInstall = async () => {
    const ok = await installMpv();
    if (ok) {
      onOpenChange(false);
      onInstalled?.();
    }
  };

  const percent =
    progress?.phase === "downloading" && progress.bytesTotal && progress.bytesReceived
      ? Math.round((progress.bytesReceived / progress.bytesTotal) * 100)
      : null;

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Install mpv" width={460}>
      <YStack gap="$md">
        {unsupportedUrl ? (
          <>
            <BodyMd>
              mpv auto-install isn't available on this platform yet. Please install it
              manually from{" "}
              <Text
                color="$accent"
                cursor="pointer"
                textDecorationLine="underline"
                onPress={() => {
                  if (typeof window !== "undefined") {
                    window.open(unsupportedUrl, "_blank", "noopener,noreferrer");
                  }
                }}
              >
                mpv.io
              </Text>
              .
            </BodyMd>
            <XStack justifyContent="flex-end">
              <ButtonSecondary onPress={() => onOpenChange(false)}>Close</ButtonSecondary>
            </XStack>
          </>
        ) : progress ? (
          <>
            <BodyMd>
              {progress.phase === "downloading"
                ? `Downloading mpv… ${percent ?? 0}%`
                : progress.phase === "resolving"
                  ? "Resolving download…"
                  : progress.phase === "verifying"
                    ? "Verifying integrity…"
                    : progress.phase === "extracting"
                      ? "Unpacking archive…"
                      : "Working…"}
            </BodyMd>
            {percent !== null ? (
              <YStack
                height={6}
                width="100%"
                backgroundColor="$surfaceGlassMid"
                borderRadius="$pill"
                overflow="hidden"
              >
                <YStack height="100%" width={`${percent}%`} backgroundColor="$accent" />
              </YStack>
            ) : null}
            <Caption color="$textMuted">
              Installing into the app folder — your system isn't touched.
            </Caption>
          </>
        ) : (
          <>
            <BodyMd>
              mpv is required to play your video with subtitles. Download it now? (~30 MB)
            </BodyMd>
            <BodySm color="$textSecondary">
              It will be installed inside the app folder ({"~/.yt_subtitle_tool/bin/"}). Your
              system isn't touched.
            </BodySm>
            {error ? <BodySm color="$error">Install failed: {error}</BodySm> : null}
            <XStack gap="$sm" justifyContent="flex-end">
              <ButtonSecondary onPress={() => onOpenChange(false)}>Cancel</ButtonSecondary>
              <ButtonPrimary onPress={handleInstall}>Download mpv</ButtonPrimary>
            </XStack>
          </>
        )}
      </YStack>
    </Modal>
  );
}
