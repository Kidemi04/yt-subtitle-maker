import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_service.dart';
import '../mpv_launcher.dart';
import 'home_screen.dart';

class InitScreen extends ConsumerStatefulWidget {
  const InitScreen({super.key});

  @override
  ConsumerState<InitScreen> createState() => _InitScreenState();
}

class _InitScreenState extends ConsumerState<InitScreen> {
  String _status = "Checking dependencies...";
  double _progress = 0.0;
  String _speed = "";
  bool _error = false;
  bool _needsDownload = false;
  String _selectedModel = "turbo";

  final Map<String, String> _modelDescriptions = {
    "tiny": "Very Fast · Low Accuracy (~1 GB RAM)",
    "base": "Fast · Decent Accuracy (~1 GB RAM)",
    "small": "Balanced · Good Accuracy (~2 GB RAM)",
    "medium": "Accurate · Slower (~5 GB RAM)",
    "turbo": "Fast + Accurate · Recommended (~6 GB VRAM/RAM)",
  };

  @override
  void initState() {
    super.initState();
    _checkDependencies();
  }

  Future<void> _checkDependencies() async {
    final api = ref.read(apiServiceProvider);
    
    setState(() {
      _status = "Checking system requirements...";
      _error = false;
    });

    // Retry up to 5 times (backend may still be starting)
    Map<String, dynamic>? status;
    for (int attempt = 0; attempt < 5; attempt++) {
      status = await api.checkDependencies();
      if (status != null) break;
      if (attempt < 4) {
        await Future.delayed(const Duration(seconds: 2));
        setState(() => _status = "Connecting to backend... (${attempt + 2}/5)");
      }
    }
    
    if (status == null) {
      setState(() {
        _status = "Could not connect to backend server.\nPlease ensure the backend is running.";
        _error = true;
      });
      return;
    }

    // Load mpv path from config so MpvLauncher uses the saved executable
    final config = await api.getConfig();
    if (config != null) {
      MpvLauncher.mpvExecutable = config['mpv_path'] ?? '';
    }

    final whisperExists = status['whisper_exists'] ?? false;
    
    if (whisperExists) {
      _navigateToHome();
    } else {
      setState(() {
        _needsDownload = true;
        _status = "Whisper Model Missing";
      });
    }
  }

  Future<void> _startDownload() async {
    final api = ref.read(apiServiceProvider);
    
    setState(() {
      _needsDownload = false;
      _status = "Downloading Whisper Model ($_selectedModel)...";
    });
    
    api.installDependencies(_selectedModel).listen(
      (data) {
        if (data['status'] == 'downloading') {
          final percent = data['percent'] as num;
          final speedBytes = data['speed'] as num;
          final totalBytes = data['total'] as num;
          final downloadedBytes = data['downloaded'] as num;
          
          final speedMb = speedBytes / (1024 * 1024);
          
          String etaStr = "";
          if (speedBytes > 0) {
            final remainingBytes = totalBytes - downloadedBytes;
            final etaSeconds = remainingBytes / speedBytes;
            if (etaSeconds < 60) {
              etaStr = "${etaSeconds.toStringAsFixed(0)}s";
            } else {
              etaStr = "${(etaSeconds / 60).toStringAsFixed(1)}m";
            }
          }
          
          setState(() {
            _progress = percent / 100.0;
            _speed = "${speedMb.toStringAsFixed(1)} MB/s";
            _status = "Downloading... ${percent.toStringAsFixed(1)}% (ETA: $etaStr)";
          });
        } else if (data['status'] == 'done') {
          _navigateToHome();
        } else if (data['status'] == 'error') {
          setState(() {
            _status = "Error: ${data['message']}";
            _error = true;
            _needsDownload = true; // Allow retry
          });
        }
      },
      onError: (e) {
        setState(() {
          _status = "Connection error: $e";
          _error = true;
          _needsDownload = true;
        });
      },
    );
  }

  void _navigateToHome() {
    if (!mounted) return;
    Navigator.of(context).pushReplacement(
      MaterialPageRoute(builder: (_) => const HomeScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Container(
          width: 500,
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.download_for_offline, size: 64, color: Colors.blue),
              const SizedBox(height: 24),
              const Text(
                "Setting Up",
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                "We need to download the AI model to run locally on your device.",
                textAlign: TextAlign.center,
                style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant),
              ),
              const SizedBox(height: 32),
              
              if (_needsDownload) ...[                
                // Model Selection
                if (_error)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16),
                    child: Text(_status,
                        style: const TextStyle(
                            color: Colors.red, fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center),
                  ),

                const Align(
                  alignment: Alignment.centerLeft,
                  child: Text('Select Whisper Model',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 8),

                // Radio list of models
                ...(_modelDescriptions.keys.map((model) {
                  final isRecommended = model == 'turbo';
                  return Card(
                    margin: const EdgeInsets.only(bottom: 6),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                      side: _selectedModel == model
                          ? BorderSide(
                              color: Theme.of(context).colorScheme.primary,
                              width: 2)
                          : BorderSide.none,
                    ),
                    child: RadioListTile<String>(
                      value: model,
                      groupValue: _selectedModel,
                      onChanged: (v) => setState(() => _selectedModel = v!),
                      dense: true,
                      title: Row(
                        children: [
                          Text(model.toUpperCase(),
                              style: const TextStyle(
                                  fontWeight: FontWeight.bold, fontSize: 13)),
                          if (isRecommended) ...[                            
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Theme.of(context).colorScheme.primaryContainer,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                'Recommended',
                                style: TextStyle(
                                  fontSize: 10,
                                  color: Theme.of(context).colorScheme.onPrimaryContainer,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                      subtitle: Text(
                        _modelDescriptions[model]!,
                        style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context).colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  );
                })).toList(),

                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 45,
                  child: FilledButton(
                    onPressed: _startDownload,
                    child: const Text("Download & Install"),
                  ),
                ),
              ] else ...[
                // Progress or Error
                if (_error)
                  Text(_status, style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold), textAlign: TextAlign.center)
                else ...[
                   if (!_needsDownload && _progress == 0 && !_error && _status != "Checking system requirements...")
                      const CircularProgressIndicator()
                   else
                      LinearProgressIndicator(value: _progress > 0 ? _progress : null),
                   const SizedBox(height: 16),
                   Text(_status, style: const TextStyle(fontWeight: FontWeight.w500)),
                   if (_speed.isNotEmpty)
                     Text(_speed, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                ],
                
                if (_error)
                  Padding(
                    padding: const EdgeInsets.only(top: 16),
                    child: ElevatedButton(
                      onPressed: _checkDependencies,
                      child: const Text("Retry"),
                    ),
                  )
              ],
            ],
          ),
        ),
      ),
    );
  }
}
