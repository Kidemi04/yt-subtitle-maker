"""Retry policy shared by the translator providers.

Translating a one-hour video is hundreds of sequential API calls. Without
retries a single 429 or dropped connection anywhere in that sequence aborted
the whole run and discarded every batch already paid for, so a transient
blip cost the user real money and a long wait. These helpers make transient
failures survivable while still failing fast on the errors that retrying
cannot fix (bad key, missing model).
"""
from __future__ import annotations

import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")

MAX_ATTEMPTS = 4
BASE_DELAY_S = 1.5
MAX_DELAY_S = 20.0

# Substrings that mean "retrying will not help". Matched case-insensitively
# against both the exception type name and its message, because the two SDKs
# raise unrelated exception hierarchies (google.genai errors vs openai.*) and
# we do not want to import either one here.
_PERMANENT_HINTS = (
    "authenticationerror",
    "permissiondenied",
    "invalid_api_key",
    "invalid api key",
    "api key not valid",
    "api_key_invalid",
    "unauthorized",
    "notfounderror",
    "model_not_found",
    "does not exist",
    "unsupported",
)


def is_permanent(exc: BaseException) -> bool:
    """True when the error is a configuration problem, not a blip."""
    haystack = f"{type(exc).__name__} {exc}".lower()
    return any(hint in haystack for hint in _PERMANENT_HINTS)


def with_retries(
    call: Callable[[], T],
    *,
    label: str = "request",
    on_retry: Callable[[str], None] | None = None,
    max_attempts: int = MAX_ATTEMPTS,
) -> T:
    """Run `call`, retrying transient failures with exponential backoff.

    Args:
        call: the API call, invoked with no arguments.
        label: used in the human-readable retry notice.
        on_retry: receives one message per retry so the caller can surface it
            as a progress/warning event instead of the retry being invisible.
        max_attempts: total attempts including the first.

    Raises:
        The final exception, unchanged, once attempts run out — or immediately
        if `is_permanent` says retrying is pointless.
    """
    delay = BASE_DELAY_S
    for attempt in range(1, max_attempts + 1):
        try:
            return call()
        except Exception as e:
            if is_permanent(e) or attempt == max_attempts:
                raise
            if on_retry:
                on_retry(
                    f"{label} failed ({type(e).__name__}: {e}); "
                    f"retry {attempt}/{max_attempts - 1} in {delay:.1f}s"
                )
            time.sleep(delay)
            delay = min(delay * 2, MAX_DELAY_S)
    raise AssertionError("unreachable")  # pragma: no cover


def translated_count(segments) -> int:
    """How many segments already carry a translation.

    Lets the pipeline persist partial work after a failure instead of
    throwing away everything that did succeed.
    """
    return sum(1 for s in segments if getattr(s, "translated", None))
