import os
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
import uvicorn
import threading
import sys

# Import existing core logic
from core.audio_downloader import download_audio
from core.transcriber import transcribe_audio
from core.subtitles import write_srt
from core.translator_gemini import translate_segments_with_gemini, test_gemini_api_key, translate_title_with_gemini
from core.youtube_metadata import fetch_video_metadata
from core.config import load_config, save_config, save_config, AppConfig

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
        # We use a temporary location or the final location?
        # Let's download to the main output dir first, then move?
        # Or just download directly.
        # But we need video title for the folder name.
        # Let's fetch metadata first.
        meta = fetch_video_metadata(req.url)
        video_id = get_video_id(req.url)
        title = meta.get("title", video_id)
        
        # Sanitize title for folder name
        safe_title = "".join([c for c in title if c.isalpha() or c.isdigit() or c==' ' or c=='_']).strip()
        folder_name = f"{safe_title}_{video_id}"
        video_output_dir = os.path.join(output_dir, folder_name)
        os.makedirs(video_output_dir, exist_ok=True)
        
        # Save metadata json
        metadata_path = os.path.join(video_output_dir, f"{video_id}.json")
        with open(metadata_path, "w", encoding="utf-8") as f:
            json.dump({
                "video_id": video_id,
                "title_original": title,
                "thumbnail_url": meta.get("thumbnail_url"),
                "url": req.url,
                "timestamp": str(datetime.datetime.now())
            }, f, indent=4)
            
        audio_path, duration = download_audio(req.url, video_output_dir)
        
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
        # video_id is already known
        original_srt_path = os.path.join(video_output_dir, f"{video_id}_original.srt")
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
            translated_srt_path = os.path.join(video_output_dir, f"{video_id}_{req.target_lang}.srt")
            write_srt(segments, translated_srt_path, field="translated")
            translated_srt_path = os.path.abspath(translated_srt_path)
            
            # Update metadata with translation info
            try:
                with open(metadata_path, "r", encoding="utf-8") as f:
                    meta_data = json.load(f)
                meta_data["target_lang"] = req.target_lang
                # We don't have translated title here unless we call translate_title separately
                # But we can store it if we did.
                with open(metadata_path, "w", encoding="utf-8") as f:
                    json.dump(meta_data, f, indent=4)
            except:
                pass
            
        return ProcessResponse(
            ok=True,
            video_id=video_id,
            original_srt_path=original_srt_path,
            translated_srt_path=translated_srt_path,
            video_file_path=audio_path 
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
        
        # Walk through subdirectories
        for root, dirs, filenames in os.walk(output_dir):
            for f in filenames:
                path = os.path.join(root, f)
                
                # Heuristic parsing
                name, ext = os.path.splitext(f)
                if ext.lower() not in ['.mp3', '.m4a', '.wav', '.srt']:
                    continue
                    
                video_id = "unknown"
                ftype = "unknown"
                lang = None
                
                # Try to find metadata json in the same folder
                meta_path = os.path.join(root, f"{name}.json") # if name is video_id
                # But name might be {video_id}_original or {video_id}_{lang}
                
                # Simple parsing based on suffix
                if ext.lower() == '.srt':
                    if name.endswith("_original"):
                        ftype = "srt_original"
                        video_id = name.replace("_original", "")
                    else:
                        parts = name.split('_')
                        if len(parts) > 1:
                            lang = parts[-1]
                            ftype = "srt_translated"
                            video_id = "_".join(parts[:-1])
                        else:
                            ftype = "srt_original"
                else:
                    ftype = "audio"
                    video_id = name
                
                # If we have a metadata file for this video_id in this folder, we can read it?
                # Actually, the frontend just needs the list of files, and it will group them.
                # But we can also return the metadata file content if needed?
                # For now, let's just return the files.
                
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

# --- Dependency Endpoints ---

from core.dependency_manager import check_whisper_model, check_ffmpeg, check_mpv
from fastapi.responses import StreamingResponse
import json

class DependencyStatus(BaseModel):
    whisper_model: str
    whisper_exists: bool
    ffmpeg_exists: bool
    mpv_exists: bool

@app.get("/api/dependencies/status", response_model=DependencyStatus)
def get_dependency_status():
    # We check the default model 'turbo' or read from config
    # For init screen, we enforce the default 'turbo' model for now, 
    # or we could check the one in config.
    config = load_config()
    model = config.whisper_model # Default 'turbo'
    
    return DependencyStatus(
        whisper_model=model,
        whisper_exists=check_whisper_model(model),
        ffmpeg_exists=check_ffmpeg(),
        mpv_exists=check_mpv()
    )

@app.post("/api/dependencies/install")
def install_dependencies(model_name: str = None):
    """
    Streams download progress for the Whisper model.
    """
    config = load_config()
    
    # If model_name is provided, update config and use it
    if model_name:
        config.whisper_model = model_name
        save_config(config)
    
    target_model = config.whisper_model
    
    def event_generator():
        from core.dependency_manager import check_whisper_model, download_whisper_model_generator

        try:
            # Check if already exists
            if check_whisper_model(target_model):
                yield json.dumps({"status": "done", "message": "Model already exists"}) + "\n"
                return

            for downloaded, total, speed in download_whisper_model_generator(target_model):
                data = {
                    "status": "downloading",
                    "downloaded": downloaded,
                    "total": total,
                    "speed": speed,
                    "percent": (downloaded / total * 100) if total > 0 else 0
                }
                yield json.dumps(data) + "\n"

            yield json.dumps({"status": "done"}) + "\n"
            
        except Exception as e:
            yield json.dumps({"status": "error", "message": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

# --- Download Feature ---

class DeleteOutputRequest(BaseModel):
    video_id: str

@app.post("/api/delete_output")
def delete_output(req: DeleteOutputRequest):
    try:
        config = load_config()
        output_dir = config.output_dir
        
        # Find the folder or files
        deleted = False
        
        # Check for subfolder first
        for root, dirs, filenames in os.walk(output_dir):
            for d in dirs:
                if d.endswith(f"_{req.video_id}"):
                    import shutil
                    shutil.rmtree(os.path.join(root, d))
                    deleted = True
                    break
            if deleted: break
            
        if not deleted:
            # Fallback for legacy flat files
            for f in os.listdir(output_dir):
                if req.video_id in f:
                    os.remove(os.path.join(output_dir, f))
                    deleted = True
                    
        return {"ok": True, "deleted": deleted}
    except Exception as e:
        return {"ok": False, "error": str(e)}

class OpenFolderRequest(BaseModel):
    path: str

@app.post("/api/open_folder")
def open_folder(req: OpenFolderRequest):
    try:
        path = req.path
        if not os.path.exists(path):
            return {"ok": False, "error": "Path does not exist"}
            
        if os.path.isfile(path):
            path = os.path.dirname(path)
            
        os.startfile(path)
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

# --- Config Endpoints ---

class ConfigResponse(BaseModel):
    output_dir: str
    download_dir: str
    whisper_model: str

class UpdateConfigRequest(BaseModel):
    download_dir: Optional[str] = None

@app.get("/api/config", response_model=ConfigResponse)
def get_config_endpoint():
    config = load_config()
    return ConfigResponse(
        output_dir=config.output_dir,
        download_dir=config.download_dir,
        whisper_model=config.whisper_model
    )

@app.post("/api/config")
def update_config_endpoint(req: UpdateConfigRequest):
    config = load_config()
    if req.download_dir:
        config.download_dir = req.download_dir
    save_config(config)
    return {"ok": True}

# --- Download Feature ---

class DownloadRequest(BaseModel):
    url: str
    type: str = "video" # video or audio
    quality: str = "best"
    format: str = "mp4"

class DownloadResponse(BaseModel):
    ok: bool
    error: Optional[str] = None
    filename: Optional[str] = None
    path: Optional[str] = None

@app.post("/api/download")
def download_media_endpoint(req: DownloadRequest):
    """
    Streams download progress.
    """
    def event_generator():
        try:
            config = load_config()
            downloads_dir = config.download_dir
            
            from core.audio_downloader import download_media_generator
            
            for event in download_media_generator(req.url, downloads_dir, req.type, req.quality, req.format):
                yield json.dumps(event) + "\n"
                
        except Exception as e:
            yield json.dumps({"status": "error", "error": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")

@app.get("/api/downloads")
def list_downloads():
    try:
        config = load_config()
        downloads_dir = config.download_dir
        
        files = []
        
        # Walk through video and audio subfolders
        for root, dirs, filenames in os.walk(downloads_dir):
            for f in filenames:
                full_path = os.path.join(root, f)
                
                # Filter for media files
                ext = os.path.splitext(f)[1].lower()
                if ext not in ['.mp4', '.mkv', '.mp3', '.m4a', '.webm']:
                    continue
                    
                # Try to find thumbnail
                thumb_path = None
                base_name = os.path.splitext(full_path)[0]
                for t_ext in ['.jpg', '.webp', '.png']:
                    if os.path.exists(base_name + t_ext):
                        thumb_path = base_name + t_ext
                        break
                
                files.append({
                    "filename": f,
                    "path": full_path,
                    "size": os.path.getsize(full_path),
                    "time": os.path.getmtime(full_path),
                    "thumbnail": thumb_path
                })
        
        # Sort by time desc
        files.sort(key=lambda x: x['time'], reverse=True)
        return {"ok": True, "files": files}
    except Exception as e:
        return {"ok": False, "error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000)
