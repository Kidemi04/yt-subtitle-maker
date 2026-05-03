import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../main.dart';
import 'control_panel.dart';
import 'history_panel.dart';
import 'download_panel.dart';
import 'settings_dialog.dart';

/// Changing this provider value will switch the main tab programmatically.
final activeTabProvider = StateProvider<int>((ref) => 0);

class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Listen for programmatic tab switches (e.g., from history panel)
    ref.listen(activeTabProvider, (_, next) {
      if (_tabController.index != next) {
        _tabController.animateTo(next);
      }
    });

    return Scaffold(
      appBar: AppBar(
        title: const Text('YouTube Subtitle Maker'),
        actions: [
          IconButton(
            icon: Icon(ref.watch(themeModeProvider) == ThemeMode.dark
                ? Icons.light_mode
                : Icons.dark_mode),
            tooltip: ref.watch(themeModeProvider) == ThemeMode.dark
                ? 'Switch to Light Mode'
                : 'Switch to Dark Mode',
            onPressed: () {
              final current = ref.read(themeModeProvider);
              ref.read(themeModeProvider.notifier).state =
                  current == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            tooltip: 'Settings',
            onPressed: () => showDialog(
              context: context,
              builder: (context) => const SettingsDialog(),
            ),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(icon: Icon(Icons.subtitles), text: 'Subtitle Generator'),
            Tab(icon: Icon(Icons.download), text: 'Downloader'),
            Tab(icon: Icon(Icons.history), text: 'History'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // Tab 1: Subtitle Generator (Split View)
          Row(
            children: [
              Expanded(
                flex: 2,
                child: Container(
                  color: Theme.of(context).colorScheme.surface,
                  child: const ControlPanel(),
                ),
              ),
              const VerticalDivider(width: 1),
              Expanded(
                flex: 1,
                child: Container(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.3),
                  child: const HistoryPanel(),
                ),
              ),
            ],
          ),
          // Tab 2: Downloader
          const DownloadPanel(),
          // Tab 3: History
          const HistoryTab(),
        ],
      ),
    );
  }
}

