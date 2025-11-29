import json
import os
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Optional

CONFIG_DIR_NAME = ".yt_subtitle_tool"
CONFIG_FILE_NAME = "config.json"

@dataclass
class AppConfig:
    output_dir: str = "./output"
    whisper_model: str = "turbo"
    whisper_device: str = "auto"
    mpv_path: str = "" # Optional manual path
    source_lang: str = "auto"
    target_lang: str = "zh-CN"
    gemini_api_key: Optional[str] = None
    gemini_model: str = "gemini-2.5-flash-lite"
    enable_translation: bool = False
    history: list = None  # List[Dict]

    def __post_init__(self):
        if self.history is None:
            self.history = []

def get_config_path() -> Path:
    """Return the config.json path in the user's home directory."""
    home = Path.home()
    config_dir = home / CONFIG_DIR_NAME
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir / CONFIG_FILE_NAME

def load_config() -> AppConfig:
    """Load config.json if it exists, else return defaults."""
    config_path = get_config_path()
    if not config_path.exists():
        return AppConfig()

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        # Filter out keys that might not be in the dataclass anymore
        # (forward compatibility)
        valid_keys = AppConfig.__annotations__.keys()
        filtered_data = {k: v for k, v in data.items() if k in valid_keys}
        return AppConfig(**filtered_data)
    except Exception as e:
        print(f"Error loading config: {e}")
        return AppConfig()

def save_config(cfg: AppConfig) -> None:
    """Write config.json to disk."""
    config_path = get_config_path()
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(asdict(cfg), f, indent=2)
    except Exception as e:
        print(f"Error saving config: {e}")
