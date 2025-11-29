# YouTube Subtitle Maker

A desktop GUI application to download YouTube audio, transcribe it locally using OpenAI Whisper, and optionally translate subtitles using Google Gemini.

## Features

- **YouTube Download**: Downloads audio from YouTube videos.
- **Local Transcription**: Uses OpenAI Whisper (Turbo model by default) for high-quality, free, local transcription.
- **AI Translation**: Uses Google Gemini API (requires your own key) to translate subtitles into various languages.
  - Default: `gemini-2.5-flash-lite` (Fast/Cheap).
  - Optional: `gemini-2.5-pro` (High Quality).
- **GUI**: Simple and easy-to-use interface built with PySide6.
  - **Video Preview**: Shows title and thumbnail of the YouTube video.
  - **Title Translation**: Translate video titles with one click.
  - **History List**: Keeps track of processed videos for easy access.
  - **MPV Integration**: Play videos with subtitles directly from the app.
    - *Note*: You can now specify the path to `mpv.exe` in the settings if it's not in your PATH.
  - **Whisper Device**: Choose between Auto, CPU, or GPU.
  - **API Key Test**: Verify your Gemini API key directly in the app.
- **SRT Output**: Generates standard `.srt` subtitle files.

## Prerequisites

1. **Python 3.10+**
2. **FFmpeg**: Must be installed and added to your system PATH.
   - Windows: [Download FFmpeg](https://ffmpeg.org/download.html), extract, and add `bin` folder to PATH.
   - macOS: `brew install ffmpeg`
   - Linux: `sudo apt install ffmpeg`
3. **mpv**: Required for the "Play with mpv" feature. Add it to your system PATH.

## Installation

1. Create a virtual environment (recommended):
   ```bash
   python -m venv venv
   # Windows
   venv\Scripts\activate
   # macOS/Linux
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   *Note: If you have a GPU, you may want to install PyTorch with CUDA support manually for faster transcription.*

## Usage

1. Run the application:
   ```bash
   python main.py
   ```

2. **Transcribe Only**:
   - Paste a YouTube URL (Metadata will load automatically).
   - Select Whisper model (default: `turbo`) and Device (Auto/CPU/GPU).
   - Click "Start Processing".
   - Output: `<video_id>_original.srt` in the output folder.

3. **Transcribe & Translate**:
   - Check "Enable translation with Gemini".
   - Enter your Google Gemini API Key.
   - Click "Test Key" to verify it.
   - Select Target Language.
   - Select Gemini Model (default: `gemini-2.5-flash-lite`).
   - Click "Start Processing".
   - Output: `<video_id>_original.srt` AND `<video_id>_<lang>.srt`.

4. **Play with MPV**:
   - After processing, click "Play with mpv" to watch the video with subtitles.
   - You can also select a video from the **History** list and play it.

5. **Translate Title**:
   - After loading a video, click "Translate Title" to get the title in your target language.

## Configuration

Settings (API key, output directory, history, etc.) are saved automatically to `~/.yt_subtitle_tool/config.json`.

## Notes

- **First Run**: Whisper will download the model file (approx 1-3GB depending on size) on the first run. The GUI might show "Transcribing..." for a while during this download.
- **Security**: Your Gemini API key is stored in plain text in the config file. Do not share your config file.
