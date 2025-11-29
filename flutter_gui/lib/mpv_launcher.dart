import 'dart:io';

class MpvLauncher {
  static Future<void> play(String videoSource, {String? subtitlePath}) async {
    // Try to find mpv in PATH or common locations
    // For simplicity, we assume it's in PATH or we can check specific paths
    // On Windows, Process.run('where', ['mpv']) might help, but let's just try running it.
    
    final args = [videoSource];
    if (subtitlePath != null) {
      // Normalize path for Windows (MPV usually handles / fine, but just in case)
      final normalizedPath = subtitlePath.replaceAll('\\', '/');
      print("MpvLauncher: Adding subtitle path: $normalizedPath");
      args.add('--sub-file=$normalizedPath');
    } else {
      print("MpvLauncher: No subtitle path provided.");
    }

    print("MpvLauncher: Running mpv with args: $args");

    try {
      await Process.start('mpv', args, mode: ProcessStartMode.detached);
    } catch (e) {
      print("MpvLauncher Error: $e");
      // If failed, maybe try full path if known, or throw
      throw Exception("Failed to launch mpv: $e. Make sure mpv is in your PATH.");
    }
  }
}
