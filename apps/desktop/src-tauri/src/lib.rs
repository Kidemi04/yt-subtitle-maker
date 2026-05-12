use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{Manager, RunEvent};

/// Holds the spawned Python backend so it can be killed when the app exits.
struct BackendProcess(Mutex<Option<Child>>);

/// Spawn the FastAPI backend on 127.0.0.1:8000.
///
/// Debug build  → `<repo>/backend/.venv/bin/python -m uvicorn api.main:app --reload`, cwd `<repo>/backend`.
/// Release build → the bundled PyInstaller binary under `Resources/backend-dist/` (wired in a later task).
#[allow(unused_variables)]
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
        let bin_dir = resource_dir.join("backend-dist");
        let exe = bin_dir.join("yt-subtitle-backend");
        eprintln!("[backend] starting (release): {}", exe.display());
        Command::new(exe).current_dir(&bin_dir).spawn()
    }
}

pub fn run() {
    tauri::Builder::default()
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            match spawn_backend(app.handle()) {
                Ok(child) => {
                    *app.state::<BackendProcess>().0.lock().unwrap() = Some(child);
                }
                Err(e) => eprintln!("[backend] failed to start: {e}"),
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(mut child) =
                    app_handle.state::<BackendProcess>().0.lock().unwrap().take()
                {
                    let _ = child.kill();
                    let _ = child.wait();
                }
            }
        });
}
