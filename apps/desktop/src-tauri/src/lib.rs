use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{Manager, RunEvent};

/// Wraps the backend child so it's killed if this is dropped (panic / unwind),
/// in addition to the explicit kill on `RunEvent::Exit`.
struct BackendChild(Child);

impl Drop for BackendChild {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

/// Holds the spawned Python backend so it can be killed when the app exits.
struct BackendProcess(Mutex<Option<BackendChild>>);

/// Spawn the FastAPI backend on 127.0.0.1:8000.
///
/// Debug build  → `<repo>/backend/.venv/bin/python -m uvicorn api.main:app --reload`, cwd `<repo>/backend`.
/// Release build → the bundled PyInstaller binary under `Resources/backend-dist/`, cwd `~/.yt_subtitle_tool/`.
fn spawn_backend(app: &tauri::AppHandle) -> std::io::Result<Child> {
    #[cfg(debug_assertions)]
    {
        // CARGO_MANIFEST_DIR is `<repo>/apps/desktop/src-tauri`, baked in at compile time.
        let repo_root = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("..");
        let backend_dir = repo_root.join("backend");
        let python = backend_dir.join(".venv").join("bin").join("python");
        if !python.exists() {
            eprintln!(
                "[backend] {} not found — run `scripts/setup-backend.sh` first. \
                 Starting the app without a backend.",
                python.display()
            );
            return Err(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                "backend venv missing",
            ));
        }
        let _ = app;
        eprintln!("[backend] starting (dev): {} -m uvicorn …", python.display());
        Command::new(python)
            .args([
                "-m", "uvicorn", "api.main:app",
                "--host", "127.0.0.1", "--port", "8000", "--reload",
            ])
            .current_dir(&backend_dir)
            .spawn()
    }

    #[cfg(not(debug_assertions))]
    {
        let resource_dir = app.path().resource_dir().map_err(|e| {
            std::io::Error::new(std::io::ErrorKind::NotFound, e.to_string())
        })?;
        let exe = resource_dir.join("backend-dist").join("yt-subtitle-backend");
        // Run with cwd at a user-writable location, NOT inside the .app bundle —
        // the backend writes output/ and downloads/ relative to its cwd, and the
        // bundle is read-only when installed under /Applications. Use the same
        // directory the backend already stores config.json in (see backend/core/config.py).
        let workdir = app
            .path()
            .home_dir()
            .map(|h| h.join(".yt_subtitle_tool"))
            .unwrap_or_else(|_| std::env::temp_dir());
        let _ = std::fs::create_dir_all(&workdir);
        eprintln!(
            "[backend] starting (release): {} (cwd {})",
            exe.display(),
            workdir.display()
        );
        Command::new(exe).current_dir(&workdir).spawn()
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            match spawn_backend(app.handle()) {
                Ok(child) => {
                    *app.state::<BackendProcess>().0.lock().unwrap() = Some(BackendChild(child));
                }
                Err(e) => eprintln!("[backend] failed to start: {e}"),
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                // Take the guard out and drop it — `BackendChild::drop` kills + waits.
                // Keep this explicit path; don't rely on Drop alone.
                if let Some(mut child) =
                    app_handle.state::<BackendProcess>().0.lock().unwrap().take()
                {
                    let _ = child.0.kill();
                    let _ = child.0.wait();
                }
            }
        });
}
