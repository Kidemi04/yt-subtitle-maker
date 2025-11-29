import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../history_service.dart';
import '../mpv_launcher.dart';
import '../api_service.dart';
import 'control_panel.dart'; // To access logProvider

class HistoryPanel extends ConsumerWidget {
  const HistoryPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final logs = ref.watch(logProvider);

    return Column(
      children: [
        // Logs Header
        Container(
          padding: const EdgeInsets.all(12),
          alignment: Alignment.centerLeft,
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: const Text("Logs", style: TextStyle(fontWeight: FontWeight.bold)),
        ),
        
        // Logs List
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: logs.length,
            itemBuilder: (context, index) {
              // Show newest at bottom? Or top? 
              // Usually logs are appended. Let's show as is.
              // To auto-scroll, we'd need a controller, but for now simple list is fine.
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text(
                  logs[index],
                  style: const TextStyle(fontFamily: 'Consolas', fontSize: 12),
                ),
              );
            },
          ),
        ),
        
        const Divider(height: 1),
        
        // History Header
        Container(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("History", style: TextStyle(fontWeight: FontWeight.bold)),
              TextButton.icon(
                onPressed: () async {
                  // Scan logic
                  final api = ref.read(apiServiceProvider); // We need to access API provider
                  // Wait, apiServiceProvider is in control_panel.dart. 
                  // We should probably move it to a common file or just use a new instance since it's stateless.
                  final files = await ApiService().fetchOutputs();
                  if (context.mounted) {
                    await ref.read(historyProvider.notifier).importFiles(files);
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Scanned ${files.length} files")));
                  }
                },
                icon: const Icon(Icons.refresh, size: 16),
                label: const Text("Scan Output"),
                style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
              ),
            ],
          ),
        ),
        
        // History List
        Expanded(
          child: ref.watch(historyProvider).isEmpty 
            ? Center(child: Text("No history yet", style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)))
            : ListView.builder(
                padding: const EdgeInsets.all(0),
                itemCount: ref.watch(historyProvider).length,
                itemBuilder: (context, index) {
                  final item = ref.watch(historyProvider)[index];
                  return ListTile(
                    title: Text(item.titleOriginal ?? item.url, maxLines: 1, overflow: TextOverflow.ellipsis),
                    subtitle: Text("${item.targetLang ?? 'No translation'} • ${item.lastUsed.split('T')[0]}"),
                    dense: true,
                    onTap: () {
                      // Reload into Control Panel
                      ref.read(urlProvider.notifier).state = item.url;
                      if (item.targetLang != null) {
                         ref.read(targetLangProvider.notifier).state = item.targetLang!;
                         ref.read(enableTranslationProvider.notifier).state = true;
                      }
                    },
                    trailing: IconButton(
                      icon: const Icon(Icons.play_arrow, size: 16),
                      onPressed: () {
                         // Quick play logic
                         MpvLauncher.play(item.url, subtitlePath: item.subtitlePath);
                      },
                    ),
                  );
                },
              ),
        ),
      ],
    );
  }
}
