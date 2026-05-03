import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../history_service.dart';
import '../mpv_launcher.dart';
import '../api_service.dart';
import '../models.dart';
import 'control_panel.dart';
import 'home_screen.dart';

// -----------------------------------------------------------------------------
// HistoryPanel � logs-only side panel (shown alongside Subtitle Generator tab)
// -----------------------------------------------------------------------------

class HistoryPanel extends ConsumerStatefulWidget {
  const HistoryPanel({super.key});

  @override
  ConsumerState<HistoryPanel> createState() => _HistoryPanelState();
}

class _HistoryPanelState extends ConsumerState<HistoryPanel> {
  final ScrollController _logScrollController = ScrollController();

  @override
  void dispose() {
    _logScrollController.dispose();
    super.dispose();
  }

  void _scrollLogsToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_logScrollController.hasClients) {
        _logScrollController.animateTo(
          _logScrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final logs = ref.watch(logProvider);

    ref.listen(logProvider, (prev, next) {
      if (next.length != (prev?.length ?? 0)) {
        _scrollLogsToBottom();
      }
    });

    return Column(
      children: [
        // -- Logs Header --------------------------------------------------
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          alignment: Alignment.centerLeft,
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: const Text('Logs',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        ),

        // -- Logs List ----------------------------------------------------
        Expanded(
          child: logs.isEmpty
              ? Center(
                  child: Text('No activity yet',
                      style: TextStyle(
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                          fontSize: 12)),
                )
              : ListView.builder(
                  controller: _logScrollController,
                  padding: const EdgeInsets.all(8),
                  itemCount: logs.length,
                  itemBuilder: (context, index) => Padding(
                    padding: const EdgeInsets.symmetric(vertical: 1),
                    child: Text(
                      logs[index],
                      style: const TextStyle(fontFamily: 'Consolas', fontSize: 11),
                    ),
                  ),
                ),
        ),
      ],
    );
  }
}

// -----------------------------------------------------------------------------
// HistoryTab � full-page history list with right-click context menu
// -----------------------------------------------------------------------------

class HistoryTab extends ConsumerWidget {
  const HistoryTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final history = ref.watch(historyProvider);

    return Column(
      children: [
        // -- Header bar ---------------------------------------------------
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: Row(
            children: [
              Text('${history.length} video${history.length == 1 ? '' : 's'}',
                  style: TextStyle(
                      fontSize: 12,
                      color: Theme.of(context).colorScheme.onSurfaceVariant)),
              const Spacer(),
              TextButton.icon(
                onPressed: () async {
                  final files = await ApiService().fetchOutputs();
                  if (context.mounted) {
                    await ref.read(historyProvider.notifier).importFiles(files);
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                      content: Text('Scanned ${files.length} files'),
                      behavior: SnackBarBehavior.floating,
                    ));
                  }
                },
                icon: const Icon(Icons.refresh, size: 14),
                label: const Text('Scan Output'),
                style: TextButton.styleFrom(visualDensity: VisualDensity.compact),
              ),
              const SizedBox(width: 4),
              Text('Right-click an item for more options',
                  style: TextStyle(
                      fontSize: 11,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                      fontStyle: FontStyle.italic)),
            ],
          ),
        ),

        // -- List ---------------------------------------------------------
        Expanded(
          child: history.isEmpty
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.history,
                          size: 48,
                          color: Theme.of(context)
                              .colorScheme
                              .onSurfaceVariant
                              .withValues(alpha: 0.4)),
                      const SizedBox(height: 12),
                      Text('No history yet',
                          style: TextStyle(
                              color:
                                  Theme.of(context).colorScheme.onSurfaceVariant)),
                    ],
                  ),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: history.length,
                  itemBuilder: (context, index) {
                    final item = history[index];
                    return _HistoryCard(item: item);
                  },
                ),
        ),
      ],
    );
  }
}

// -----------------------------------------------------------------------------
// _HistoryCard � individual history item with right-click menu
// -----------------------------------------------------------------------------

class _HistoryCard extends ConsumerWidget {
  final HistoryItem item;
  const _HistoryCard({required this.item});

  void _showContextMenu(BuildContext context, WidgetRef ref, Offset position) async {
    final overlay = Overlay.of(context).context.findRenderObject() as RenderBox;
    final result = await showMenu<String>(
      context: context,
      position: RelativeRect.fromRect(
        position & const Size(1, 1),
        Offset.zero & overlay.size,
      ),
      items: [
        const PopupMenuItem(value: 'load', child: ListTile(
          leading: Icon(Icons.open_in_new, size: 18),
          title: Text('Load in Subtitle Generator'),
          dense: true,
          contentPadding: EdgeInsets.zero,
        )),
        if (item.subtitlePath != null)
          const PopupMenuItem(value: 'folder', child: ListTile(
            leading: Icon(Icons.folder_open, size: 18),
            title: Text('Open file location'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          )),
        PopupMenuItem(value: 'youtube', child: ListTile(
          leading: const Icon(Icons.open_in_browser, size: 18),
          title: const Text('Open YouTube video'),
          dense: true,
          contentPadding: EdgeInsets.zero,
          enabled: item.url.isNotEmpty,
        )),
        if (item.subtitlePath != null)
          const PopupMenuItem(value: 'play', child: ListTile(
            leading: Icon(Icons.play_circle_outline, size: 18),
            title: Text('Play with MPV'),
            dense: true,
            contentPadding: EdgeInsets.zero,
          )),
        const PopupMenuDivider(),
        const PopupMenuItem(value: 'delete', child: ListTile(
          leading: Icon(Icons.delete_outline, size: 18, color: Colors.red),
          title: Text('Delete', style: TextStyle(color: Colors.red)),
          dense: true,
          contentPadding: EdgeInsets.zero,
        )),
      ],
    );

    if (result == null || !context.mounted) return;

    switch (result) {
      case 'load':
        _loadIntoGenerator(ref);
        break;
      case 'folder':
        ref.read(apiServiceProvider).openFolder(item.subtitlePath!);
        break;
      case 'youtube':
        ref.read(apiServiceProvider).openUrl(item.url);
        break;
      case 'play':
        final playSource = item.url.isNotEmpty ? item.url : (item.audioPath ?? '');
        ref.read(apiServiceProvider).getConfig().then((config) {
          MpvLauncher.play(
            playSource,
            subtitlePath: item.subtitlePath,
            cookieBrowser: config?['cookie_browser'],
            cookieProfile: config?['cookie_profile'],
            cookiesTxtPath: config?['cookies_txt_path'],
          ).catchError((e) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                content: Text(e.toString()),
                backgroundColor: Colors.red,
                behavior: SnackBarBehavior.floating,
              ));
            }
          });
        });
        break;
      case 'delete':
        _confirmDelete(context, ref);
        break;
    }
  }

  void _loadIntoGenerator(WidgetRef ref) {
    ref.read(urlProvider.notifier).state = item.url;
    if (item.titleOriginal != null) {
      ref.read(metadataProvider.notifier).state = VideoMetadata(
        ok: true,
        videoId: item.videoId,
        titleOriginal: item.titleOriginal,
        thumbnailUrl: item.thumbnailUrl,
        durationSeconds: 0,
      );
    }
    if (item.targetLang != null) {
      ref.read(targetLangProvider.notifier).state = item.targetLang!;
      ref.read(enableTranslationProvider.notifier).state = true;
    }
    if (item.titleTranslated != null) {
      ref.read(translatedTitleProvider.notifier).state = item.titleTranslated;
    }
    ref.read(currentSubtitlePathProvider.notifier).state = item.subtitlePath;
    ref.read(currentAudioPathProvider.notifier).state = item.audioPath;
    ref.read(activeTabProvider.notifier).state = 0;
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Output?'),
        content: const Text(
            'This will delete the generated subtitles and audio for this video.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Cancel')),
          TextButton(
              onPressed: () => Navigator.pop(ctx, true),
              child:
                  const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );
    if (confirm == true && item.videoId != null && context.mounted) {
      final success =
          await ref.read(apiServiceProvider).deleteOutput(item.videoId!);
      if (success) {
        await ref
            .read(historyProvider.notifier)
            .removeFromHistory(item.videoId!);
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Deleted'), behavior: SnackBarBehavior.floating));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final thumb = item.thumbnailUrl;

    return GestureDetector(
      onSecondaryTapUp: (details) =>
          _showContextMenu(context, ref, details.globalPosition),
      child: Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: ListTile(
          contentPadding:
              const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          leading: SizedBox(
            width: 80,
            height: 48,
            child: thumb != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: Image.network(
                      thumb,
                      width: 80,
                      height: 48,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) =>
                          const Icon(Icons.broken_image),
                    ),
                  )
                : const Icon(Icons.video_library, size: 28),
          ),
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
                Text(item.titleOriginal!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11)),
              const SizedBox(height: 4),
              Wrap(
                spacing: 6,
                children: [
                  _chip(context, Icons.translate,
                      item.targetLang != null
                          ? (languageMap[item.targetLang] ?? item.targetLang!)
                          : 'No translation'),
                  if (item.subtitlePath != null)
                    _chip(context, Icons.subtitles, 'SRT ?'),
                  _chip(context, Icons.calendar_today,
                      item.lastUsed.split('T')[0]),
                ],
              ),
            ],
          ),
          onTap: () => _loadIntoGenerator(ref),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (item.subtitlePath != null)
                IconButton(
                  icon: const Icon(Icons.play_arrow, size: 20),
                  onPressed: () async {
                    final playSource = item.url.isNotEmpty ? item.url : (item.audioPath ?? '');
                    final config = await ref.read(apiServiceProvider).getConfig();
                    MpvLauncher.play(
                      playSource,
                      subtitlePath: item.subtitlePath,
                      cookieBrowser: config?['cookie_browser'],
                      cookieProfile: config?['cookie_profile'],
                      cookiesTxtPath: config?['cookies_txt_path'],
                    ).catchError((e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                          content: Text(e.toString()),
                          backgroundColor: Colors.red,
                          behavior: SnackBarBehavior.floating,
                        ));
                      }
                    });
                  },
                  tooltip: 'Play with MPV',
                  padding: const EdgeInsets.all(4),
                  constraints: const BoxConstraints(),
                ),
              IconButton(
                icon: const Icon(Icons.more_vert, size: 20),
                tooltip: 'More options',
                padding: const EdgeInsets.all(4),
                constraints: const BoxConstraints(),
                onPressed: () {
                  final box = context.findRenderObject() as RenderBox;
                  final pos = box.localToGlobal(box.size.bottomRight(Offset.zero));
                  _showContextMenu(context, ref, pos);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(BuildContext context, IconData icon, String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 9,
              color: Theme.of(context).colorScheme.onSurfaceVariant),
          const SizedBox(width: 3),
          Text(label,
              style: TextStyle(
                  fontSize: 9,
                  color: Theme.of(context).colorScheme.onSurfaceVariant)),
        ],
      ),
    );
  }
}