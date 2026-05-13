# PyInstaller spec for the yt-subtitle-maker backend (one-dir bundle).
#
# Built by `pnpm -F desktop build:backend`, which runs roughly:
#   pyinstaller --noconfirm --distpath <apps/desktop/src-tauri> --workpath <…/.pyinstaller-work> backend/packaging/backend.spec
# Produces  <distpath>/backend-dist/  with executable  <distpath>/backend-dist/yt-subtitle-backend
import os

from PyInstaller.utils.hooks import collect_all, collect_submodules

# SPECPATH is the directory containing this spec file (backend/packaging/), injected by PyInstaller.
BACKEND_ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))   # the backend/ dir
ENTRY = os.path.join(BACKEND_ROOT, "packaging", "run_backend.py")

datas, binaries, hiddenimports = [
    (os.path.join(BACKEND_ROOT, "packaging", "test_clip.mp4"), "packaging"),
], [], []
for pkg in ("whisper", "torch", "yt_dlp", "uvicorn", "openai", "google", "google.genai"):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

hiddenimports += collect_submodules("uvicorn")
hiddenimports += [
    "api.main",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    "uvicorn.loops.auto",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.logging",
]

a = Analysis(
    [ENTRY],
    pathex=[BACKEND_ROOT],     # so `import api` / `import core` resolve
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["tkinter"],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="yt-subtitle-backend",
    console=True,
)
coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    name="backend-dist",
)
