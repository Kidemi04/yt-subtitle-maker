# Distribution Guide

**Question:** Do other users need to install the Flutter SDK?
**Answer:** **NO.**

End users only need the **compiled application**. You (the developer) use the SDK to build this package.

## Overview

To give this app to someone else, you need to bundle two things:
1.  **The Frontend**: The compiled Flutter application (`.exe`).
2.  **The Backend**: The Python API server.

You have two options for the backend:
*   **Option A (Easy)**: User installs Python, and you give them a script to start it.
*   **Option B (Professional)**: You compile the Python backend into an `.exe` so the user needs **nothing** installed.

---

## Step 1: Build the Flutter Frontend

(You need the Flutter SDK installed for this step)

1.  Open your terminal in `flutter_gui`.
2.  Run the build command:
    ```bash
    flutter build windows
    ```
3.  The output will be in:
    `flutter_gui\build\windows\runner\Release\`
    
    This folder contains `yt_subtitle_maker_gui.exe` and necessary `.dll` files.

## Step 2: Build the Python Backend (Option B)

We will use `PyInstaller` to turn your Python script into a standalone `.exe`.

1.  Install PyInstaller:
    ```bash
    pip install pyinstaller
    ```

2.  Build the executable:
    ```bash
    pyinstaller --onefile --name backend_api backend_api.py
    ```
    *(Note: You might need to add `--hidden-import` flags if some libraries aren't found automatically, e.g., `uvicorn`, `fastapi`).*

3.  The output will be in `dist\backend_api.exe`.

## Step 3: Bundle It Together

1.  Create a new folder, e.g., `MySubtitleApp`.
2.  Copy the **contents** of the Flutter `Release` folder into `MySubtitleApp`.
3.  Copy `dist\backend_api.exe` into `MySubtitleApp`.
4.  (Optional) Create a simple batch script `start_app.bat` to launch both:
    ```bat
    @echo off
    start backend_api.exe
    start yt_subtitle_maker_gui.exe
    ```

Now you can zip up `MySubtitleApp` and send it to anyone! They just unzip and run `start_app.bat`.
