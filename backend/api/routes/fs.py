"""POST /api/fs/check — validate a filesystem path for a settings field.

Used by the desktop ArmedField'd folder/executable settings to decide whether
to commit a typed value (or show the user the "Apply anyway" affordance).

Body: {"path": str, "kind": "dir" | "executable"}
Returns:
  kind="dir":         {exists: bool, isDir: bool, writable: bool}
  kind="executable":  {exists: bool, executable: bool}

`kind="executable"` accepts either an absolute path or a bare program name; bare
names are resolved through ``shutil.which`` (so "node" works on Windows too —
``which`` knows about PATHEXT).
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api", tags=["fs"])


class CheckFsRequest(BaseModel):
    path: str
    kind: Literal["dir", "executable"]


@router.post("/fs/check")
def check_fs(req: CheckFsRequest) -> dict:
    raw = (req.path or "").strip()
    if req.kind == "dir":
        if not raw:
            return {"exists": False, "isDir": False, "writable": False}
        p = Path(os.path.expanduser(raw))
        exists = p.exists()
        is_dir = exists and p.is_dir()
        # os.access on a missing path returns False, which is what we want.
        writable = is_dir and os.access(str(p), os.W_OK)
        return {"exists": exists, "isDir": is_dir, "writable": writable}

    # kind == "executable"
    if not raw:
        return {"exists": False, "executable": False}
    # Bare name? resolve via PATH.
    if os.sep not in raw and (os.altsep is None or os.altsep not in raw):
        resolved = shutil.which(raw)
        if resolved is None:
            return {"exists": False, "executable": False}
        p = Path(resolved)
    else:
        p = Path(os.path.expanduser(raw))
    exists = p.exists() and p.is_file()
    executable = exists and os.access(str(p), os.X_OK)
    return {"exists": exists, "executable": executable}
