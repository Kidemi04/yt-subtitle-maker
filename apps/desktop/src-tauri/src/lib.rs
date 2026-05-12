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

/// Start the FastAPI backend on 127.0.0.1:8000 unless one is already running.
///
/// * `Ok(Some(child))` — we spawned it and own its lifecycle.
/// * `Ok(None)` — something is already listening on :8000 (e.g. a backend
///   started in its own terminal by `pnpm dev`'s split-window launcher, or a
///   leftover process); leave it alone.
/// * `Err(_)` — a real failure (e.g. the dev venv is missing).
///
/// Debug build  → `<repo>/backend/.venv/bin/python -m uvicorn api.main:app --reload`, cwd `<repo>/backend`.
/// Release build → the bundled PyInstaller binary under `Resources/backend-dist/`, cwd `~/.yt_subtitle_tool/`.
fn spawn_backend(app: &tauri::AppHandle) -> std::io::Result<Option<Child>> {
    // If someone is already serving :8000, attach to it rather than spawning a
    // duplicate that would just fail to bind the port.
    if let Ok(addr) = "127.0.0.1:8000".parse::<std::net::SocketAddr>() {
        if std::net::TcpStream::connect_timeout(&addr, std::time::Duration::from_millis(300)).is_ok()
        {
            eprintln!("[backend] already listening on 127.0.0.1:8000 — not spawning another");
            return Ok(None);
        }
    }

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
            .map(Some)
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
        Command::new(exe).current_dir(&workdir).spawn().map(Some)
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            match spawn_backend(app.handle()) {
                Ok(Some(child)) => {
                    *app.state::<BackendProcess>().0.lock().unwrap() = Some(BackendChild(child));
                }
                Ok(None) => { /* an external backend is already running — nothing to manage */ }
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
