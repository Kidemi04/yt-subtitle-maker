"""Shared cancel-slot for streaming jobs (process / library transcribe /
library translate). One in-flight job at a time — and that limit is now
*enforced*, not merely documented.

All three NDJSON endpoints route through `claim_slot` / `release_slot` so
that POST /api/process/cancel signals whichever job is currently active.

`claim_slot` used to overwrite the occupant unconditionally, so a
double-clicked Generate button started a second Whisper transcription that
raced the first for CPU/GPU and for the same output folder, while the first
became impossible to cancel. It now raises `JobBusy` instead.
"""
from __future__ import annotations

import threading
from typing import Any

_slot: dict[str, threading.Event | None] = {"event": None}
_lock = threading.Lock()


class JobBusy(RuntimeError):
    """Raised by `claim_slot` when another job already holds the slot."""


def claim_slot() -> threading.Event:
    """Register a fresh cancel event for this job, or refuse if one is running.

    Raises:
        JobBusy: another job holds the slot. Callers should surface this as a
            409, not queue behind it — transcription is CPU/GPU bound and two
            at once is slower than two in sequence.
    """
    evt = threading.Event()
    with _lock:
        if _slot["event"] is not None:
            raise JobBusy(
                "Another transcription/translation job is already running. "
                "Wait for it to finish or cancel it first."
            )
        _slot["event"] = evt
    return evt


def force_claim_slot() -> threading.Event:
    """Take the slot even if occupied. Escape hatch for a wedged slot."""
    evt = threading.Event()
    with _lock:
        _slot["event"] = evt
    return evt


def is_busy() -> bool:
    with _lock:
        return _slot["event"] is not None


def release_slot(evt: threading.Event) -> None:
    """Clear the slot iff we still own it.

    Guards against a newer job already having taken the slot during this
    job's run; only the current occupant clears.
    """
    with _lock:
        if _slot["event"] is evt:
            _slot["event"] = None


def cancel_active() -> dict[str, Any]:
    """Set cancel on the active job. Returns the response dict for the
    cancel route handler — callers don't need to wrap it.
    """
    with _lock:
        evt = _slot.get("event")
    if evt is None:
        return {"ok": False, "error": "no active job"}
    evt.set()
    return {"ok": True}


def active_event() -> threading.Event | None:
    """Read-only accessor for tests / introspection."""
    with _lock:
        return _slot.get("event")
