import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_service.dart';
import '../models.dart';
import '../mpv_launcher.dart';
import '../history_service.dart';

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

final urlProvider = StateProvider<String>((ref) => '');
final metadataProvider = StateProvider<VideoMetadata?>((ref) => null);
final isProcessingProvider = StateProvider<bool>((ref) => false);
final isLoadingMetadataProvider = StateProvider<bool>((ref) => false);
final logProvider = StateProvider<List<String>>((ref) => []);
final currentSubtitlePathProvider = StateProvider<String?>((ref) => null);
final currentAudioPathProvider = StateProvider<String?>((ref) => null);
final translatedTitleProvider = StateProvider<String?>((ref) => null);
final processStatusProvider = StateProvider<String>((ref) => '');
final processProgressProvider = StateProvider<double?>((ref) => null); // null = indeterminate
final processErrorProvider = StateProvider<String?>((ref) => null);

// Settings providers
final sourceLangProvider = StateProvider<String>((ref) => 'auto');
final targetLangProvider = StateProvider<String>((ref) => 'zh-CN');
final whisperDeviceProvider = StateProvider<String>((ref) => 'auto');
final whisperModelProvider = StateProvider<String>((ref) => 'turbo');
final geminiModelProvider = StateProvider<String>((ref) => 'gemini-2.5-flash-lite');
final geminiApiKeyProvider = StateProvider<String>((ref) => '');
final enableTranslationProvider = StateProvider<bool>((ref) => true);
final apiKeyStatusProvider = StateProvider<String>((ref) => 'Not tested');

const languageMap = {
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  'en': 'English',
  'ja': 'Japanese',
  'ko': 'Korean',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'id': 'Indonesian',
  'ms': 'Malay',
  'hi': 'Hindi',
};

const sourceLangMap = {
  'auto': 'Auto Detect',
  'en': 'English',
  'zh': 'Chinese',
  'ja': 'Japanese',
  'ko': 'Korean',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'pt': 'Portuguese',
  'ru': 'Russian',
  'vi': 'Vietnamese',
  'th': 'Thai',
  'id': 'Indonesian',
  'ms': 'Malay',
  'hi': 'Hindi',
  'ar': 'Arabic',
};

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

class ControlPanel extends ConsumerStatefulWidget {
  const ControlPanel({super.key});

  @override
  ConsumerState<ControlPanel> createState() => _ControlPanelState();
}

class _ControlPanelState extends ConsumerState<ControlPanel> {
  final TextEditingController _urlController = TextEditingController();
  final TextEditingController _apiKeyController = TextEditingController();
  bool _showApiKey = false;
  bool _configLoaded = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _initConfig());
  }

  @override
  void dispose() {
    _urlController.dispose();
    _apiKeyController.dispose();
    super.dispose();
  }

  Future<void> _initConfig() async {
    if (_configLoaded) return;
    final config = await ref.read(apiServiceProvider).getConfig();
    if (config == null || !mounted) return;
    _configLoaded = true;

    if (config['whisper_model'] != null) {
      ref.read(whisperModelProvider.notifier).state = config['whisper_model'];
    }
    if (config['whisper_device'] != null) {
      ref.read(whisperDeviceProvider.notifier).state = (config['whisper_device'] as String).toLowerCase();
    }
    if (config['target_lang'] != null) {
      ref.read(targetLangProvider.notifier).state = config['target_lang'];
    }
    if (config['source_lang'] != null) {
      ref.read(sourceLangProvider.notifier).state = config['source_lang'];
    }
    if (config['gemini_model'] != null) {
      ref.read(geminiModelProvider.notifier).state = config['gemini_model'];
    }
    if (config['enable_translation'] != null) {
      ref.read(enableTranslationProvider.notifier).state = config['enable_translation'];
    }
    final savedKey = config['gemini_api_key'];
    if (savedKey != null && savedKey.toString().isNotEmpty) {
      _apiKeyController.text = savedKey.toString();
      ref.read(geminiApiKeyProvider.notifier).state = savedKey.toString();
    }
  }

  void _log(String message) {
    final ts = DateTime.now().toIso8601String().split('T')[1].split('.')[0];
    ref.read(logProvider.notifier).update((state) => [...state, '[$ts] $message']);
  }

  Future<void> _fetchMetadata() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;

    ref.read(isLoadingMetadataProvider.notifier).state = true;
    ref.read(translatedTitleProvider.notifier).state = null;
    ref.read(currentSubtitlePathProvider.notifier).state = null;
    ref.read(currentAudioPathProvider.notifier).state = null;
    _log('Fetching metadata...');

    final meta = await ref.read(apiServiceProvider).fetchMetadata(url);
    ref.read(isLoadingMetadataProvider.notifier).state = false;

    if (meta.ok) {
      ref.read(metadataProvider.notifier).state = meta;
      ref.read(urlProvider.notifier).state = url;
      _log('Loaded: ${meta.titleOriginal}');
    } else {
      _log('Error: ${meta.error}');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Error: ${meta.error}'),
          backgroundColor: Colors.red,
          behavior: SnackBarBehavior.floating,
        ));
      }
    }
  }

  Future<void> _translateTitle() async {
    final meta = ref.read(metadataProvider);
    final apiKey = _apiKeyController.text.trim();
    if (meta == null || meta.titleOriginal == null || apiKey.isEmpty) return;

    _log('Translating title...');
    final translated = await ref.read(apiServiceProvider).translateTitle(
      title: meta.titleOriginal!,
      targetLang: ref.read(targetLangProvider),
      apiKey: apiKey,
      model: ref.read(geminiModelProvider),
    );

    if (translated != null) {
      ref.read(translatedTitleProvider.notifier).state = translated;
      _log('Title translated: $translated');
    } else {
      _log('Title translation failed.');
    }
  }

  Future<void> _testApiKey() async {
    final apiKey = _apiKeyController.text.trim();
    if (apiKey.isEmpty) return;

    ref.read(apiKeyStatusProvider.notifier).state = 'Testing...';
    final valid = await ref.read(apiServiceProvider).testApiKey(
      apiKey, ref.read(geminiModelProvider));
    ref.read(apiKeyStatusProvider.notifier).state = valid ? 'Valid ✓' : 'Invalid ✗';
  }

  Future<void> _startProcessing() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;

    ref.read(isProcessingProvider.notifier).state = true;
    ref.read(processErrorProvider.notifier).state = null;
    ref.read(processStatusProvider.notifier).state = 'Starting...';
    ref.read(processProgressProvider.notifier).state = null;
    _log('Starting processing...');

    String? videoId;
    String? originalSrtPath;
    String? translatedSrtPath;
    String? audioPath;
    bool success = false;

    await for (final event in ref.read(apiServiceProvider).processVideo(
      url: url,
      sourceLang: ref.read(sourceLangProvider),
      targetLang: ref.read(targetLangProvider),
      whisperDevice: ref.read(whisperDeviceProvider),
      whisperModel: ref.read(whisperModelProvider),
      geminiModel: ref.read(geminiModelProvider),
      geminiApiKey: _apiKeyController.text.trim(),
      enableTranslation: ref.read(enableTranslationProvider),
    )) {
      if (!mounted) break;

      final status = event['status'];
      if (status == 'starting') {
        ref.read(processStatusProvider.notifier).state = 'Fetching info...';
        ref.read(processProgressProvider.notifier).state = null;
        _log(event['message']?.toString() ?? 'Preparing...');
      } else if (status == 'downloading') {
        ref.read(processStatusProvider.notifier).state = 'Downloading audio...';
        ref.read(processProgressProvider.notifier).state = null;
        _log(event['message']?.toString() ?? 'Downloading...');
      } else if (status == 'transcribing') {
        final progress = event['progress'];
        if (progress != null) {
          ref.read(processProgressProvider.notifier).state = (progress as num).toDouble();
          ref.read(processStatusProvider.notifier).state =
              'Transcribing... ${((progress as num) * 100).toStringAsFixed(0)}%';
        } else {
          ref.read(processProgressProvider.notifier).state = null;
          ref.read(processStatusProvider.notifier).state = 'Transcribing with Whisper...';
        }
        if (event['message'] != null) _log(event['message'].toString());
      } else if (status == 'translating') {
        final tprog = event['progress'];
        if (tprog != null) {
          final tp = (tprog as num).toDouble();
          ref.read(processProgressProvider.notifier).state = tp;
          ref.read(processStatusProvider.notifier).state =
              'Translating... ${(tp * 100).toStringAsFixed(0)}%';
        } else {
          ref.read(processProgressProvider.notifier).state = null;
          ref.read(processStatusProvider.notifier).state = 'Translating subtitles...';
        }
        if (event['message'] != null) _log(event['message'].toString());
      } else if (status == 'done') {
        success = true;
        videoId = event['video_id']?.toString();
        originalSrtPath = event['original_srt_path']?.toString();
        translatedSrtPath = event['translated_srt_path']?.toString();
        audioPath = event['video_file_path']?.toString();
        ref.read(processStatusProvider.notifier).state = 'Done!';
        ref.read(processProgressProvider.notifier).state = 1.0;
        _log('Processing complete!');
        if (originalSrtPath != null) _log('Original SRT: $originalSrtPath');
        if (translatedSrtPath != null) _log('Translated SRT: $translatedSrtPath');
      } else if (status == 'error') {
        ref.read(processStatusProvider.notifier).state = '';
        ref.read(processProgressProvider.notifier).state = null;
        ref.read(processErrorProvider.notifier).state =
            event['error']?.toString() ?? 'Unknown error';
        _log('Error: ${event['error']}');
      }
    }

    if (mounted) {
      ref.read(isProcessingProvider.notifier).state = false;

      if (success) {
        final finalSubtitle = translatedSrtPath ?? originalSrtPath;
        ref.read(currentSubtitlePathProvider.notifier).state = finalSubtitle;
        ref.read(currentAudioPathProvider.notifier).state = audioPath;
        ref.read(processStatusProvider.notifier).state = '';
        ref.read(processProgressProvider.notifier).state = null;

        final meta = ref.read(metadataProvider);
        ref.read(historyProvider.notifier).addToHistory(HistoryItem(
          url: url,
          videoId: videoId,
          titleOriginal: meta?.titleOriginal ?? 'Unknown Title',
          titleTranslated: ref.read(translatedTitleProvider),
          targetLang:
              ref.read(enableTranslationProvider) ? ref.read(targetLangProvider) : null,
          subtitlePath: finalSubtitle,
          audioPath: audioPath,
          thumbnailUrl: meta?.thumbnailUrl,
          lastUsed: DateTime.now().toIso8601String(),
        ));
      } else {
        ref.read(processStatusProvider.notifier).state = '';
        ref.read(processProgressProvider.notifier).state = null;
      }
    }
  }

  /// Returns a soft Gemini model recommendation based on video duration.
  String? _geminiModelRecommendation(double? durationSeconds) {
    if (durationSeconds == null || durationSeconds <= 0) return null;
    if (durationSeconds < 600) return 'gemini-2.5-flash-lite'; // <10min
    if (durationSeconds < 1800) return 'gemini-2.5-flash';     // 10-30min
    return null; // >30min: show warning instead
  }

  String _formatDuration(double seconds) {
    final h = (seconds / 3600).floor();
    final m = ((seconds % 3600) / 60).floor();
    final s = (seconds % 60).floor();
    if (h > 0) {
      return '$h:${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
    }
    return '$m:${s.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(urlProvider, (_, next) {
      if (_urlController.text != next) _urlController.text = next;
    });

    final meta = ref.watch(metadataProvider);
    final isProcessing = ref.watch(isProcessingProvider);
    final isLoadingMeta = ref.watch(isLoadingMetadataProvider);
    final apiKeyStatus = ref.watch(apiKeyStatusProvider);
    final translatedTitle = ref.watch(translatedTitleProvider);
    final processStatus = ref.watch(processStatusProvider);
    final processProgress = ref.watch(processProgressProvider);
    final processError = ref.watch(processErrorProvider);
    final enableTranslation = ref.watch(enableTranslationProvider);

    // Gemini model recommendation based on duration
    final durationSec = meta?.durationSeconds;
    final recommendedGeminiModel = _geminiModelRecommendation(durationSec);
    final isLongVideo = durationSec != null && durationSec > 1800;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // ── URL Input ──────────────────────────────────────────────────────
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('YouTube Video',
                    style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _urlController,
                        enabled: !isProcessing,
                        onSubmitted: (_) => _fetchMetadata(),
                        decoration: InputDecoration(
                          hintText: 'Paste YouTube URL',
                          border: const OutlineInputBorder(),
                          isDense: true,
                          suffixIcon: IconButton(
                            icon: const Icon(Icons.content_paste, size: 18),
                            tooltip: 'Paste from clipboard',
                            onPressed: isProcessing
                                ? null
                                : () async {
                                    final data = await Clipboard.getData(
                                        Clipboard.kTextPlain);
                                    if (data?.text != null) {
                                      _urlController.text = data!.text!;
                                    }
                                  },
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    SizedBox(
                      height: 40,
                      child: FilledButton.tonal(
                        onPressed: (isLoadingMeta || isProcessing)
                            ? null
                            : _fetchMetadata,
                        child: isLoadingMeta
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2),
                              )
                            : const Text('Load'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),

        // ── Metadata Preview ───────────────────────────────────────────────
        if (meta != null) ...[
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (meta.thumbnailUrl != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(
                        meta.thumbnailUrl!,
                        width: 128,
                        height: 72,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 128,
                          height: 72,
                          color: Theme.of(context)
                              .colorScheme
                              .surfaceContainerHighest,
                          alignment: Alignment.center,
                          child: const Icon(Icons.broken_image),
                        ),
                      ),
                    ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (translatedTitle != null) ...[
                          Text(
                            translatedTitle,
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 13),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Text(
                            meta.titleOriginal ?? '',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                          ),
                        ] else
                          Text(
                            meta.titleOriginal ?? 'Unknown Title',
                            style: const TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 13),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        if (meta.durationSeconds != null &&
                            meta.durationSeconds! > 0) ...[
                          const SizedBox(height: 2),
                          Text(
                            _formatDuration(meta.durationSeconds!),
                            style: TextStyle(
                              fontSize: 11,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurfaceVariant,
                            ),
                          ),
                        ],
                        const SizedBox(height: 6),
                        OutlinedButton.icon(
                          onPressed: (isProcessing || !enableTranslation)
                              ? null
                              : _translateTitle,
                          icon: const Icon(Icons.translate, size: 14),
                          label: const Text('Translate Title'),
                          style: OutlinedButton.styleFrom(
                              visualDensity: VisualDensity.compact),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],

        // ── Gemini recommendation ──────────────────────────────────────────
        if (meta != null && enableTranslation) ...[
          const SizedBox(height: 8),
          if (isLongVideo)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.errorContainer.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  Icon(Icons.warning_amber, size: 14,
                      color: Theme.of(context).colorScheme.onErrorContainer),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Video >30 min — may exceed token limit. Consider chunking or using gemini-2.5-flash.',
                      style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context).colorScheme.onErrorContainer),
                    ),
                  ),
                ],
              ),
            )
          else if (recommendedGeminiModel != null &&
              recommendedGeminiModel != ref.watch(geminiModelProvider))
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.secondaryContainer.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(6),
              ),
              child: Row(
                children: [
                  Icon(Icons.auto_awesome, size: 14,
                      color: Theme.of(context).colorScheme.onSecondaryContainer),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      'Recommended model for this length: $recommendedGeminiModel',
                      style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context).colorScheme.onSecondaryContainer),
                    ),
                  ),
                  TextButton(
                    style: TextButton.styleFrom(
                        visualDensity: VisualDensity.compact,
                        padding: const EdgeInsets.symmetric(horizontal: 8)),
                    onPressed: () => ref.read(geminiModelProvider.notifier).state =
                        recommendedGeminiModel,
                    child: const Text('Apply', style: TextStyle(fontSize: 11)),
                  ),
                ],
              ),
            ),
        ],

        const SizedBox(height: 16),

        // ── Settings ───────────────────────────────────────────────────────
        const Text('Settings', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),

        DropdownButtonFormField<String>(
          value: ref.watch(whisperDeviceProvider),
          decoration: const InputDecoration(
            labelText: 'Whisper Device',
            border: OutlineInputBorder(),
            isDense: true,
          ),
          items: const [
            DropdownMenuItem(value: 'auto', child: Text('Auto')),
            DropdownMenuItem(value: 'cpu', child: Text('CPU')),
            DropdownMenuItem(value: 'gpu', child: Text('GPU')),
          ],
          onChanged: isProcessing
              ? null
              : (v) => ref.read(whisperDeviceProvider.notifier).state = v!,
        ),        const SizedBox(height: 12),

        DropdownButtonFormField<String>(
          value: ref.watch(sourceLangProvider),
          decoration: const InputDecoration(
            labelText: 'Source Language',
            border: OutlineInputBorder(),
            isDense: true,
            helperText: 'Language spoken in the video. Auto = Whisper detects it.',
          ),
          items: sourceLangMap.entries
              .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
              .toList(),
          onChanged: isProcessing
              ? null
              : (v) => ref.read(sourceLangProvider.notifier).state = v!,
        ),        const SizedBox(height: 12),

        SwitchListTile(
          title: const Text('Enable Translation'),
          value: enableTranslation,
          contentPadding: EdgeInsets.zero,
          onChanged: isProcessing
              ? null
              : (v) => ref.read(enableTranslationProvider.notifier).state = v,
        ),

        if (enableTranslation) ...[
          const SizedBox(height: 8),
          DropdownButtonFormField<String>(
            value: ref.watch(targetLangProvider),
            decoration: const InputDecoration(
              labelText: 'Target Language',
              border: OutlineInputBorder(),
              isDense: true,
            ),
            items: languageMap.entries
                .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                .toList(),
            onChanged: isProcessing
                ? null
                : (v) => ref.read(targetLangProvider.notifier).state = v!,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _apiKeyController,
            obscureText: !_showApiKey,
            enabled: !isProcessing,
            decoration: InputDecoration(
              labelText: 'Gemini API Key',
              border: const OutlineInputBorder(),
              isDense: true,
              suffixIcon: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  IconButton(
                    icon: Icon(
                        _showApiKey ? Icons.visibility_off : Icons.visibility,
                        size: 18),
                    tooltip: _showApiKey ? 'Hide' : 'Show',
                    onPressed: () =>
                        setState(() => _showApiKey = !_showApiKey),
                  ),
                  TextButton(
                    onPressed: isProcessing ? null : _testApiKey,
                    child: const Text('Test'),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 4),
            child: Text(
              'Status: $apiKeyStatus',
              style: TextStyle(
                color: apiKeyStatus.contains('✓')
                    ? Colors.green
                    : apiKeyStatus.contains('✗')
                        ? Colors.red
                        : Colors.grey,
                fontSize: 12,
              ),
            ),
          ),
        ],

        const SizedBox(height: 20),

        // ── Process Status ─────────────────────────────────────────────────
        if (isProcessing && processStatus.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(processStatus,
                          style: const TextStyle(fontSize: 13)),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: processProgress,
                    minHeight: 6,
                  ),
                ),
              ],
            ),
          ),

        // ── Error Card ─────────────────────────────────────────────────────
        if (processError != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Container(
              padding:
                  const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.errorContainer,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.error_outline,
                      color:
                          Theme.of(context).colorScheme.onErrorContainer,
                      size: 18),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      processError,
                      style: TextStyle(
                        color: Theme.of(context)
                            .colorScheme
                            .onErrorContainer,
                        fontSize: 12,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () =>
                        ref.read(processErrorProvider.notifier).state = null,
                    child: Icon(Icons.close,
                        size: 16,
                        color: Theme.of(context)
                            .colorScheme
                            .onErrorContainer),
                  ),
                ],
              ),
            ),
          ),

        // ── Start Processing ───────────────────────────────────────────────
        SizedBox(
          height: 48,
          child: FilledButton(
            onPressed: isProcessing ? null : _startProcessing,
            child: isProcessing
                ? const CircularProgressIndicator(
                    color: Colors.white, strokeWidth: 2)
                : const Text('Start Processing'),
          ),
        ),

        // ── Play with MPV (only when video is loaded) ─────────────────────
        if (meta != null) ...[
          const SizedBox(height: 10),
          SizedBox(
            height: 48,
            child: OutlinedButton.icon(
              onPressed: () async {
                final url = _urlController.text.trim();
                final subPath = ref.read(currentSubtitlePathProvider);
                final playSource = url.isNotEmpty ? url : ref.read(currentAudioPathProvider) ?? '';
                if (playSource.isNotEmpty) {
                  _log(subPath != null
                      ? 'Launching MPV with subtitle: $subPath'
                      : 'Launching MPV without subtitle');
                  final config = await ref.read(apiServiceProvider).getConfig();
                  MpvLauncher.play(
                    playSource,
                    subtitlePath: subPath,
                    cookieBrowser: config?['cookie_browser'],
                    cookieProfile: config?['cookie_profile'],
                    cookiesTxtPath: config?['cookies_txt_path'],
                  );
                }
              },
              icon: const Icon(Icons.play_arrow),
              label: const Text('Play with MPV'),
            ),
          ),
        ],
      ],
    );
  }
}

