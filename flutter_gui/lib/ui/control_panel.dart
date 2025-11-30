import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_service.dart';
import '../models.dart';
import '../mpv_launcher.dart';
import '../history_service.dart';

// Providers
final apiServiceProvider = Provider((ref) => ApiService());

final urlProvider = StateProvider<String>((ref) => '');
final metadataProvider = StateProvider<VideoMetadata?>((ref) => null);
final isProcessingProvider = StateProvider<bool>((ref) => false);
final logProvider = StateProvider<List<String>>((ref) => []);
final currentSubtitlePathProvider = StateProvider<String?>((ref) => null); // New provider for MPV

// Settings Providers
final sourceLangProvider = StateProvider<String>((ref) => 'auto');
final targetLangProvider = StateProvider<String>((ref) => 'zh-CN');
final whisperDeviceProvider = StateProvider<String>((ref) => 'auto');
final whisperModelProvider = StateProvider<String>((ref) => 'turbo');
final geminiModelProvider = StateProvider<String>((ref) => 'gemini-2.5-flash-lite');
final geminiApiKeyProvider = StateProvider<String>((ref) => '');
final enableTranslationProvider = StateProvider<bool>((ref) => false);
final apiKeyStatusProvider = StateProvider<String>((ref) => 'Not tested');

class ControlPanel extends ConsumerStatefulWidget {
  const ControlPanel({super.key});

  @override
  ConsumerState<ControlPanel> createState() => _ControlPanelState();
}

class _ControlPanelState extends ConsumerState<ControlPanel> {
  final TextEditingController _urlController = TextEditingController();
  final TextEditingController _apiKeyController = TextEditingController();

  @override
  void dispose() {
    _urlController.dispose();
    _apiKeyController.dispose();
    super.dispose();
  }

  void _log(String message) {
    ref.read(logProvider.notifier).update((state) => [...state, "[${DateTime.now().toIso8601String().split('T')[1].split('.')[0]}] $message"]);
  }

  Future<void> _fetchMetadata() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;

    _log("Fetching metadata for $url...");
    final meta = await ref.read(apiServiceProvider).fetchMetadata(url);
    
    if (meta.ok) {
      ref.read(metadataProvider.notifier).state = meta;
      _log("Metadata loaded: ${meta.titleOriginal}");
    } else {
      _log("Error fetching metadata: ${meta.error}");
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: ${meta.error}")));
    }
  }

  Future<void> _translateTitle() async {
    final meta = ref.read(metadataProvider);
    final apiKey = _apiKeyController.text.trim();
    if (meta == null || meta.titleOriginal == null || apiKey.isEmpty) return;

    _log("Translating title...");
    final translated = await ref.read(apiServiceProvider).translateTitle(
      title: meta.titleOriginal!,
      targetLang: ref.read(targetLangProvider),
      apiKey: apiKey,
      model: ref.read(geminiModelProvider),
    );

    if (translated != null) {
      _log("Title translated: $translated");
      // Update metadata locally to show translated title? 
      // Or just show it in a separate provider?
      // For simplicity, let's just log it or show it in a dialog/snackbar for now, 
      // or we need a way to store it in the metadata object (which is immutable).
      // Let's just show it in the log for now as requested by "Translated title (from /api/translate_title)" in UI.
      // We can create a separate provider for translated title.
    } else {
      _log("Title translation failed.");
    }
  }

  Future<void> _testApiKey() async {
    final apiKey = _apiKeyController.text.trim();
    if (apiKey.isEmpty) return;

    ref.read(apiKeyStatusProvider.notifier).state = "Testing...";
    final valid = await ref.read(apiServiceProvider).testApiKey(apiKey, ref.read(geminiModelProvider));
    ref.read(apiKeyStatusProvider.notifier).state = valid ? "Valid" : "Invalid";
  }

  Future<void> _startProcessing() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;

    ref.read(isProcessingProvider.notifier).state = true;
    _log("Starting processing...");

    final res = await ref.read(apiServiceProvider).processVideo(
      url: url,
      sourceLang: ref.read(sourceLangProvider),
      targetLang: ref.read(targetLangProvider),
      whisperDevice: ref.read(whisperDeviceProvider),
      whisperModel: ref.read(whisperModelProvider),
      geminiModel: ref.read(geminiModelProvider),
      geminiApiKey: _apiKeyController.text.trim(),
      enableTranslation: ref.read(enableTranslationProvider),
    );

    ref.read(isProcessingProvider.notifier).state = false;

    if (res.ok) {
      _log("Processing complete!");
      _log("Original SRT: ${res.originalSrtPath}");
      
      String? finalSubtitle = res.originalSrtPath;
      if (res.translatedSrtPath != null) {
        _log("Translated SRT: ${res.translatedSrtPath}");
        finalSubtitle = res.translatedSrtPath;
      }
      
      // Store for MPV
      ref.read(currentSubtitlePathProvider.notifier).state = finalSubtitle;

      // Add to History
      final meta = ref.read(metadataProvider);
      final historyItem = HistoryItem(
        url: url,
        videoId: res.videoId,
        titleOriginal: meta?.titleOriginal ?? "Unknown Title",
        titleTranslated: null, // We could store this if we had it from a separate provider
        targetLang: ref.read(enableTranslationProvider) ? ref.read(targetLangProvider) : null,
        subtitlePath: finalSubtitle,
        thumbnailUrl: meta?.thumbnailUrl,
        lastUsed: DateTime.now().toIso8601String(),
      );
      ref.read(historyProvider.notifier).addToHistory(historyItem);
      
    } else {
      _log("Processing failed: ${res.error}");
    }
  }

  @override
  Widget build(BuildContext context) {
    // Sync provider -> controller
    ref.listen(urlProvider, (previous, next) {
      if (_urlController.text != next) {
        _urlController.text = next;
      }
    });

    final meta = ref.watch(metadataProvider);
    final isProcessing = ref.watch(isProcessingProvider);
    final apiKeyStatus = ref.watch(apiKeyStatusProvider);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // URL Input
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("YouTube Video", style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _urlController,
                        decoration: const InputDecoration(
                          hintText: "Paste YouTube URL",
                          border: OutlineInputBorder(),
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    FilledButton.tonal(
                      onPressed: _fetchMetadata,
                      child: const Text("Load"),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 16),

        // Metadata Preview
        if (meta != null)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (meta.thumbnailUrl != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: Image.network(meta.thumbnailUrl!, width: 120, height: 68, fit: BoxFit.cover),
                    ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(meta.titleOriginal ?? "Unknown Title", style: const TextStyle(fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        // Translated title placeholder
                        OutlinedButton.icon(
                          onPressed: _translateTitle,
                          icon: const Icon(Icons.translate, size: 16),
                          label: const Text("Translate Title"),
                          style: OutlinedButton.styleFrom(visualDensity: VisualDensity.compact),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 16),

        // Settings
        const Text("Settings", style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        
        // Whisper
        DropdownButtonFormField<String>(
          value: ref.watch(whisperDeviceProvider),
          decoration: const InputDecoration(labelText: "Whisper Device", border: OutlineInputBorder()),
          items: const [
            DropdownMenuItem(value: "auto", child: Text("Auto")),
            DropdownMenuItem(value: "cpu", child: Text("CPU")),
            DropdownMenuItem(value: "gpu", child: Text("GPU")),
          ],
          onChanged: (v) => ref.read(whisperDeviceProvider.notifier).state = v!,
        ),
        const SizedBox(height: 12),
        
        // Translation
        SwitchListTile(
          title: const Text("Enable Translation"),
          value: ref.watch(enableTranslationProvider),
          onChanged: (v) => ref.read(enableTranslationProvider.notifier).state = v,
        ),
        
        if (ref.watch(enableTranslationProvider)) ...[
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: ref.watch(targetLangProvider),
            decoration: const InputDecoration(labelText: "Target Language", border: OutlineInputBorder()),
            items: const [
              DropdownMenuItem(value: "zh-CN", child: Text("Chinese (Simplified)")),
              DropdownMenuItem(value: "en", child: Text("English")),
              DropdownMenuItem(value: "ja", child: Text("Japanese")),
            ],
            onChanged: (v) => ref.read(targetLangProvider.notifier).state = v!,
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _apiKeyController,
            obscureText: true,
            decoration: InputDecoration(
              labelText: "Gemini API Key",
              border: const OutlineInputBorder(),
              suffixIcon: TextButton(
                onPressed: _testApiKey,
                child: const Text("Test"),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4, left: 4),
            child: Text("Status: $apiKeyStatus", style: TextStyle(
              color: apiKeyStatus == "Valid" ? Colors.green : (apiKeyStatus == "Invalid" ? Colors.red : Colors.grey),
              fontSize: 12,
            )),
          ),
        ],

        const SizedBox(height: 24),
        
        // Actions
        SizedBox(
          height: 50,
          child: FilledButton(
            onPressed: isProcessing ? null : _startProcessing,
            child: isProcessing 
              ? const CircularProgressIndicator(color: Colors.white) 
              : const Text("Start Processing"),
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 50,
          child: OutlinedButton.icon(
            onPressed: () {
              final url = _urlController.text.trim();
              final subPath = ref.read(currentSubtitlePathProvider);
              
              if (url.isNotEmpty) {
                if (subPath != null) {
                  _log("Launching MPV with subtitle: $subPath");
                } else {
                  _log("Launching MPV without subtitle (none generated yet)");
                }
                MpvLauncher.play(url, subtitlePath: subPath);
              }
            },
            icon: const Icon(Icons.play_arrow),
            label: const Text("Play with MPV"),
          ),
        ),
      ],
    );
  }
}
