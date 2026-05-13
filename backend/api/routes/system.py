"""GET /api/system — OS / arch / GPU report for machine-compat verdicts."""
from __future__ import annotations

from fastapi import APIRouter

from core.system_info import get_system_report

router = APIRouter(prefix="/api", tags=["system"])


@router.get("/system")
def get_system() -> dict:
    """Return OS, architecture, and GPU information.

    Supersedes the ``cudaAvailable`` field on ``/api/version`` for new consumers.
    ``/api/version``'s ``cudaAvailable`` is left unchanged for backward compatibility.
    """
    return get_system_report()
