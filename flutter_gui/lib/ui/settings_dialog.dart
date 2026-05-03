import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_service.dart';
import '../mpv_launcher.dart';
import 'control_panel.dart';

class SettingsDialog extends ConsumerStatefulWidget {
  const SettingsDialog({super.key});

  @override
  ConsumerState<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends ConsumerState<SettingsDialog> {
  final TextEditingController _downloadDirController = TextEditingController();
  final TextEditingController _cookiesTxtController = TextEditingController();
  final TextEditingController _cookieProfileController = TextEditingController();
  final TextEditingController _geminiKeyController = TextEditingController();
  final TextEditingController _mpvPathController = TextEditingController();

  String _cookieBrowser = '';
  String _cookieProfile = '';
  String _whisperModel = 'turbo';
  String _whisperDevice = 'auto';
  String _sourceLang = 'auto';
  String _geminiModel = 'gemini-2.5-flash-lite';
  bool _enableTranslation = false;
  bool _showApiKey = false;
  bool _isLoading = true;

  static const _browsers = ['', 'chrome', 'firefox', 'edge', 'opera', 'brave'];
  static const _browserLabels = {
    '': 'None (no cookies)',
    'chrome': 'Chrome',
    'firefox': 'Firefox',
    'edge': 'Edge',
    'opera': 'Opera',
    'brave': 'Brave',
  };

  static const _whisperModels = ['tiny', 'base', 'small', 'medium', 'turbo', 'large'];
  static const _geminiModels = [
    'gemini-3.1-flash-lite-preview',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ];

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  @override
  void dispose() {
    _downloadDirController.dispose();
    _cookiesTxtController.dispose();
    _cookieProfileController.dispose();
    _geminiKeyController.dispose();
    _mpvPathController.dispose();
    super.dispose();
  }

  Future<void> _loadConfig() async {
    final config = await ref.read(apiServiceProvider).getConfig();
    if (config != null && mounted) {
      setState(() {
        _downloadDirController.text = config['download_dir'] ?? '';
        _cookiesTxtController.text = config['cookies_txt_path'] ?? '';
        _geminiKeyController.text = config['gemini_api_key'] ?? '';
        _mpvPathController.text = config['mpv_path'] ?? '';
        _cookieBrowser = config['cookie_browser'] ?? '';
        _cookieProfile = config['cookie_profile'] ?? '';
        _cookieProfileController.text = _cookieProfile;
        _whisperModel = config['whisper_model'] ?? 'turbo';
        _whisperDevice = (config['whisper_device'] ?? 'auto').toString().toLowerCase();
        _sourceLang = config['source_lang'] ?? 'auto';
        _geminiModel = config['gemini_model'] ?? 'gemini-2.5-flash-lite';
        _enableTranslation = config['enable_translation'] ?? false;
        _isLoading = false;
      });
    } else {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveConfig() async {
    final success = await ref.read(apiServiceProvider).updateConfig(
      downloadDir: _downloadDirController.text.trim(),
      cookieBrowser: _cookieBrowser,
      cookieProfile: _cookieProfileController.text.trim(),
      cookiesTxtPath: _cookiesTxtController.text.trim(),
      whisperModel: _whisperModel,
      whisperDevice: _whisperDevice,
      sourceLang: _sourceLang,
      geminiApiKey: _geminiKeyController.text.trim(),
      geminiModel: _geminiModel,
      enableTranslation: _enableTranslation,
      mpvPath: _mpvPathController.text.trim(),
    );

    if (!mounted) return;

    if (success) {
      // Sync providers so control panel reflects changes immediately
      MpvLauncher.mpvExecutable = _mpvPathController.text.trim();
      ref.read(whisperModelProvider.notifier).state = _whisperModel;
      ref.read(whisperDeviceProvider.notifier).state = _whisperDevice;
      ref.read(sourceLangProvider.notifier).state = _sourceLang;
      ref.read(geminiModelProvider.notifier).state = _geminiModel;
      ref.read(enableTranslationProvider.notifier).state = _enableTranslation;
      if (_geminiKeyController.text.trim().isNotEmpty) {
        ref.read(geminiApiKeyProvider.notifier).state = _geminiKeyController.text.trim();
      }

      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Settings saved'), behavior: SnackBarBehavior.floating),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Failed to save settings'), backgroundColor: Colors.red, behavior: SnackBarBehavior.floating),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Settings'),
      contentPadding: const EdgeInsets.fromLTRB(24, 16, 24, 0),
      content: _isLoading
          ? const SizedBox(height: 120, child: Center(child: CircularProgressIndicator()))
          : SizedBox(
              width: 480,
              child: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _sectionHeader('Download'),
                    TextField(
                      controller: _downloadDirController,
                      decoration: const InputDecoration(
                        labelText: 'Download Folder',
                        hintText: 'Absolute path to download directory',
                        border: OutlineInputBorder(),
                        helperText: 'Files saved to video/ and audio/ subfolders here.',
                        isDense: true,
                      ),
                    ),
                    _sectionHeader('YouTube Cookie (fixes 403 errors)'),
                    DropdownButtonFormField<String>(
                      value: _cookieBrowser,
                      decoration: const InputDecoration(
                        labelText: 'Read cookies from browser',
                        border: OutlineInputBorder(),
                        isDense: true,
                        helperText: 'Firefox recommended. Chrome 127+ cookie encryption is incompatible.',
                      ),
                      items: _browsers.map((b) {
                        final label = _browserLabels[b]!;
                        final isBroken = (b == 'chrome' || b == 'edge' || b == 'brave' || b == 'opera');
                        return DropdownMenuItem(
                          value: b,
                          child: Row(
                            children: [
                              Text(label),
                              if (isBroken && b.isNotEmpty) ...[
                                const SizedBox(width: 6),
                                const Text('⚠ may fail', style: TextStyle(fontSize: 11, color: Colors.orange)),
                              ],
                            ],
                          ),
                        );
                      }).toList(),
                      onChanged: (v) => setState(() => _cookieBrowser = v ?? ''),
                    ),
                    if (_cookieBrowser == 'chrome' || _cookieBrowser == 'edge' || _cookieBrowser == 'brave' || _cookieBrowser == 'opera')
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.orange.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: Colors.orange.withValues(alpha: 0.4)),
                          ),
                          child: const Text(
                            'Chrome 127+ uses App-Bound Encryption which blocks cookie reading.\n'
                            'Alternatives:\n'
                            '• Switch to Firefox (most reliable)\n'
                            '• Export cookies.txt with "Get cookies.txt LOCALLY" Chrome extension\n'
                            '  then set the Cookies.txt path below and select "None" above',
                            style: TextStyle(fontSize: 11),
                          ),
                        ),
                      ),
                    const SizedBox(height: 12),
                    if (_cookieBrowser.isNotEmpty) ...[  
                      TextField(
                        controller: _cookieProfileController,
                        decoration: InputDecoration(
                          labelText: 'Browser Profile (optional)',
                          hintText: 'e.g. Default, Profile 1, Profile 2',
                          border: const OutlineInputBorder(),
                          isDense: true,
                          helperText: 'Leave blank to use the default profile.',
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextField(
                      controller: _cookiesTxtController,
                      decoration: const InputDecoration(
                        labelText: 'Cookies.txt path (fallback)',
                        hintText: 'C:\\path\\to\\cookies.txt',
                        border: OutlineInputBorder(),
                        isDense: true,
                        helperText: 'Used only if no browser is selected above.',
                      ),
                    ),
                    _sectionHeader('Whisper AI'),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: _whisperModel,
                            decoration: const InputDecoration(
                              labelText: 'Model',
                              border: OutlineInputBorder(),
                              isDense: true,
                            ),
                            items: _whisperModels
                                .map((m) => DropdownMenuItem(value: m, child: Text(m.toUpperCase())))
                                .toList(),
                            onChanged: (v) => setState(() => _whisperModel = v!),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: DropdownButtonFormField<String>(
                            value: _whisperDevice.toLowerCase(),
                            decoration: const InputDecoration(
                              labelText: 'Device',
                              border: OutlineInputBorder(),
                              isDense: true,
                            ),
                            items: const [
                              DropdownMenuItem(value: 'auto', child: Text('Auto')),
                              DropdownMenuItem(value: 'cpu', child: Text('CPU')),
                              DropdownMenuItem(value: 'gpu', child: Text('GPU (CUDA)')),
                            ],
                            onChanged: (v) => setState(() => _whisperDevice = v!),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _sourceLang,
                      decoration: const InputDecoration(
                        labelText: 'Source Language',
                        border: OutlineInputBorder(),
                        isDense: true,
                        helperText: 'Language spoken in the video. Auto = Whisper detects it.',
                      ),
                      items: sourceLangMap.entries
                          .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
                          .toList(),
                      onChanged: (v) => setState(() => _sourceLang = v!),
                    ),
                    _sectionHeader('MPV Player'),
                    TextField(
                      controller: _mpvPathController,
                      decoration: const InputDecoration(
                        labelText: 'MPV Executable Path (optional)',
                        hintText: 'C:\\MPV\\mpv.exe',
                        border: OutlineInputBorder(),
                        isDense: true,
                        helperText: 'Leave blank to use mpv from PATH.',
                      ),
                    ),
                    _sectionHeader('Translation (Gemini)'),
                    SwitchListTile(
                      title: const Text('Enable Translation by default'),
                      value: _enableTranslation,
                      contentPadding: EdgeInsets.zero,
                      onChanged: (v) => setState(() => _enableTranslation = v),
                    ),
                    TextField(
                      controller: _geminiKeyController,
                      obscureText: !_showApiKey,
                      decoration: InputDecoration(
                        labelText: 'Gemini API Key',
                        border: const OutlineInputBorder(),
                        isDense: true,
                        suffixIcon: IconButton(
                          icon: Icon(_showApiKey ? Icons.visibility_off : Icons.visibility, size: 18),
                          onPressed: () => setState(() => _showApiKey = !_showApiKey),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _geminiModel,
                      decoration: const InputDecoration(
                        labelText: 'Gemini Model',
                        border: OutlineInputBorder(),
                        isDense: true,
                      ),
                      items: _geminiModels
                          .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                          .toList(),
                      onChanged: (v) => setState(() => _geminiModel = v!),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _isLoading ? null : _saveConfig,
          child: const Text('Save'),
        ),
      ],
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 10),
      child: Text(
        title,
        style: TextStyle(
          fontWeight: FontWeight.bold,
          fontSize: 12,
          color: Theme.of(context).colorScheme.primary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}

