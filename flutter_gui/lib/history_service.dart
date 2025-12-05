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
      String? titleOriginal;
      String? titleTranslated;
      String? thumbnailUrl;
      
      // Try to find metadata from file list if we returned it (backend doesn't return json content yet)
      // But we can infer from filenames or if we update backend to return metadata content.
      // Actually, backend list_outputs just returns file list.
      // But wait, if we have a json file, we can't easily read it here without an API call.
      // However, the backend `list_outputs` could have returned the metadata if we wanted.
      // For now, let's stick to what we have, but maybe we can improve the backend response later.
      // OR, we can just rely on the heuristic we added in backend list_outputs.
      
      // Actually, let's assume the backend *could* return more info, but since I didn't update the backend response model to include metadata content, 
      // I will rely on the file list for now.
      // BUT, I can update the backend to return the metadata content in the file list?
      // No, that's too much data.
      
      // Let's just use what we have.
      // If we want to support the "Original Title" and "Translated Title" from history,
      // we need to persist it.
      // The `importFiles` is mostly for restoring from disk if the local history is lost or for new installs.
      // If we want to read the JSON file, we would need an API endpoint to read a file, or `list_outputs` should return it.
      
      // Let's assume for now we just use the filenames.
      // But I can try to parse the filename better.
      
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
        if ((existing.subtitlePath == null && subtitlePath != null) || existing.thumbnailUrl == null) {
          final updated = HistoryItem(
            url: existing.url,
            videoId: existing.videoId,
            titleOriginal: existing.titleOriginal,
            titleTranslated: existing.titleTranslated,
            targetLang: existing.targetLang ?? targetLang,
            subtitlePath: existing.subtitlePath ?? subtitlePath,
            thumbnailUrl: existing.thumbnailUrl ?? "https://img.youtube.com/vi/$vid/hqdefault.jpg",
            lastUsed: existing.lastUsed,
          );
          final newState = [...state];
          newState[existingIndex] = updated;
          state = newState;
        }
      } else {
        // Add new
        newItems.add(HistoryItem(
          url: "https://youtube.com/watch?v=$vid",
          videoId: vid,
          titleOriginal: "Video $vid", // Placeholder until we load metadata
          titleTranslated: null,
          targetLang: targetLang,
          subtitlePath: subtitlePath,
          thumbnailUrl: "https://img.youtube.com/vi/$vid/hqdefault.jpg",
          lastUsed: DateTime.now().toIso8601String(),
        ));
      }
    });

    if (newItems.isNotEmpty) {
      state = [...state, ...newItems];
    }
    
    _saveHistory();
  }

  Future<void> removeFromHistory(String videoId) async {
    state = state.where((item) => item.videoId != videoId).toList();
    _saveHistory();
  }
}
