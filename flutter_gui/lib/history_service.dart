import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';

final historyProvider = StateNotifierProvider<HistoryNotifier, List<HistoryItem>>((ref) {
  return HistoryNotifier();
});

class HistoryNotifier extends StateNotifier<List<HistoryItem>> {
  HistoryNotifier() : super([]) {
    _loadHistory();
  }

  Future<void> _loadHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final String? historyJson = prefs.getString('history');
    if (historyJson != null) {
      final List<dynamic> decoded = jsonDecode(historyJson);
      state = decoded.map((e) => HistoryItem.fromJson(e)).toList();
    }
  }

  Future<void> addToHistory(HistoryItem item) async {
    // Remove existing item with same URL to avoid duplicates (move to top)
    final newState = [
      item,
      ...state.where((element) => element.url != item.url),
    ];
    
    // Cap at 50 items
    if (newState.length > 50) {
      newState.removeLast();
    }

    state = newState;
    _saveHistory();
  }

  Future<void> _saveHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final String encoded = jsonEncode(state.map((e) => e.toJson()).toList());
    await prefs.setString('history', encoded);
  }
  
  Future<void> clearHistory() async {
    state = [];
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('history');
  }

  Future<void> importFiles(List<dynamic> files) async {
    // Group by video_id
    final Map<String, List<dynamic>> grouped = {};
    for (var f in files) {
      final vid = f['video_id'];
      if (!grouped.containsKey(vid)) grouped[vid] = [];
      grouped[vid]!.add(f);
    }

    final List<HistoryItem> newItems = [];
    
    grouped.forEach((vid, fileList) {
      // Find best info
      String? targetLang;
      String? subtitlePath;
      
      final translated = fileList.firstWhere((f) => f['type'] == 'srt_translated', orElse: () => null);
      if (translated != null) {
        targetLang = translated['lang'];
        subtitlePath = translated['path'];
      } else {
        final original = fileList.firstWhere((f) => f['type'] == 'srt_original', orElse: () => null);
        if (original != null) {
          subtitlePath = original['path'];
        }
      }

      // Check if exists
      final existingIndex = state.indexWhere((h) => h.videoId == vid);
      if (existingIndex != -1) {
        // Update existing if path is missing or different
        final existing = state[existingIndex];
        if (existing.subtitlePath == null && subtitlePath != null) {
          // Create new item with updated path
          final updated = HistoryItem(
            url: existing.url,
            videoId: existing.videoId,
            titleOriginal: existing.titleOriginal,
            titleTranslated: existing.titleTranslated,
            targetLang: existing.targetLang ?? targetLang,
            subtitlePath: subtitlePath,
            lastUsed: existing.lastUsed,
          );
          // Replace in state (we need to copy the list)
          final newState = [...state];
          newState[existingIndex] = updated;
          state = newState;
        }
      } else {
        // Add new
        newItems.add(HistoryItem(
          url: "https://youtube.com/watch?v=$vid",
          videoId: vid,
          titleOriginal: "Imported Video $vid",
          titleTranslated: null,
          targetLang: targetLang,
          subtitlePath: subtitlePath,
          lastUsed: DateTime.now().toIso8601String(),
        ));
      }
    });

    if (newItems.isNotEmpty) {
      state = [...state, ...newItems];
    }
    
    // Always save if we modified state (which we might have done in the loop)
    _saveHistory();
  }
}
