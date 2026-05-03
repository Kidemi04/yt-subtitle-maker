"""Google Gemini translator."""
from __future__ import annotations

import json
from typing import Callable

from google import genai

from core.stt.base import TranscriptionSegment

KNOWN_MODELS = [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-flash",
]

BATCH_SIZE = 50  # segments per Gemini call


class GeminiTranslator:
    name = "gemini"

    def __init__(self, api_key: str, model: str = "gemini-2.5-flash-lite"):
        self.api_key = api_key
        self.model = model
        self._client = genai.Client(api_key=api_key) if api_key else None

    def is_available(self) -> bool:
        if not self.api_key:
            return False
        try:
            list(self._client.models.list())
            return True
        except Exception:
            return False

    def list_models(self) -> list[str]:
        return KNOWN_MODELS

    def translate_segments(
        self,
        segments: list[TranscriptionSegment],
        target_lang: str,
        progress: Callable[[float], None] | None = None,
    ) -> None:
        if not self.api_key:
            raise ValueError("api_key required for Gemini translation")

        total = len(segments)
        if total == 0:
            return

        for batch_start in range(0, total, BATCH_SIZE):
            batch = segments[batch_start : batch_start + BATCH_SIZE]
            self._translate_batch(batch, target_lang)
            if progress:
                progress(min(1.0, (batch_start + len(batch)) / total))

    def _translate_batch(
        self, batch: list[TranscriptionSegment], target_lang: str
    ) -> None:
        numbered = "\n".join(f"[{i+1}] {seg.text}" for i, seg in enumerate(batch))
        prompt = (
            f"Translate each numbered subtitle line to {target_lang}.\n"
            f"Output ONLY a JSON array of strings, in the same order.\n"
            f"Preserve sentence boundaries; do NOT merge or split lines.\n\n"
            f"{numbered}"
        )
        resp = self._client.models.generate_content(
            model=self.model,
            contents=prompt,
        )
        text = resp.text.strip()
        # Strip optional code fences
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        translations = json.loads(text)
        if len(translations) != len(batch):
            raise RuntimeError(
                f"Gemini returned {len(translations)} translations for {len(batch)} segments"
            )
        for seg, t in zip(batch, translations):
            seg.translated = t

    def translate_title(self, title: str, target_lang: str) -> str:
        if not self.api_key:
            raise ValueError("api_key required for Gemini translation")
        resp = self._client.models.generate_content(
            model=self.model,
            contents=(
                f"Translate this YouTube video title to {target_lang}. "
                f"Output ONLY the translation, no quotes, no explanation:\n{title}"
            ),
        )
        return resp.text.strip().strip('"').strip("'")
