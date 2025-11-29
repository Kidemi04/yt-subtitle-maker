import 'package:flutter/material.dart';
import 'control_panel.dart';
import 'history_panel.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
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
    );
  }
}
