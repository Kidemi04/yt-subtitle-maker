import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_service.dart';
import '../mpv_launcher.dart';

final downloadListProvider = StateProvider<List<dynamic>>((ref) => []);
final isDownloadingProvider = StateProvider<bool>((ref) => false);

class DownloadPanel extends ConsumerStatefulWidget {
  const DownloadPanel({super.key});

  @override
  ConsumerState<DownloadPanel> createState() => _DownloadPanelState();
}

class _DownloadPanelState extends ConsumerState<DownloadPanel> {
  final TextEditingController _urlController = TextEditingController();
  String _selectedType = 'video'; // video or audio
  
  // Progress State
  double _progress = 0.0;
  String _speed = "";
  String _eta = "";
  String _statusMessage = "";

  @override
  void initState() {
    super.initState();
    _refreshList();
  }

  Future<void> _refreshList() async {
    final files = await ref.read(apiServiceProvider).fetchDownloads();
    ref.read(downloadListProvider.notifier).state = files;
  }

  Future<void> _startDownload() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) return;

    ref.read(isDownloadingProvider.notifier).state = true;
    setState(() {
      _progress = 0.0;
      _speed = "Starting...";
      _eta = "";
      _statusMessage = "Initializing...";
    });

    final stream = ref.read(apiServiceProvider).downloadMedia(url, _selectedType);
    
    await for (final event in stream) {
      if (!mounted) break;
      
      final status = event['status'];
      
      if (status == 'downloading') {
        final percentStr = event['percent'].toString();
        // percent comes as string "12.5" or similar
        final percentVal = double.tryParse(percentStr) ?? 0.0;
        
        final speedVal = event['speed']; // bytes/s
        final etaVal = event['eta']; // seconds
        
        String speedStr = "";
        if (speedVal != null) {
           final mb = (speedVal as num) / (1024 * 1024);
           speedStr = "${mb.toStringAsFixed(1)} MB/s";
        }
        
        String etaStr = "";
        if (etaVal != null) {
          final s = (etaVal as num).toInt();
          if (s < 60) {
            etaStr = "${s}s";
          } else {
            etaStr = "${(s / 60).toStringAsFixed(1)}m";
          }
        }

        setState(() {
          _progress = percentVal / 100.0;
          _speed = speedStr;
          _eta = etaStr;
          _statusMessage = "Downloading... ${percentVal.toStringAsFixed(1)}%";
        });
        
      } else if (status == 'processing') {
         setState(() {
           _statusMessage = "Processing (Converting)...";
           _progress = 1.0; // Indeterminate or full
         });
      } else if (status == 'finished') {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Downloaded: ${event['filename']}")));
        _urlController.clear();
        _refreshList();
        setState(() {
          _statusMessage = "Done!";
          _progress = 1.0;
        });
      } else if (status == 'error') {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text("Error: ${event['error']}")));
        setState(() {
          _statusMessage = "Error occurred";
        });
      }
    }

    if (mounted) {
      ref.read(isDownloadingProvider.notifier).state = false;
      setState(() {
        _progress = 0.0;
        _speed = "";
        _eta = "";
        _statusMessage = "";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final downloads = ref.watch(downloadListProvider);
    final isDownloading = ref.watch(isDownloadingProvider);

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Input Section
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Download Media", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _urlController,
                    enabled: !isDownloading,
                    decoration: const InputDecoration(
                      labelText: "YouTube URL",
                      border: OutlineInputBorder(),
                      prefixIcon: Icon(Icons.link),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      const Text("Format: "),
                      const SizedBox(width: 8),
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'video', label: Text('Video (MP4)'), icon: Icon(Icons.videocam)),
                          ButtonSegment(value: 'audio', label: Text('Audio Only'), icon: Icon(Icons.audiotrack)),
                        ],
                        selected: {_selectedType},
                        onSelectionChanged: isDownloading ? null : (Set<String> newSelection) {
                          setState(() {
                            _selectedType = newSelection.first;
                          });
                        },
                      ),
                      const Spacer(),
                      FilledButton.icon(
                        onPressed: isDownloading ? null : _startDownload,
                        icon: const Icon(Icons.download),
                        label: const Text("Download"),
                      ),
                    ],
                  ),
                  
                  if (isDownloading) ...[
                    const SizedBox(height: 24),
                    LinearProgressIndicator(value: _progress),
                    const SizedBox(height: 8),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(_statusMessage, style: const TextStyle(fontWeight: FontWeight.bold)),
                        Text("$_speed  ETA: $_eta"),
                      ],
                    ),
                  ],
                ],
              ),
            ),
          ),
          
          const SizedBox(height: 24),
          
          // List Section
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("Downloaded Files", style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              IconButton(
                onPressed: _refreshList,
                icon: const Icon(Icons.refresh),
                tooltip: "Refresh List",
              ),
            ],
          ),
          const SizedBox(height: 8),
          
          Expanded(
            child: downloads.isEmpty
                ? Center(child: Text("No downloads yet", style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)))
                : ListView.builder(
                    itemCount: downloads.length,
                    itemBuilder: (context, index) {
                      final file = downloads[index];
                      final filename = file['filename'] as String;
                      final path = file['path'] as String;
                      final sizeMb = (file['size'] as int) / (1024 * 1024);
                      
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          leading: Icon(
                            filename.endsWith('.mp4') ? Icons.movie : Icons.music_note,
                            color: Theme.of(context).colorScheme.primary,
                          ),
                          title: Text(filename, maxLines: 1, overflow: TextOverflow.ellipsis),
                          subtitle: Text("${sizeMb.toStringAsFixed(1)} MB"),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.play_arrow),
                                onPressed: () {
                                  MpvLauncher.play(path);
                                },
                                tooltip: "Play",
                              ),
                              IconButton(
                                icon: const Icon(Icons.folder_open),
                                onPressed: () {
                                  // Open folder logic (Windows specific)
                                  // We can use Process.run but we are in Flutter.
                                  // Since we don't have a direct 'open folder' tool easily accessible without plugins like url_launcher
                                  // We can try to rely on the user knowing where it is, or just skip this for now.
                                  // Actually, we can use MpvLauncher to play, which is good enough.
                                },
                                tooltip: "Open Folder (Not Implemented)",
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
