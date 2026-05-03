class VideoMetadata {
  final bool ok;
  final String? videoId;
  final String? titleOriginal;
  final String? thumbnailUrl;
  final double? durationSeconds;
  final String? error;

  VideoMetadata({
    required this.ok,
    this.videoId,
    this.titleOriginal,
    this.thumbnailUrl,
    this.durationSeconds,
    this.error,
  });

  factory VideoMetadata.fromJson(Map<String, dynamic> json) {
    final videoId = json['video_id'] as String?;
    final rawThumb = json['thumbnail_url'] as String?;
    final normalizedThumb = (videoId != null && (rawThumb == null || rawThumb.contains('maxresdefault')))
        ? 'https://img.youtube.com/vi/$videoId/hqdefault.jpg'
        : rawThumb;

    return VideoMetadata(
      ok: json['ok'] ?? false,
      videoId: videoId,
      titleOriginal: json['title_original'],
      thumbnailUrl: normalizedThumb,
      durationSeconds: json['duration_seconds']?.toDouble(),
      error: json['error'],
    );
  }
}

class ProcessResponse {
  final bool ok;
  final String? videoId;
  final String? originalSrtPath;
  final String? translatedSrtPath;
  final String? videoFilePath;
  final String? error;

  ProcessResponse({
    required this.ok,
    this.videoId,
    this.originalSrtPath,
    this.translatedSrtPath,
    this.videoFilePath,
    this.error,
  });

  factory ProcessResponse.fromJson(Map<String, dynamic> json) {
    return ProcessResponse(
      ok: json['ok'] ?? false,
      videoId: json['video_id'],
      originalSrtPath: json['original_srt_path'],
      translatedSrtPath: json['translated_srt_path'],
      videoFilePath: json['video_file_path'],
      error: json['error'],
    );
  }
}

class HistoryItem {
  final String url;
  final String? videoId;
  final String? titleOriginal;
  final String? titleTranslated;
  final String? targetLang;
  final String? subtitlePath;
  final String? audioPath;
  final String? thumbnailUrl;
  final String lastUsed;

  HistoryItem({
    required this.url,
    this.videoId,
    this.titleOriginal,
    this.titleTranslated,
    this.targetLang,
    this.subtitlePath,
    this.audioPath,
    this.thumbnailUrl,
    required this.lastUsed,
  });

  Map<String, dynamic> toJson() {
    return {
      'url': url,
      'video_id': videoId,
      'title_original': titleOriginal,
      'title_translated': titleTranslated,
      'target_lang': targetLang,
      'subtitle_path': subtitlePath,
      'audio_path': audioPath,
      'thumbnail_url': thumbnailUrl,
      'last_used': lastUsed,
    };
  }

  factory HistoryItem.fromJson(Map<String, dynamic> json) {
    final videoId = json['video_id'] as String?;
    final rawThumb = json['thumbnail_url'] as String?;
    final normalizedThumb = (videoId != null && (rawThumb == null || rawThumb.contains('maxresdefault')))
        ? 'https://img.youtube.com/vi/$videoId/hqdefault.jpg'
        : rawThumb;

    return HistoryItem(
      url: json['url'],
      videoId: videoId,
      titleOriginal: json['title_original'],
      titleTranslated: json['title_translated'],
      targetLang: json['target_lang'],
      subtitlePath: json['subtitle_path'],
      audioPath: json['audio_path'],
      thumbnailUrl: normalizedThumb,
      lastUsed: json['last_used'],
    );
  }
}
