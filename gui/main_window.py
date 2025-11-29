import sys
import os
from PySide6.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit,
    QPushButton, QComboBox, QCheckBox, QFileDialog, QTextEdit, QProgressBar,
    QGroupBox, QMessageBox, QApplication, QListWidget, QListWidgetItem, QSplitter
)
from PySide6.QtCore import Qt, QThread, Signal, Slot, QDateTime
from PySide6.QtGui import QIcon, QPixmap
import requests

from core.config import load_config, save_config, AppConfig
from core.audio_downloader import download_audio
from core.transcriber import transcribe_audio
from core.subtitles import write_srt
from core.translator_gemini import translate_segments_with_gemini, test_gemini_api_key, translate_title_with_gemini
from core.youtube_metadata import fetch_video_metadata
from core.youtube_metadata import fetch_video_metadata
from core.mpv_player import play_with_mpv

class ApiTestWorker(QThread):
    finished = Signal(bool, str)

    def __init__(self, api_key, model_name):
        super().__init__()
        self.api_key = api_key
        self.model_name = model_name

    def run(self):
        try:
            test_gemini_api_key(self.api_key, self.model_name)
            self.finished.emit(True, "Valid")
        except Exception as e:
            self.finished.emit(False, str(e))

class TitleTranslationWorker(QThread):
    finished = Signal(str)
    error = Signal(str)

    def __init__(self, title, target_lang, api_key, model_name):
        super().__init__()
        self.title = title
        self.target_lang = target_lang
        self.api_key = api_key
        self.model_name = model_name

    def run(self):
        try:
            translated = translate_title_with_gemini(self.title, self.target_lang, self.api_key, self.model_name)
            self.finished.emit(translated)
        except Exception as e:
            self.error.emit(str(e))

class MetadataWorker(QThread):
    finished = Signal(dict)
    error = Signal(str)

    def __init__(self, url):
        super().__init__()
        self.url = url

    def run(self):
        try:
            metadata = fetch_video_metadata(self.url)
            self.finished.emit(metadata)
        except Exception as e:
            self.error.emit(str(e))

class WorkerThread(QThread):
    progress_log = Signal(str)
    progress_value = Signal(int)
    finished = Signal()
    error = Signal(str)

    def __init__(self, youtube_url, config: AppConfig):
        super().__init__()
        self.youtube_url = youtube_url
        self.config = config

    def run(self):
        try:
            self.progress_value.emit(0)
            # 1. Download
            self.progress_log.emit("Downloading audio from YouTube...")
            audio_path, duration = download_audio(self.youtube_url, self.config.output_dir)
            self.progress_log.emit(f"Audio downloaded: {audio_path} (Duration: {duration:.2f}s)")
            self.progress_value.emit(10)

            # 2. Transcribe
            self.progress_log.emit(f"Transcribing with Whisper (model: {self.config.whisper_model}, device: {self.config.whisper_device})...")
            # Map "Auto detect" to None for Whisper
            lang = self.config.source_lang
            if lang.lower() == "auto detect" or lang.lower() == "auto":
                lang = None
            
            def on_transcribe_progress(progress_float):
                # Map transcription progress (0.0 to 1.0) to 10% -> 80%
                p = 10 + int(progress_float * 70)
                self.progress_value.emit(p)

            segments = transcribe_audio(
                audio_path, 
                self.config.whisper_model, 
                lang, 
                self.config.whisper_device,
                duration=duration,
                progress_callback=on_transcribe_progress
            )
            self.progress_log.emit(f"Transcription done. {len(segments)} segments found.")
            self.progress_value.emit(80)

            # 3. Save Original SRT
            video_id = os.path.splitext(os.path.basename(audio_path))[0]
            original_srt_path = os.path.join(self.config.output_dir, f"{video_id}_original.srt")
            write_srt(segments, original_srt_path, field="text")
            self.progress_log.emit(f"Saved original subtitles: {original_srt_path}")
            self.progress_value.emit(85)

            # 4. Translate (Optional)
            if self.config.enable_translation:
                if not self.config.gemini_api_key:
                    self.progress_log.emit("WARNING: Translation enabled but no API Key provided. Skipping.")
                else:
                    self.progress_log.emit(f"Translating to {self.config.target_lang} with Gemini...")
                    
                    def on_trans_progress(current, total):
                        # Map translation progress to 85% -> 95%
                        if total > 0:
                            p = 85 + int((current / total) * 10)
                            self.progress_value.emit(p)
                            
                    translate_segments_with_gemini(
                        segments, 
                        self.config.target_lang, 
                        self.config.gemini_api_key,
                        self.config.gemini_model,
                        progress_callback=on_trans_progress
                    )
                    
                    target_srt_path = os.path.join(self.config.output_dir, f"{video_id}_{self.config.target_lang}.srt")
                    write_srt(segments, target_srt_path, field="translated")
                    self.progress_log.emit(f"Saved translated subtitles: {target_srt_path}")

            self.progress_value.emit(100)
            self.progress_log.emit("All tasks completed successfully.")
            self.finished.emit()

        except Exception as e:
            self.error.emit(str(e))

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("YouTube Subtitle Maker")
        self.resize(600, 700)
        
        self.config = load_config()
        self.worker = None

        self.setup_ui()
        self.load_settings()

    def setup_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Use a horizontal layout to split Controls (Left) and History (Right)
        main_h_layout = QHBoxLayout(central_widget)
        
        # Left Panel (Controls)
        left_widget = QWidget()
        left_layout = QVBoxLayout(left_widget)
        left_layout.setContentsMargins(0, 0, 0, 0)

        # 1. YouTube URL
        url_group = QGroupBox("YouTube Video")
        url_layout = QHBoxLayout()
        self.url_input = QLineEdit()
        self.url_input.setPlaceholderText("Paste YouTube URL here...")
        self.paste_btn = QPushButton("Paste")
        self.paste_btn.clicked.connect(self.paste_from_clipboard)
        self.load_info_btn = QPushButton("Load Info")
        self.load_info_btn.clicked.connect(self.load_video_metadata)
        
        url_layout.addWidget(self.url_input)
        url_layout.addWidget(self.paste_btn)
        url_layout.addWidget(self.load_info_btn)
        url_layout.addWidget(self.load_info_btn)
        url_group.setLayout(url_layout)
        left_layout.addWidget(url_group)

        # Metadata Preview
        self.meta_group = QGroupBox("Video Preview")
        self.meta_group.setVisible(False)
        meta_layout = QHBoxLayout()
        
        self.thumb_label = QLabel()
        self.thumb_label.setFixedSize(160, 90)
        self.thumb_label.setStyleSheet("background-color: #000;")
        self.thumb_label.setAlignment(Qt.AlignCenter)
        
        self.title_label = QLabel("Video Title")
        self.title_label.setWordWrap(True)
        font = self.title_label.font()
        font.setBold(True)
        font.setPointSize(10)
        meta_layout.addWidget(self.thumb_label)
        
        # Title area
        title_layout = QVBoxLayout()
        self.title_label = QLabel("Video Title")
        self.title_label.setWordWrap(True)
        font = self.title_label.font()
        font.setBold(True)
        font.setPointSize(10)
        self.title_label.setFont(font)
        
        self.trans_title_label = QLabel("")
        self.trans_title_label.setWordWrap(True)
        self.trans_title_label.setStyleSheet("color: blue; font-style: italic;")
        
        self.trans_title_btn = QPushButton("Translate Title")
        self.trans_title_btn.clicked.connect(self.translate_title)
        self.trans_title_btn.setEnabled(False)
        
        title_layout.addWidget(self.title_label)
        title_layout.addWidget(self.trans_title_label)
        title_layout.addWidget(self.trans_title_btn)
        
        meta_layout.addLayout(title_layout)
        self.meta_group.setLayout(meta_layout)
        left_layout.addWidget(self.meta_group)

        # 2. Whisper Settings
        whisper_group = QGroupBox("Whisper Transcription")
        whisper_layout = QVBoxLayout()
        
        # Model
        h_layout1 = QHBoxLayout()
        h_layout1.addWidget(QLabel("Model Size:"))
        self.model_combo = QComboBox()
        self.model_combo.addItems(["turbo", "tiny", "base", "small", "medium", "large-v2", "large-v3"])
        h_layout1.addWidget(self.model_combo)
        
        h_layout1.addWidget(QLabel("Device:"))
        self.device_combo = QComboBox()
        self.device_combo.addItems(["Auto", "CPU", "GPU"])
        h_layout1.addWidget(self.device_combo)
        
        whisper_layout.addLayout(h_layout1)

        # Source Language
        h_layout2 = QHBoxLayout()
        h_layout2.addWidget(QLabel("Source Language:"))
        self.source_lang_combo = QComboBox()
        self.source_lang_combo.setEditable(True)
        self.source_lang_combo.addItems(["Auto detect", "en", "ja", "zh", "es", "fr", "de", "ko", "ru"])
        h_layout2.addWidget(self.source_lang_combo)
        whisper_layout.addLayout(h_layout2)
        
        whisper_group.setLayout(whisper_layout)
        left_layout.addWidget(whisper_group)

        # 3. Translation Settings
        trans_group = QGroupBox("Translation (Gemini)")
        trans_layout = QVBoxLayout()
        
        self.trans_check = QCheckBox("Enable translation with Gemini")
        self.trans_check.toggled.connect(self.toggle_translation_ui)
        trans_layout.addWidget(self.trans_check)

        # Target Lang
        h_layout3 = QHBoxLayout()
        h_layout3.addWidget(QLabel("Target Language:"))
        self.target_lang_combo = QComboBox()
        self.target_lang_combo.setEditable(True)
        self.target_lang_combo.addItems(["zh-CN", "en", "ja", "zh-TW", "es", "fr", "de", "ko"])
        h_layout3.addWidget(self.target_lang_combo)
        trans_layout.addLayout(h_layout3)

        # Gemini Model
        h_layout_model = QHBoxLayout()
        h_layout_model.addWidget(QLabel("Gemini Model:"))
        self.gemini_model_combo = QComboBox()
        self.gemini_model_combo.addItems(["gemini-2.5-flash-lite", "gemini-2.5-pro"])
        h_layout_model.addWidget(self.gemini_model_combo)
        trans_layout.addLayout(h_layout_model)

        # API Key
        h_layout4 = QHBoxLayout()
        h_layout4.addWidget(QLabel("Gemini API Key:"))
        self.api_key_input = QLineEdit()
        self.api_key_input.setEchoMode(QLineEdit.Password)
        self.show_key_btn = QPushButton("Show")
        self.show_key_btn.setCheckable(True)
        self.show_key_btn.toggled.connect(self.toggle_key_visibility)
        self.save_key_btn = QPushButton("Save Key") # Just saves config immediately
        self.save_key_btn.clicked.connect(self.save_current_config)
        
        self.test_key_btn = QPushButton("Test Key")
        self.test_key_btn.clicked.connect(self.test_api_key)
        self.key_status_label = QLabel("Not tested")
        self.key_status_label.setStyleSheet("color: gray;")
        
        h_layout4.addWidget(self.api_key_input)
        h_layout4.addWidget(self.show_key_btn)
        h_layout4.addWidget(self.save_key_btn)
        h_layout4.addWidget(self.test_key_btn)
        h_layout4.addWidget(self.key_status_label)
        trans_layout.addLayout(h_layout4)

        trans_group.setLayout(trans_layout)
        left_layout.addWidget(trans_group)

        # 4. Output Settings
        out_group = QGroupBox("Output")
        out_layout = QHBoxLayout()
        self.out_input = QLineEdit()
        self.browse_btn = QPushButton("Browse...")
        self.browse_btn.clicked.connect(self.browse_output_dir)
        out_layout.addWidget(self.out_input)
        out_layout.addWidget(self.browse_btn)
        out_layout.addWidget(self.browse_btn)
        out_group.setLayout(out_layout)
        left_layout.addWidget(out_group)

        # 5. External Tools (MPV)
        mpv_group = QGroupBox("External Tools (MPV)")
        mpv_layout = QHBoxLayout()
        self.mpv_input = QLineEdit()
        self.mpv_input.setPlaceholderText("Path to mpv.exe (Optional if in PATH)")
        self.browse_mpv_btn = QPushButton("Browse...")
        self.browse_mpv_btn.clicked.connect(self.browse_mpv_path)
        mpv_layout.addWidget(self.mpv_input)
        mpv_layout.addWidget(self.browse_mpv_btn)
        mpv_group.setLayout(mpv_layout)
        left_layout.addWidget(mpv_group)

        # 6. Controls
        btn_layout = QHBoxLayout()
        self.start_btn = QPushButton("Start Processing")
        self.start_btn.setFixedHeight(40)
        self.start_btn.clicked.connect(self.start_processing)
        self.stop_btn = QPushButton("Stop") # Difficult to stop thread safely, but we can try or just disable
        self.stop_btn.setEnabled(False)
        
        self.play_btn = QPushButton("Play with mpv")
        self.play_btn.clicked.connect(self.play_video)
        
        btn_layout.addWidget(self.start_btn)
        btn_layout.addWidget(self.stop_btn)
        btn_layout.addWidget(self.play_btn)
        left_layout.addLayout(btn_layout)

        # 6. Progress Bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        self.progress_bar.setTextVisible(True)
        left_layout.addWidget(self.progress_bar)

        # 7. Log
        self.log_area = QTextEdit()
        self.log_area.setReadOnly(True)
        left_layout.addWidget(self.log_area)
        
        # Right Panel (History)
        right_widget = QWidget()
        right_layout = QVBoxLayout(right_widget)
        right_layout.setContentsMargins(0, 0, 0, 0)
        
        right_layout.addWidget(QLabel("History"))
        self.history_list = QListWidget()
        self.history_list.itemDoubleClicked.connect(self.on_history_item_clicked)
        right_layout.addWidget(self.history_list)
        
        # Splitter
        splitter = QSplitter(Qt.Horizontal)
        splitter.addWidget(left_widget)
        splitter.addWidget(right_widget)
        splitter.setStretchFactor(0, 3)
        splitter.setStretchFactor(1, 1)
        
        main_h_layout.addWidget(splitter)

    def load_settings(self):
        self.out_input.setText(self.config.output_dir)
        
        idx = self.model_combo.findText(self.config.whisper_model)
        if idx >= 0: self.model_combo.setCurrentIndex(idx)
        
        idx_device = self.device_combo.findText(self.config.whisper_device, Qt.MatchFixedString)
        # Case insensitive match might be needed if config has lowercase "auto" but combo has "Auto"
        # Let's just try direct match first, then lower
        if idx_device == -1:
             # Try to match case insensitive
             for i in range(self.device_combo.count()):
                 if self.device_combo.itemText(i).lower() == self.config.whisper_device.lower():
                     idx_device = i
                     break
        if idx_device >= 0: self.device_combo.setCurrentIndex(idx_device)

        self.mpv_input.setText(self.config.mpv_path or "")

        self.source_lang_combo.setCurrentText(self.config.source_lang)
        
        self.trans_check.setChecked(self.config.enable_translation)
        self.target_lang_combo.setCurrentText(self.config.target_lang)
        
        idx_gemini = self.gemini_model_combo.findText(self.config.gemini_model)
        if idx_gemini >= 0: self.gemini_model_combo.setCurrentIndex(idx_gemini)

        if self.config.gemini_api_key:
            self.api_key_input.setText(self.config.gemini_api_key)
            
        self.toggle_translation_ui(self.config.enable_translation)
        
        self.load_history_to_ui()

    def load_history_to_ui(self):
        self.history_list.clear()
        # Reverse to show newest first
        for item in reversed(self.config.history):
            title = item.get("title_translated") or item.get("title_original") or item.get("url")
            if item.get("title_translated"):
                display_text = f"[{item.get('target_lang')}] {title}"
            else:
                display_text = f"[Original] {title}"
                
            list_item = QListWidgetItem(display_text)
            list_item.setData(Qt.UserRole, item)
            list_item.setToolTip(f"Original: {item.get('title_original')}\nTranslated: {item.get('title_translated')}\nURL: {item.get('url')}")
            self.history_list.addItem(list_item)

    def add_to_history(self, url, title_original, title_translated=None, target_lang=None):
        # Check if exists
        existing_index = -1
        for i, item in enumerate(self.config.history):
            if item.get("url") == url:
                existing_index = i
                break
        
        new_item = {
            "url": url,
            "title_original": title_original,
            "title_translated": title_translated,
            "target_lang": target_lang,
            "last_used": QDateTime.currentDateTime().toString(Qt.ISODate)
        }
        
        if existing_index >= 0:
            # Update existing
            # Preserve translated title if new one is None
            if title_translated is None and self.config.history[existing_index].get("title_translated"):
                 new_item["title_translated"] = self.config.history[existing_index].get("title_translated")
                 new_item["target_lang"] = self.config.history[existing_index].get("target_lang")
            
            self.config.history[existing_index] = new_item
            # Move to end (newest)
            item = self.config.history.pop(existing_index)
            self.config.history.append(item)
        else:
            self.config.history.append(new_item)
            
        # Limit size
        if len(self.config.history) > 50:
            self.config.history.pop(0)
            
        self.save_current_config()
        self.load_history_to_ui()

    def on_history_item_clicked(self, item):
        data = item.data(Qt.UserRole)
        if data:
            self.url_input.setText(data.get("url"))
            if data.get("target_lang"):
                self.target_lang_combo.setCurrentText(data.get("target_lang"))
            self.load_video_metadata() # Reload metadata to refresh UI
            
            # If we have a translated title, we might want to show it?
            # For now, load_video_metadata will fetch fresh metadata.
            # We could optimize to use stored metadata but fetching is safer for freshness.

    def save_current_config(self):
        self.config.output_dir = self.out_input.text()
        self.config.mpv_path = self.mpv_input.text()
        self.config.whisper_model = self.model_combo.currentText()
        self.config.whisper_device = self.device_combo.currentText()
        self.config.source_lang = self.source_lang_combo.currentText()
        self.config.enable_translation = self.trans_check.isChecked()
        self.config.target_lang = self.target_lang_combo.currentText()
        self.config.gemini_model = self.gemini_model_combo.currentText()
        self.config.gemini_api_key = self.api_key_input.text()
        
        save_config(self.config)
        # self.log("Configuration saved.") # Optional feedback

    def paste_from_clipboard(self):
        clipboard = QApplication.clipboard()
        text = clipboard.text()
        self.url_input.setText(text)
        if text.strip():
            self.load_video_metadata()

    def load_video_metadata(self):
        url = self.url_input.text().strip()
        if not url:
            return
            
        self.log("Fetching video metadata...")
        self.load_info_btn.setEnabled(False)
        
        self.meta_worker = MetadataWorker(url)
        self.meta_worker.finished.connect(self.on_metadata_loaded)
        self.meta_worker.error.connect(self.on_metadata_error)
        self.meta_worker.start()

    def on_metadata_loaded(self, metadata):
        self.load_info_btn.setEnabled(True)
        self.meta_group.setVisible(True)
        self.title_label.setText(metadata.get("title", "Unknown Title"))
        self.trans_title_label.setText("") # Clear previous
        
        # Enable translate button if translation is enabled
        self.trans_title_btn.setEnabled(self.trans_check.isChecked())
        
        thumb_url = metadata.get("thumbnail_url")
        if thumb_url:
            try:
                # Download image in main thread? No, better in thread but for simplicity here
                # we can use requests quickly. Or better, do it in the worker.
                # But we separated it. Let's just do a quick request here or spawn another thread?
                # Actually, blocking GUI for image download is bad.
                # Let's just do it here for now as it's usually fast, or use QNetworkAccessManager.
                # For simplicity with requests:
                data = requests.get(thumb_url).content
                pixmap = QPixmap()
                pixmap.loadFromData(data)
                self.thumb_label.setPixmap(pixmap.scaled(160, 90, Qt.KeepAspectRatio, Qt.SmoothTransformation))
            except Exception as e:
                self.log(f"Failed to load thumbnail: {e}")
                self.thumb_label.setText("No Image")
        else:
            self.thumb_label.setText("No Image")
            
        self.log("Metadata loaded.")

    def on_metadata_error(self, error_msg):
        self.load_info_btn.setEnabled(True)
        self.log(f"Metadata error: {error_msg}")
        # Don't show popup, just log
        self.meta_group.setVisible(False)

    def test_api_key(self):
        api_key = self.api_key_input.text().strip()
        if not api_key:
            QMessageBox.warning(self, "Input Error", "API Key is empty.")
            return
            
        self.test_key_btn.setEnabled(False)
        self.key_status_label.setText("Testing...")
        self.key_status_label.setStyleSheet("color: blue;")
        
        model = self.gemini_model_combo.currentText()
        self.api_test_worker = ApiTestWorker(api_key, model)
        self.api_test_worker.finished.connect(self.on_api_test_finished)
        self.api_test_worker.start()

    def on_api_test_finished(self, success, message):
        self.test_key_btn.setEnabled(True)
        if success:
            self.key_status_label.setText("Valid")
            self.key_status_label.setStyleSheet("color: green;")
            self.log("API Key test passed.")
            self.save_current_config() # Auto-save on success
        else:
            self.key_status_label.setText("Invalid")
            self.key_status_label.setStyleSheet("color: red;")
            self.log(f"API Key test failed: {message}")
            QMessageBox.warning(self, "API Key Test Failed", f"Error: {message}")

    def toggle_key_visibility(self, checked):
        if checked:
            self.api_key_input.setEchoMode(QLineEdit.Normal)
            self.show_key_btn.setText("Hide")
        else:
            self.api_key_input.setEchoMode(QLineEdit.Password)
            self.show_key_btn.setText("Show")

    def toggle_translation_ui(self, checked):
        self.target_lang_combo.setEnabled(checked)
        self.gemini_model_combo.setEnabled(checked)
        self.api_key_input.setEnabled(checked)
        self.show_key_btn.setEnabled(checked)
        self.save_key_btn.setEnabled(checked)
        self.test_key_btn.setEnabled(checked)
        if hasattr(self, 'trans_title_btn'):
            self.trans_title_btn.setEnabled(checked)

    def translate_title(self):
        title = self.title_label.text()
        if not title or title == "Video Title":
            return
            
        api_key = self.api_key_input.text().strip()
        if not api_key:
            QMessageBox.warning(self, "Input Error", "API Key required for translation.")
            return
            
        target_lang = self.target_lang_combo.currentText()
        model = self.gemini_model_combo.currentText()
        
        self.trans_title_btn.setEnabled(False)
        self.trans_title_label.setText("Translating...")
        
        self.title_worker = TitleTranslationWorker(title, target_lang, api_key, model)
        self.title_worker.finished.connect(self.on_title_translated)
        self.title_worker.error.connect(self.on_title_error)
        self.title_worker.start()

    def on_title_translated(self, translated_text):
        self.trans_title_btn.setEnabled(True)
        self.trans_title_label.setText(translated_text)
        
        # Update history
        url = self.url_input.text().strip()
        title = self.title_label.text()
        target_lang = self.target_lang_combo.currentText()
        self.add_to_history(url, title, translated_text, target_lang)

    def on_title_error(self, error_msg):
        self.trans_title_btn.setEnabled(True)
        self.trans_title_label.setText("Translation Failed")
        self.log(f"Title translation error: {error_msg}")

    def browse_output_dir(self):
        dir_path = QFileDialog.getExistingDirectory(self, "Select Output Directory", self.out_input.text())
        if dir_path:
            self.out_input.setText(dir_path)

    def browse_mpv_path(self):
        file_path, _ = QFileDialog.getOpenFileName(self, "Select mpv executable", "", "Executables (*.exe);;All Files (*)")
        if file_path:
            self.mpv_input.setText(file_path)

    def log(self, message):
        self.log_area.append(message)

    def start_processing(self):
        url = self.url_input.text().strip()
        if not url:
            QMessageBox.warning(self, "Input Error", "Please enter a YouTube URL.")
            return

        if self.trans_check.isChecked() and not self.api_key_input.text().strip():
            QMessageBox.warning(self, "Input Error", "Please enter a Gemini API Key for translation.")
            return

        # Save config before starting
        self.save_current_config()

        self.start_btn.setEnabled(False)
        self.stop_btn.setEnabled(True)
        self.log_area.clear()
        self.progress_bar.setValue(0)
        self.log("Starting...")

        self.worker = WorkerThread(url, self.config)
        self.worker.progress_log.connect(self.log)
        self.worker.progress_value.connect(self.progress_bar.setValue)
        self.worker.finished.connect(self.on_worker_finished)
        self.worker.error.connect(self.on_worker_error)
        self.worker.start()

    def on_worker_finished(self):
        self.log("Done!")
        self.progress_bar.setValue(100)
        self.start_btn.setEnabled(True)
        self.stop_btn.setEnabled(False)
        QMessageBox.information(self, "Success", "Subtitle generation completed successfully.")
        
        # Add to history
        url = self.url_input.text().strip()
        title = self.title_label.text()
        # We don't have the translated title here easily unless we store it or fetch it.
        # But we know if translation was enabled.
        # Ideally, we should update history with what we have.
        # If translation was enabled, we assume we generated subtitles.
        # We don't have the translated title string unless we translate it separately (Feature 3).
        # For now, just add original title. Feature 3 will handle translated title.
        
        target_lang = self.config.target_lang if self.config.enable_translation else None
        self.add_to_history(url, title, target_lang=target_lang)

    def on_worker_error(self, error_msg):
        self.log(f"ERROR: {error_msg}")
        self.progress_bar.setValue(0)
        self.start_btn.setEnabled(True)
        self.stop_btn.setEnabled(False)
        QMessageBox.critical(self, "Error", f"An error occurred:\n{error_msg}")

    def play_video(self):
        url = self.url_input.text().strip()
        if not url:
            QMessageBox.warning(self, "Input Error", "Please enter a YouTube URL first.")
            return

        # Determine video source and subtitle path
        # 1. Try to find local audio/video file? 
        # Actually, we download audio only (m4a). MPV can play audio with a placeholder image or just audio.
        # But if we want to watch the VIDEO, we should stream from URL unless we downloaded video.
        # Our downloader does 'format': 'ba[ext=m4a]/bestaudio', so we don't have video locally.
        # So we should prefer streaming from URL for video playback.
        
        video_source = url
        
        # Determine subtitle file
        # Check output dir for files matching video ID
        # We need video ID first.
        # We can't easily get video ID without yt-dlp, but we can try to guess from URL or check if we processed it.
        # Let's try to extract ID roughly or just look for files if we have metadata.
        
        # Better approach: Look at the output directory for files that *might* match.
        # Or just use the URL.
        
        # If the user just ran the process, we know the ID? 
        # We don't store it in self. But we can fetch metadata again or just try to find srt.
        
        # Let's try to find the best subtitle file in output_dir
        # We need the ID. Let's use a quick heuristic or just ask the user?
        # No, let's try to get ID from URL using simple regex or just rely on the fact that 
        # if we just processed it, the user might want to see it.
        
        # Actually, `fetch_video_metadata` gets the ID? No, it returns title/thumb.
        # Let's update `fetch_video_metadata` to return ID too? 
        # Or just use `yt-dlp` to get ID quickly if not cached.
        
        # For now, let's just try to play the URL. 
        # And if we can find a subtitle file that matches the ID (which we can extract).
        
        # Simple ID extraction for standard URLs
        import re
        video_id = None
        match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", url)
        if match:
            video_id = match.group(1)
            
        subtitle_path = None
        if video_id:
            # Check for translated first
            target_lang = self.target_lang_combo.currentText()
            trans_srt = os.path.join(self.config.output_dir, f"{video_id}_{target_lang}.srt")
            orig_srt = os.path.join(self.config.output_dir, f"{video_id}_original.srt")
            
            if os.path.exists(trans_srt):
                subtitle_path = trans_srt
            elif os.path.exists(orig_srt):
                subtitle_path = orig_srt
                
        try:
            self.log(f"Launching mpv with video: {video_source}")
            if subtitle_path:
                self.log(f"Using subtitle: {subtitle_path}")
            else:
                self.log("No matching subtitle file found in output directory. Playing without local subs.")
                
            play_with_mpv(video_source, subtitle_path, self.config.mpv_path)
        except Exception as e:
            QMessageBox.critical(self, "MPV Error", str(e))

    def closeEvent(self, event):
        self.save_current_config()
        event.accept()
