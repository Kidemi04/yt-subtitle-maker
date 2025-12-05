import whisper
from typing import List, Dict, Optional
import torch
import os
import sys
import io
import re
import threading
import time

class StdoutCapture:
    """
    Captures stdout and parses Whisper progress lines.
    """
    def __init__(self, duration: float, callback):
        self.duration = duration
        self.callback = callback
        self.original_stdout = sys.stdout
        self.buffer = io.StringIO()
        self.running = False
        
    def __enter__(self):
        self.original_stdout = sys.stdout
        sys.stdout = self
        self.running = True
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        sys.stdout = self.original_stdout
        self.running = False

    def write(self, text):
        # Pass through to original stdout if needed, or just capture
        # self.original_stdout.write(text) # Uncomment to see in console
        
        # Parse text for timestamps
        # Whisper verbose output format: [00:00.000 --> 00:08.000] Text
        match = re.search(r"\[.*-->\s*(\d{2}):(\d{2})\.(\d{3})\]", text)
        if match and self.duration > 0:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            millis = int(match.group(3))
            current_seconds = minutes * 60 + seconds + millis / 1000.0
            
            progress = min(1.0, current_seconds / self.duration)
            if self.callback:
                self.callback(progress)
                
    def flush(self):
        self.original_stdout.flush()

def transcribe_audio(
    audio_path: str,
    model_name: str = "turbo",
    language: Optional[str] = None,
    device: str = "auto",
    duration: float = 0.0,
    progress_callback = None,
) -> List[Dict]:
    """
    Run Whisper locally to produce timestamped segments.
    """
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    try:
        # Determine device
        if device.lower() == "auto":
            run_device = "cuda" if torch.cuda.is_available() else "cpu"
        elif device.lower() in ["gpu", "cuda"]:
            if not torch.cuda.is_available():
                raise RuntimeError("CUDA/GPU requested but not available.")
            run_device = "cuda"
        else:
            run_device = "cpu"
        
        print(f"Loading Whisper model '{model_name}' on {run_device}...")
        from core.dependency_manager import get_whisper_cache_dir
        model = whisper.load_model(model_name, device=run_device, download_root=get_whisper_cache_dir())

        print(f"Transcribing '{audio_path}'...")
        # Map "Auto detect" to None for Whisper
        lang_arg = language if (language and language.lower() not in ["auto", "auto detect"]) else None

        # Use verbose=True to get progress output, capture it
        if progress_callback and duration > 0:
            with StdoutCapture(duration, progress_callback):
                result = model.transcribe(audio_path, language=lang_arg, verbose=True)
        else:
            result = model.transcribe(audio_path, language=lang_arg)
        
        segments = []
        for i, seg in enumerate(result["segments"]):
            segments.append({
                "id": i + 1,
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"].strip()
            })
            
        return segments

    except Exception as e:
        raise Exception(f"Transcription failed: {str(e)}")
