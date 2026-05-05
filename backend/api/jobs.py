"""Shared cancel-slot for streaming jobs (process / library transcribe /
library translate). V1 supports one in-flight job at a time; a newer job
takes the slot, leaving the older job effectively orphaned for cancel
purposes (its thread will still finish naturally).

All three NDJSON endpoints route through `claim_slot` / `release_slot` so
that POST /api/process/cancel signals whichever job is currently active.
"""
from __future__ import annotations

import threading
from typing import Any

_slot: dict[str, threading.Event | None] = {"event": None}
_lock = threading.Lock()


def claim_slot() -> threading.Event:
    """Create + register a fresh cancel event for the in-flight job.

    Replaces any existing slot occupant; that job's thread can no longer be
    cancelled via cancel_active() but will run to completion on its own.
    """
    evt = threading.Event()
    with _lock:
        _slot["event"] = evt
    return evt


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
