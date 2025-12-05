import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'models.dart';

final apiServiceProvider = Provider((ref) => ApiService());

class ApiService {
  final String baseUrl;

  ApiService({this.baseUrl = 'http://127.0.0.1:8000'});

  Future<VideoMetadata> fetchMetadata(String url) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/metadata'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'url': url}),
      );

      if (response.statusCode == 200) {
        return VideoMetadata.fromJson(jsonDecode(response.body));
      } else {
        return VideoMetadata(ok: false, error: 'HTTP Error: ${response.statusCode}');
      }
    } catch (e) {
      return VideoMetadata(ok: false, error: 'Connection failed: $e');
    }
  }

  Future<ProcessResponse> processVideo({
    required String url,
    required String sourceLang,
    required String targetLang,
    required String whisperDevice,
    required String whisperModel,
    required String geminiModel,
    String? geminiApiKey,
    required bool enableTranslation,
  }) async {
    try {
      final body = {
        'url': url,
        'source_lang': sourceLang,
        'target_lang': targetLang,
        'whisper_device': whisperDevice,
        'whisper_model': whisperModel,
        'gemini_model': geminiModel,
        'gemini_api_key': geminiApiKey,
        'enable_translation': enableTranslation,
      };

      final response = await http.post(
        Uri.parse('$baseUrl/api/process'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        return ProcessResponse.fromJson(jsonDecode(response.body));
      } else {
        return ProcessResponse(ok: false, error: 'HTTP Error: ${response.statusCode}');
      }
    } catch (e) {
      return ProcessResponse(ok: false, error: 'Connection failed: $e');
    }
  }

  Future<bool> testApiKey(String apiKey, String model) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/test_gemini_key'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'api_key': apiKey, 'model': model}),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['ok'] == true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  Future<String?> translateTitle({
    required String title,
    required String targetLang,
    required String apiKey,
    required String model,
  }) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/api/translate_title'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'title': title,
          'target_lang': targetLang,
          'gemini_api_key': apiKey,
          'gemini_model': model,
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['ok'] == true) {
          return data['translated_title'];
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, dynamic>?> checkDependencies() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/api/dependencies/status'));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
    } catch (e) {
      print("Check dependencies error: $e");
    }
    return null;
  }

  Stream<Map<String, dynamic>> installDependencies(String modelName) async* {
    try {
      final request = http.Request('POST', Uri.parse('$baseUrl/api/dependencies/install?model_name=$modelName'));
      final response = await request.send();

      await for (final chunk in response.stream.transform(utf8.decoder).transform(const LineSplitter())) {
        if (chunk.isNotEmpty) {
          try {
            yield jsonDecode(chunk);
          } catch (e) {
            print("Parse error: $e");
          }
        }
      }
    } catch (e) {
      yield {"status": "error", "message": e.toString()};
    }
  }

  Future<List<dynamic>> fetchOutputs() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/api/outputs'));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['ok'] == true) {
          return data['files'];
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  Stream<Map<String, dynamic>> downloadMedia(String url, String type) async* {
    try {
      final request = http.Request('POST', Uri.parse('$baseUrl/api/download'));
      request.headers['Content-Type'] = 'application/json';
      request.body = jsonEncode({'url': url, 'type': type});

      final response = await http.Client().send(request);

      if (response.statusCode != 200) {
        yield {'status': 'error', 'error': 'HTTP ${response.statusCode}'};
        return;
      }

      final stream = response.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter());

      await for (final line in stream) {
        if (line.trim().isNotEmpty) {
          try {
            yield jsonDecode(line) as Map<String, dynamic>;
          } catch (e) {
            print("Error parsing JSON line: $e");
          }
        }
      }
    } catch (e) {
      yield {'status': 'error', 'error': e.toString()};
    }
  }

  Future<List<dynamic>> fetchDownloads() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/api/downloads'));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        if (data['ok'] == true) {
          return data['files'];
        }
      }
      return [];
    } catch (e) {
      return [];
    }
  }
}
