import 'dart:convert';
import 'dart:io';

class MpvLauncher {
  /// Optional custom path to mpv executable (e.g. "C:/MPV/mpv.exe").
  /// If empty, falls back to "mpv.exe" (Windows) or "mpv" (other), relying on PATH.
  static String mpvExecutable = '';

  /// Directory where mpv log files are written. Defaults to system temp.
  static String? logDirectory;

  static Future<void> play(
    String videoSource, {
    String? subtitlePath,
    String? cookieBrowser,
    String? cookieProfile,
    String? cookiesTxtPath,
  }) async {
    // Set up log file
    final logDir = logDirectory ?? Directory.systemTemp.path;
    final timestamp = DateTime.now().toIso8601String().replaceAll(':', '-');
    final logFile = '$logDir/mpv_$timestamp.log';

    final args = <String>[
      '--log-file=$logFile',
      '--msg-level=all=v', // verbose logging
    ];

    // Pass cookie options to yt-dlp via mpv's ytdl-raw-options
    final ytdlOpts = <String>[];
    if (cookiesTxtPath != null && cookiesTxtPath.isNotEmpty) {
      ytdlOpts.add('cookies=${cookiesTxtPath}');
    } else if (cookieBrowser != null && cookieBrowser.isNotEmpty) {
      final browser = cookieProfile != null && cookieProfile.isNotEmpty
          ? '$cookieBrowser:$cookieProfile'
          : cookieBrowser;
      ytdlOpts.add('cookies-from-browser=${browser}');
    }
    if (ytdlOpts.isNotEmpty) {
      args.add('--ytdl-raw-options=${ytdlOpts.join(",")}');
    }

    args.add(videoSource);

    if (subtitlePath != null) {
      final normalizedPath = subtitlePath.replaceAll('\\', '/');
      print("MpvLauncher: Adding subtitle path: $normalizedPath");
      args.add('--sub-file=$normalizedPath');
    } else {
      print("MpvLauncher: No subtitle path provided.");
    }

    print("MpvLauncher: Running mpv with args: $args");
    print("MpvLauncher: Log file -> $logFile");

    try {
      final String exe;
      if (mpvExecutable.isNotEmpty) {
        exe = mpvExecutable;
      } else if (Platform.isWindows) {
        exe = 'mpv.exe';
      } else {
        exe = 'mpv';
      }

      print("MpvLauncher: exe=$exe");
      // Use normal mode so Windows can properly show the GUI window.
      final process = await Process.start(exe, args, runInShell: false);

      // Print stderr to Flutter console for quick debugging
      process.stderr.transform(utf8.decoder).listen((data) {
        print("MPV stderr: $data");
      });
      process.stdout.drain();
    } catch (e) {
      print("MpvLauncher Error: $e");
      throw Exception("Failed to launch mpv: $e. Make sure mpv is in your PATH or set the path in Settings.");
    }
  }
}
