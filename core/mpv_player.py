import subprocess
import shutil
import os
from typing import Optional

def play_with_mpv(
    video: str,
    subtitle_path: Optional[str] = None,
    mpv_executable: Optional[str] = None,
) -> None:
    """
    Launch mpv as an external process.
    ...
    """
    executable = "mpv"
    if mpv_executable and shutil.which(mpv_executable):
        executable = mpv_executable
    elif not shutil.which("mpv"):
        # Try common Windows paths if not in PATH
        common_paths = [
            r"C:\mpv\mpv.exe",
            r"C:\Program Files\mpv\mpv.exe",
            os.path.expanduser(r"~\mpv\mpv.exe"),
            os.path.expanduser(r"~\AppData\Local\mpv\mpv.exe")
        ]
        found = False
        for p in common_paths:
            if os.path.exists(p):
                executable = p
                found = True
                break
        
        if not found:
            raise FileNotFoundError("mpv executable not found. Please install mpv and add it to PATH, or specify the path in settings.")

    cmd = [executable, video]
    
    if subtitle_path:
        cmd.append(f"--sub-file={subtitle_path}")
        
    try:
        subprocess.Popen(cmd)
    except Exception as e:
        raise Exception(f"Failed to launch mpv: {str(e)}")
