"""System info helper — OS / arch / GPU report.

get_system_report() is the single public API. It never raises; on any
error the gpu block falls back to vendor="none".
"""
from __future__ import annotations

import json
import platform
import subprocess


def _gpu_name_macos() -> str | None:
    """Best-effort GPU name on macOS via system_profiler (JSON output)."""
    try:
        result = subprocess.run(
            ["system_profiler", "SPDisplaysDataType", "-json"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        data = json.loads(result.stdout)
        displays = data.get("SPDisplaysDataType", [])
        if displays:
            return displays[0].get("sppci_model") or displays[0].get("_name")
    except Exception:
        pass
    return None


def _gpu_info() -> dict:
    """Return gpu sub-dict. Never raises — returns vendor='none' on failure."""
    try:
        import torch  # noqa: PLC0415 — deferred so tests without torch still pass

        cuda_ok = torch.cuda.is_available()
        mps_ok = torch.backends.mps.is_available()

        if cuda_ok:
            try:
                name: str | None = torch.cuda.get_device_name(0)
            except Exception:
                name = None
            # Detect vendor from device name string
            vendor = "none"
            if name:
                n = name.lower()
                if "nvidia" in n or "geforce" in n or "quadro" in n or "tesla" in n:
                    vendor = "nvidia"
                elif "amd" in n or "radeon" in n:
                    vendor = "amd"
                elif "intel" in n:
                    vendor = "intel"
            return {
                "vendor": vendor,
                "name": name,
                "cudaAvailable": True,
                "mpsAvailable": False,
            }

        if mps_ok:
            name = _gpu_name_macos()
            return {
                "vendor": "apple",
                "name": name,
                "cudaAvailable": False,
                "mpsAvailable": True,
            }

        # macOS arm64 without MPS available (unusual) — still likely Apple GPU
        sys = platform.system()
        mach = platform.machine().lower()
        if sys == "Darwin" and mach == "arm64":
            name = _gpu_name_macos()
            return {
                "vendor": "apple",
                "name": name,
                "cudaAvailable": False,
                "mpsAvailable": False,
            }

        return {"vendor": "none", "name": None, "cudaAvailable": False, "mpsAvailable": False}
    except Exception:
        return {"vendor": "none", "name": None, "cudaAvailable": False, "mpsAvailable": False}


def get_system_report() -> dict:
    """Return OS / arch / GPU information. Never raises."""
    sys = platform.system()
    os_name = {"Darwin": "macos", "Windows": "windows", "Linux": "linux"}.get(sys, "linux")

    raw_arch = platform.machine()
    arch = "arm64" if raw_arch.lower() in {"arm64", "aarch64"} else "x86_64"

    try:
        gpu = _gpu_info()
    except Exception:
        gpu = {"vendor": "none", "name": None, "cudaAvailable": False, "mpsAvailable": False}

    return {"os": os_name, "arch": arch, "gpu": gpu}
