// Sembunyikan jendela konsol di Windows pada build release.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::sync::Mutex;
use std::time::Duration;

use tauri::{Manager, RunEvent, State};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Port tempat backend FastAPI lokal mendengarkan. Harus konsisten dengan
/// NEXT_PUBLIC_API_URL yang dibakar ke frontend (lihat frontend/package.json).
const BACKEND_HOST: &str = "127.0.0.1";
const BACKEND_PORT: u16 = 8756;

/// Menyimpan handle proses backend agar bisa dimatikan saat app ditutup.
struct BackendProcess(Mutex<Option<CommandChild>>);

/// Tunggu sampai backend menerima koneksi TCP (siap melayani), maksimum ~30 dtk.
fn wait_for_backend() -> bool {
    let addr = format!("{BACKEND_HOST}:{BACKEND_PORT}");
    let target = match addr.parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    for _ in 0..150 {
        if TcpStream::connect_timeout(&target, Duration::from_millis(200)).is_ok() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(200));
    }
    false
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();

            // Jalankan backend sebagai sidecar dengan konfigurasi mode desktop.
            let sidecar = app
                .shell()
                .sidecar("quransrt-backend")
                .expect("binari sidecar 'quransrt-backend' tidak ditemukan")
                .env("QURANSRT_DESKTOP", "1")
                .env("QURANSRT_HOST", BACKEND_HOST)
                .env("QURANSRT_PORT", BACKEND_PORT.to_string());

            let (mut rx, child) = sidecar.spawn().expect("gagal menjalankan backend");

            // Simpan handle proses untuk dimatikan saat keluar.
            {
                let state: State<BackendProcess> = handle.state();
                *state.0.lock().unwrap() = Some(child);
            }

            // Teruskan log backend ke stdout/stderr untuk debugging.
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                            eprintln!("[backend] {}", String::from_utf8_lossy(&line));
                        }
                        _ => {}
                    }
                }
            });

            // Tunggu backend siap di thread terpisah, lalu tampilkan jendela.
            let show_handle = app.handle().clone();
            std::thread::spawn(move || {
                wait_for_backend();
                if let Some(window) = show_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("gagal membangun aplikasi Tauri")
        .run(|app_handle, event| {
            // Pastikan backend dimatikan saat aplikasi keluar.
            if let RunEvent::Exit = event {
                let state: State<BackendProcess> = app_handle.state();
                if let Some(child) = state.0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
