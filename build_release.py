import os
import subprocess
import shutil
import sys
import argparse
import platform

def run_command(command, cwd=None, env=None):
    print(f"Running: {command}")
    try:
        subprocess.check_call(command, shell=True, cwd=cwd, env=env)
    except subprocess.CalledProcessError as e:
        print(f"Error running command: {e}")
        sys.exit(1)

def check_tool(tool_name):
    if not shutil.which(tool_name):
        print(f"Error: '{tool_name}' not found in PATH. Please install it.")
        sys.exit(1)

def main():
    parser = argparse.ArgumentParser(description="Build release package for YouTube Subtitle Maker")
    parser.add_argument("--mode", choices=["gpu", "cpu"], default="gpu", help="Build mode (gpu includes CUDA, cpu excludes it)")
    args = parser.parse_args()

    print(f"--- Starting Build (Mode: {args.mode.upper()}) ---")

    # 1. Checks
    check_tool("flutter")
    check_tool("pyinstaller")
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    flutter_dir = os.path.join(base_dir, "flutter_gui")
    release_dir = os.path.join(base_dir, "release")
    
    # Clean previous release
    if os.path.exists(release_dir):
        print("Cleaning previous release...")
        shutil.rmtree(release_dir)
    os.makedirs(release_dir)

    # 2. Build Flutter
    print("\n--- Building Flutter Frontend ---")
    run_command("flutter build windows", cwd=flutter_dir)
    
    flutter_build_output = os.path.join(flutter_dir, "build", "windows", "x64", "runner", "Release")
    if not os.path.exists(flutter_build_output):
        # Fallback for older flutter versions or 32-bit
        flutter_build_output = os.path.join(flutter_dir, "build", "windows", "runner", "Release")
        
    if not os.path.exists(flutter_build_output):
        print(f"Error: Flutter build output not found at {flutter_build_output}!")
        sys.exit(1)

    # 3. Build Python Backend
    print("\n--- Building Python Backend ---")
    
    # Construct PyInstaller command
    pyinstaller_cmd = [
        "pyinstaller",
        "--noconfirm",
        "--onedir",
        "--clean",
        "--name", "backend_api",
        "--distpath", os.path.join(base_dir, "dist"),
        "--workpath", os.path.join(base_dir, "build"),
        "--specpath", base_dir,
        # Hidden imports often needed for these libraries
        "--hidden-import", "uvicorn",
        "--hidden-import", "fastapi",
        "--hidden-import", "engineio.async_drivers.threading", # Common issue with python-socketio/fastapi
        # Core modules
        "--add-data", f"core{os.pathsep}core", 
        "backend_api.py"
    ]

    if args.mode == "cpu":
        print("Configuring for CPU mode (excluding heavy GPU libraries)...")
        # Exclude NVIDIA and Torch CUDA libs
        excludes = [
            "nvidia",
            "torch.cuda",
            "torch.backends.cuda",
            "torch.backends.cudnn"
        ]
        for exc in excludes:
            pyinstaller_cmd.extend(["--exclude-module", exc])

    run_command(" ".join(pyinstaller_cmd), cwd=base_dir)

    # 4. Assemble
    print("\n--- Assembling Release ---")
    
    # Copy Flutter files
    print("Copying Flutter files...")
    shutil.copytree(flutter_build_output, os.path.join(release_dir, "frontend"))
    
    # Copy Backend files
    print("Copying Backend files...")
    backend_dist = os.path.join(base_dir, "dist", "backend_api")
    shutil.copytree(backend_dist, os.path.join(release_dir, "backend"))

    # Copy external tools (ffmpeg, mpv) if they exist in the root or specific paths
    # We check the current directory or PATH
    tools_to_copy = ["ffmpeg.exe", "mpv.exe"]
    for tool in tools_to_copy:
        tool_path = shutil.which(tool)
        if tool_path:
            print(f"Found {tool} at {tool_path}, copying...")
            shutil.copy(tool_path, release_dir)
        else:
            print(f"Warning: {tool} not found. User will need to install it or put it in the folder.")

    # 5. Create Launcher
    print("Creating launcher script...")
    launcher_content = """@echo off
echo Starting YouTube Subtitle Maker...
echo Starting Backend Server...
start /B "" "backend\\backend_api.exe"
timeout /t 2 /nobreak >nul
echo Starting Frontend...
start "" "frontend\\yt_subtitle_maker_gui.exe"
"""
    with open(os.path.join(release_dir, "start_app.bat"), "w") as f:
        f.write(launcher_content)

    print(f"\n--- Build Complete! ---")
    print(f"Release is available at: {release_dir}")
    print(f"Size: {get_size(release_dir) / (1024*1024):.2f} MB")

def get_size(start_path):
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(start_path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            # skip if it is symbolic link
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size

if __name__ == "__main__":
    main()
