import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import threading

# Import existing core logic
from core.audio_downloader import download_audio
from core.transcriber import transcribe_audio
from core.subtitles import write_srt
from core.translator_gemini import translate_segments_with_gemini, test_gemini_api_key, translate_title_with_gemini
from core.youtube_metadata import fetch_video_metadata
from core.config import load_config, save_config, AppConfig

app = FastAPI(title="YouTube Subtitle Maker API")

# --- Data Models ---

class MetadataRequest(BaseModel):
    url: str

class MetadataResponse(BaseModel):
    ok: bool
    video_id: Optional[str] = None
    title_original: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration_seconds: Optional[float] = None
    error: Optional[str] = None

class ProcessRequest(BaseModel):
    url: str
    source_lang: str = "auto"
    target_lang: str = "zh-CN"
    whisper_device: str = "auto"
    whisper_model: str = "turbo"
    gemini_model: str = "gemini-2.5-flash-lite"
    gemini_api_key: Optional[str] = None
    enable_translation: bool = False

class ProcessResponse(BaseModel):
    ok: bool
    video_id: Optional[str] = None
    original_srt_path: Optional[str] = None
    translated_srt_path: Optional[str] = None
    video_file_path: Optional[str] = None # We usually don't have video, but maybe audio path?
    error: Optional[str] = None

class TestKeyRequest(BaseModel):
    api_key: str
    model: str = "gemini-2.5-flash-lite"

class TestKeyResponse(BaseModel):
    ok: bool
    error: Optional[str] = None

class TranslateTitleRequest(BaseModel):
    title: str
    target_lang: str
    gemini_model: str = "gemini-2.5-flash-lite"
    gemini_api_key: str

class TranslateTitleResponse(BaseModel):
    ok: bool
    translated_title: Optional[str] = None
    error: Optional[str] = None

# --- Helpers ---

def get_video_id(url: str) -> str:
    # Simple heuristic, or rely on metadata
    import re
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
    if match:
        return match.group(1)
    return "unknown_id"

# --- Endpoints ---

@app.post("/api/metadata", response_model=MetadataResponse)
def get_metadata(req: MetadataRequest):
    try:
        # fetch_video_metadata currently returns title/thumb. 
        # We might need to update it or just use it as is.
        # It doesn't return duration or ID explicitly, but we can extract ID from URL.
        # Let's use the existing function.
        meta = fetch_video_metadata(req.url)
        video_id = get_video_id(req.url)
        
        # We don't have duration from fetch_video_metadata yet (it uses extract_flat=False but doesn't return it).
        # We can accept that for now.
        
        return MetadataResponse(
            ok=True,
            video_id=video_id,
            title_original=meta.get("title"),
            thumbnail_url=meta.get("thumbnail_url"),
            duration_seconds=0 # Placeholder
        )
    except Exception as e:
        return MetadataResponse(ok=False, error=str(e))

@app.post("/api/process", response_model=ProcessResponse)
def process_video(req: ProcessRequest):
    # This is a blocking call for now, as requested.
    try:
        # Load config to get output dir (or use default)
        config = load_config()
        output_dir = config.output_dir
        
        # 1. Download
        print(f"Downloading {req.url}...")
        audio_path, duration = download_audio(req.url, output_dir)
        
        # 2. Transcribe
        print(f"Transcribing {audio_path}...")
        lang_arg = req.source_lang if req.source_lang.lower() not in ["auto", "auto detect"] else None
        
        segments = transcribe_audio(
            audio_path,
            model_name=req.whisper_model,
            language=lang_arg,
            device=req.whisper_device,
            duration=duration
        )
        
        # 3. Save Original
        video_id = os.path.splitext(os.path.basename(audio_path))[0]
        original_srt_path = os.path.join(output_dir, f"{video_id}_original.srt")
        write_srt(segments, original_srt_path, field="text")
        original_srt_path = os.path.abspath(original_srt_path)
        
        translated_srt_path = None
        
        # 4. Translate
        if req.enable_translation and req.gemini_api_key:
            print(f"Translating to {req.target_lang}...")
            translate_segments_with_gemini(
                segments,
                req.target_lang,
                req.gemini_api_key,
                req.gemini_model
            )
            translated_srt_path = os.path.join(output_dir, f"{video_id}_{req.target_lang}.srt")
            write_srt(segments, translated_srt_path, field="translated")
            translated_srt_path = os.path.abspath(translated_srt_path)
            
        # 5. Update History (Optional, but good for consistency)
        # We can update the config file history if we want the Python side to track it too.
        # But the Flutter app might manage its own history.
        # Let's update it here just in case the legacy GUI is used later.
        # (Skipping for now to keep API stateless-ish, Flutter will manage history)
            
        return ProcessResponse(
            ok=True,
            video_id=video_id,
            original_srt_path=original_srt_path,
            translated_srt_path=translated_srt_path,
            video_file_path=audio_path # It's audio, but MPV can play it
        )
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return ProcessResponse(ok=False, error=str(e))

@app.post("/api/test_gemini_key", response_model=TestKeyResponse)
def api_test_key(req: TestKeyRequest):
    try:
        test_gemini_api_key(req.api_key, req.model)
        return TestKeyResponse(ok=True)
    except Exception as e:
        return TestKeyResponse(ok=False, error=str(e))

@app.post("/api/translate_title", response_model=TranslateTitleResponse)
def api_translate_title(req: TranslateTitleRequest):
    try:
        translated = translate_title_with_gemini(
            req.title,
            req.target_lang,
            req.gemini_api_key,
            req.gemini_model
        )
        return TranslateTitleResponse(ok=True, translated_title=translated)
    except Exception as e:
        return TranslateTitleResponse(ok=False, error=str(e))

class OutputFile(BaseModel):
    filename: str
    path: str
    video_id: str
    type: str # 'audio', 'srt_original', 'srt_translated'
    lang: Optional[str] = None

class ListOutputsResponse(BaseModel):
    ok: bool
    files: List[OutputFile] = []
    error: Optional[str] = None

@app.get("/api/outputs", response_model=ListOutputsResponse)
def list_outputs():
    try:
        config = load_config()
        output_dir = config.output_dir
        if not os.path.exists(output_dir):
            return ListOutputsResponse(ok=True, files=[])
            
        files = []
        for f in os.listdir(output_dir):
            path = os.path.join(output_dir, f)
            if not os.path.isfile(path):
                continue
                
            # Heuristic parsing
            # Format: {video_id}.mp3, {video_id}_original.srt, {video_id}_{lang}.srt
            name, ext = os.path.splitext(f)
            if ext.lower() not in ['.mp3', '.m4a', '.wav', '.srt']:
                continue
                
            video_id = name
            ftype = "unknown"
            lang = None
            
            if ext.lower() == '.srt':
                if name.endswith("_original"):
                    ftype = "srt_original"
                    video_id = name.replace("_original", "")
                else:
                    # Try to find lang code at end (e.g. _zh-CN)
                    parts = name.split('_')
                    if len(parts) > 1:
                        lang = parts[-1]
                        ftype = "srt_translated"
                        video_id = "_".join(parts[:-1])
                    else:
                        ftype = "srt_original" # Fallback
            else:
                ftype = "audio"
                
            files.append(OutputFile(
                filename=f,
                path=os.path.abspath(path),
                video_id=video_id,
                type=ftype,
                lang=lang
            ))
            
        return ListOutputsResponse(ok=True, files=files)
    except Exception as e:
        return ListOutputsResponse(ok=False, error=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
