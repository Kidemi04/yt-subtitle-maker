import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../history_service.dart';
import '../mpv_launcher.dart';
import '../api_service.dart';
import '../models.dart';
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
                  final langName = languageMap[item.targetLang] ?? item.targetLang ?? 'No translation';
                  
                  return Card(
                    margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(8),
                      leading: item.thumbnailUrl != null
                        ? ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: Image.network(item.thumbnailUrl!, width: 80, fit: BoxFit.cover),
                          )
                        : const Icon(Icons.video_library, size: 40),
                      title: Text(
                        item.titleTranslated ?? item.titleOriginal ?? item.url,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (item.titleTranslated != null && item.titleOriginal != null)
                            Text(item.titleOriginal!, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11)),
                          const SizedBox(height: 2),
                          Text(
                            "$langName • ${item.lastUsed.split('T')[0]}",
                            style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant),
                          ),
                        ],
                      ),
                      dense: false,
                      onTap: () {
                        // Reload into Control Panel
                        ref.read(urlProvider.notifier).state = item.url;
                        
                        // Restore metadata (so thumbnail shows in control panel)
                        if (item.titleOriginal != null) {
                          ref.read(metadataProvider.notifier).state = VideoMetadata(
                            ok: true,
                            videoId: item.videoId,
                            titleOriginal: item.titleOriginal,
                            thumbnailUrl: item.thumbnailUrl,
                            durationSeconds: 0, // We don't store duration yet
                          );
                        }
                        
                        if (item.targetLang != null) {
                           ref.read(targetLangProvider.notifier).state = item.targetLang!;
                           ref.read(enableTranslationProvider.notifier).state = true;
                        }
                        
                        // Also restore subtitle path for MPV button in control panel
                        ref.read(currentSubtitlePathProvider.notifier).state = item.subtitlePath;
                      },
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.play_arrow),
                            onPressed: () {
                               // Quick play logic
                               MpvLauncher.play(item.url, subtitlePath: item.subtitlePath);
                            },
                            tooltip: "Play",
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete, color: Colors.red),
                            onPressed: () async {
                              final confirm = await showDialog<bool>(
                                context: context,
                                builder: (context) => AlertDialog(
                                  title: const Text("Delete Output?"),
                                  content: const Text("This will delete the generated subtitles and audio files for this video."),
                                  actions: [
                                    TextButton(onPressed: () => Navigator.pop(context, false), child: const Text("Cancel")),
                                    TextButton(onPressed: () => Navigator.pop(context, true), child: const Text("Delete")),
                                  ],
                                ),
                              );
                              
                              if (confirm == true && item.videoId != null) {
                                final success = await ref.read(apiServiceProvider).deleteOutput(item.videoId!);
                                if (success) {
                                  await ref.read(historyProvider.notifier).removeFromHistory(item.videoId!);
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Deleted")));
                                  }
                                } else {
                                  if (context.mounted) {
                                    ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Failed to delete")));
                                  }
                                }
                              }
                            },
                            tooltip: "Delete",
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
        ),
      ],
    );
  }
}
