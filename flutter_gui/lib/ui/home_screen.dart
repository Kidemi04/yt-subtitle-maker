import 'package:flutter/material.dart';
import 'control_panel.dart';
import 'history_panel.dart';
import 'download_panel.dart';
import 'settings_dialog.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text("YouTube Subtitle Maker"),
          actions: [
            IconButton(
              icon: const Icon(Icons.settings),
              onPressed: () {
                showDialog(
                  context: context,
                  builder: (context) => const SettingsDialog(),
                );
              },
            ),
          ],
          bottom: const TabBar(
            tabs: [
              Tab(icon: Icon(Icons.subtitles), text: "Subtitle Generator"),
              Tab(icon: Icon(Icons.download), text: "Downloader"),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            // Tab 1: Subtitle Generator (Split View)
            Row(
              children: [
                // Left Panel: Controls (Flex 2)
                Expanded(
                  flex: 2,
                  child: Container(
                    color: Theme.of(context).colorScheme.surface,
                    child: const ControlPanel(),
                  ),
                ),
                // Vertical Divider
                const VerticalDivider(width: 1),
                // Right Panel: History & Logs (Flex 1)
                Expanded(
                  flex: 1,
                  child: Container(
                    color: Theme.of(context).colorScheme.surfaceContainerHighest.withOpacity(0.3),
                    child: const HistoryPanel(),
                  ),
                ),
              ],
            ),
            
            // Tab 2: Downloader
            const DownloadPanel(),
          ],
        ),
      ),
    );
  }
}
