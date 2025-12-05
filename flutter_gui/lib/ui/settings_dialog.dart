import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_service.dart';

class SettingsDialog extends ConsumerStatefulWidget {
  const SettingsDialog({super.key});

  @override
  ConsumerState<SettingsDialog> createState() => _SettingsDialogState();
}

class _SettingsDialogState extends ConsumerState<SettingsDialog> {
  final TextEditingController _downloadDirController = TextEditingController();
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  Future<void> _loadConfig() async {
    final config = await ref.read(apiServiceProvider).getConfig();
    if (config != null) {
      _downloadDirController.text = config['download_dir'] ?? '';
    }
    setState(() {
      _isLoading = false;
    });
  }

  Future<void> _saveConfig() async {
    final success = await ref.read(apiServiceProvider).updateConfig(
      downloadDir: _downloadDirController.text.trim(),
    );
    if (mounted) {
      if (success) {
        Navigator.pop(context);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Settings saved")));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Failed to save settings")));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text("Settings"),
      content: _isLoading
          ? const SizedBox(height: 100, child: Center(child: CircularProgressIndicator()))
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text("Download Folder", style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                TextField(
                  controller: _downloadDirController,
                  decoration: const InputDecoration(
                    hintText: "Enter absolute path",
                    border: OutlineInputBorder(),
                    helperText: "Files will be saved to 'video' and 'audio' subfolders here.",
                  ),
                ),
              ],
            ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text("Cancel"),
        ),
        FilledButton(
          onPressed: _isLoading ? null : _saveConfig,
          child: const Text("Save"),
        ),
      ],
    );
  }
}
