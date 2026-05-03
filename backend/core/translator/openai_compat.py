"""OpenAI-compatible translator.

Single implementation that talks to any /v1/chat/completions endpoint:
- LM Studio  (default base_url http://127.0.0.1:1234/v1)
- Ollama     (base_url http://127.0.0.1:11434/v1)
- OpenAI     (base_url https://api.openai.com/v1)
- Groq       (base_url https://api.groq.com/openai/v1)
- Together   (base_url https://api.together.xyz/v1)
"""
from __future__ import annotations

import json
from collections.abc import Callable

from openai import OpenAI

from core.stt.base import TranscriptionSegment

BATCH_SIZE = 30  # smaller than Gemini because local LLMs have shorter contexts


class OpenAICompatTranslator:
    name = "openai_compat"

    def __init__(
        self,
        base_url: str,
        model: str,
        api_key: str | None = None,
    ):
        # LM Studio / Ollama accept any non-empty string. We pass 'lm-studio' as a
        # safe default so curl-style debugging shows the same auth path.
        self.api_key = api_key or "lm-studio"
        self.base_url = base_url
        self.model = model
        self._client = OpenAI(base_url=base_url, api_key=self.api_key)

    def is_available(self) -> bool:
        try:
            self._client.models.list()
            return True
        except Exception:
            return False

    def list_models(self) -> list[str]:
        try:
            resp = self._client.models.list()
            return [m.id for m in resp.data]
        except Exception:
            return []

    def translate_segments(
        self,
        segments: list[TranscriptionSegment],
        target_lang: str,
        progress: Callable[[float], None] | None = None,
    ) -> None:
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
        system = (
            f"You are a subtitle translator. Translate each numbered line into "
            f"{target_lang}. Output ONLY a JSON array of strings, one per input "
            f"line, in the same order. Do not merge or split lines."
        )
        resp = self._client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": numbered},
            ],
            temperature=0.2,
        )
        text = resp.choices[0].message.content.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        translations = json.loads(text)
        if len(translations) != len(batch):
            raise RuntimeError(
                f"Translator returned {len(translations)} for {len(batch)} segments"
            )
        for seg, t in zip(batch, translations, strict=True):
            seg.translated = t

    def translate_title(self, title: str, target_lang: str) -> str:
        resp = self._client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "user",
                    "content": (
                        f"Translate this YouTube video title to {target_lang}. "
                        f"Output ONLY the translation:\n{title}"
                    ),
                }
            ],
            temperature=0.3,
        )
        return resp.choices[0].message.content.strip().strip('"').strip("'")
