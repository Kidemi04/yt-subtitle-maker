# YouTube Subtitle Maker

A powerful desktop application to download YouTube audio, transcribe it locally using OpenAI Whisper, and translate subtitles using Google Gemini.

**New Architecture**: This project now features a **Python HTTP API Backend** and a modern **Flutter Desktop Frontend**.

## Features

- **YouTube Download**: Downloads audio from YouTube videos.
- **Local Transcription**: Uses OpenAI Whisper (Turbo model by default) for high-quality, free, local transcription.
- **AI Translation**: Uses Google Gemini API to translate subtitles.
- **Modern GUI**: A clean, responsive Flutter desktop interface.
  - **Video Preview**: Shows title and thumbnail.
  - **Title Translation**: Translate video titles instantly.
  - **MPV Integration**: Play videos with subtitles directly.
  - **Logs & History**: Track your processing tasks.

1. Create and activate virtual environment:
   ```bash
   python -m venv venv
   venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

### 2. Flutter Frontend

1. Navigate to `flutter_gui`:
   ```bash
   cd flutter_gui
   ```
2. Get dependencies:
   ```bash
   flutter pub get
   ```

## Running the App

You need to run both the backend and frontend.

**Step 1: Start the Backend**
Open a terminal in the root directory:
```bash
venv\Scripts\activate
uvicorn backend_api:app --reload
```
*The API will start at `http://127.0.0.1:8000`.*

**Step 2: Start the Frontend**
Open a new terminal in `flutter_gui`:
```bash
cd flutter_gui
flutter run -d windows
```
*(Or use `-d macos` on Mac).*

## Legacy Mode

You can still run the old PySide6 GUI if preferred:
```bash
python main.py
```

## Configuration

Settings are saved to `~/.yt_subtitle_tool/config.json`.
