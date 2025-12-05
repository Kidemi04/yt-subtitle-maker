import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api_service.dart';
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
    "tiny": "Very Fast. Low Accuracy. (Requires ~1GB RAM)",
    "base": "Fast. Decent Accuracy. (Requires ~1GB RAM)",
    "small": "Balanced. Good Accuracy. (Requires ~2GB RAM)",
    "medium": "Accurate. Slower. (Requires ~5GB RAM)",
    "turbo": "Most Accurate. Fast. (Requires ~6GB+ VRAM/RAM)",
  };

  @override
  void initState() {
    super.initState();
    _checkDependencies();
  }

  Future<void> _checkDependencies() async {
    final api = ref.read(apiServiceProvider);
    
    setState(() => _status = "Checking system requirements...");
    final status = await api.checkDependencies();
    
    if (status == null) {
      setState(() {
        _status = "Could not connect to backend server.\nPlease ensure the backend is running.";
        _error = true;
      });
      return;
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
                    child: Text(_status, style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold), textAlign: TextAlign.center),
                  ),
                  
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade700),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedModel,
                      isExpanded: true,
                      items: _modelDescriptions.keys.map((model) {
                        return DropdownMenuItem(
                          value: model,
                          child: Text(model.toUpperCase()),
                        );
                      }).toList(),
                      onChanged: (v) => setState(() => _selectedModel = v!),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  _modelDescriptions[_selectedModel]!,
                  style: const TextStyle(fontSize: 12, color: Colors.orange),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
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
