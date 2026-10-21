//! Presenter overlay: a transparent, always-on-top window that covers the
//! primary monitor. It is click-through unless it is "interactive", which
//! happens when either
//!   * the lock toggle is on (app starts this way), or
//!   * the hold chord (Ctrl+Shift) is physically held (polled globally).
//!
//! Rust owns the mode state and is the single place that flips the OS-level
//! click-through flag; the frontend just renders whatever `overlay-mode` says.
//! Action hotkeys (Ctrl+Shift+Q/R/X) are registered with the OS and forwarded
//! to the frontend as `hotkey` events.

use std::sync::Mutex;
use std::time::Duration;

use serde::Serialize;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, State, WebviewWindow};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Human label for the hold chord, shown in the UI. Keep in sync with `hold_chord_held`.
const HOLD_LABEL: &str = "Ctrl+Shift";

/// Action hotkeys: Ctrl+Shift + key -> action name sent to the frontend.
const HOTKEYS: [(Code, &str, &str); 8] = [
    (Code::KeyQ, "Q", "qr"),     // toggle full-screen QR
    (Code::KeyR, "R", "rotate"), // new room code (kicks current phones)
    (Code::KeyX, "X", "kill"),   // disconnect every phone
    (Code::KeyS, "S", "stream"), // stream mode: bigger audience-facing elements
    (Code::KeyH, "H", "hide"),   // hide / show every widget (the pill stays)
    (Code::KeyL, "L", "lock"),   // toggle the lock (interactive without the chord)
    (Code::KeyD, "D", "dev"),    // devtools panel (free spell casts, shortcuts)
    (Code::KeyE, "E", "end"),    // the ending: full-screen QR that sends everyone to Mystica
];

struct OverlayState {
    /// Lock toggle: interactive without needing the hold chord.
    locked: bool,
    /// Hold chord is currently held down.
    hold: bool,
}

#[derive(Clone, Serialize)]
struct ModePayload {
    locked: bool,
    hold: bool,
    interactive: bool,
    hotkey: &'static str,
}

fn payload(s: &OverlayState) -> ModePayload {
    ModePayload {
        locked: s.locked,
        hold: s.hold,
        interactive: s.locked || s.hold,
        hotkey: HOLD_LABEL,
    }
}

/// Push the current mode to the OS window (click-through or not) and to the UI.
fn apply_mode(app: &AppHandle) {
    let p = {
        let state = app.state::<Mutex<OverlayState>>();
        let s = state.lock().unwrap();
        payload(&s)
    };
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_ignore_cursor_events(!p.interactive);
    }
    let _ = app.emit("overlay-mode", p);
}

fn set_locked_inner(app: &AppHandle, locked: bool) {
    app.state::<Mutex<OverlayState>>().lock().unwrap().locked = locked;
    apply_mode(app);
}

#[tauri::command]
fn set_locked(app: AppHandle, locked: bool) {
    set_locked_inner(&app, locked);
}

#[tauri::command]
fn get_mode(state: State<'_, Mutex<OverlayState>>) -> ModePayload {
    payload(&state.lock().unwrap())
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

#[cfg(windows)]
fn hold_chord_held() -> bool {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_CONTROL, VK_SHIFT};
    // High bit set => key is currently down. Reads the physical keyboard state,
    // independent of which window has focus.
    let down = |vk: u16| unsafe { (GetAsyncKeyState(vk as i32) as u16) & 0x8000 != 0 };
    down(VK_CONTROL) && down(VK_SHIFT)
}

#[cfg(not(windows))]
fn hold_chord_held() -> bool {
    false
}

/// Physical mouse position in screen pixels, whichever window is under it.
#[cfg(windows)]
fn cursor_pos() -> Option<(i32, i32)> {
    use windows_sys::Win32::Foundation::POINT;
    use windows_sys::Win32::UI::WindowsAndMessaging::GetCursorPos;
    let mut p = POINT { x: 0, y: 0 };
    if unsafe { GetCursorPos(&mut p) } != 0 {
        Some((p.x, p.y))
    } else {
        None
    }
}

#[cfg(not(windows))]
fn cursor_pos() -> Option<(i32, i32)> {
    None
}

/// The presenter's mouse in CSS pixels of the overlay page.
#[derive(Clone, Serialize)]
struct MousePayload {
    x: f64,
    y: f64,
}

/// Poll the hold chord ~60x/sec. RegisterHotKey cannot express "modifiers only,
/// held", so polling is the simplest thing that gives real press *and* release edges.
/// The same thread reports the mouse position ~30x/sec as `mouse` events (CSS px
/// of the page): while click-through the page gets no pointer events at all, and
/// the ankh ritual counts the presenter's cursor for its quorum.
fn spawn_hold_poller(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last = false;
        let mut last_mouse = (i32::MIN, i32::MIN);
        let mut origin = (0i32, 0i32);
        let mut scale = 1.0f64;
        let mut tick: u32 = 0;
        loop {
            let now = hold_chord_held();
            if now != last {
                last = now;
                app.state::<Mutex<OverlayState>>().lock().unwrap().hold = now;
                apply_mode(&app);
            }
            tick = tick.wrapping_add(1);
            if tick % 2 == 0 {
                // Window origin and DPI scale: cheap, but re-read only about once a second.
                if tick == 2 || tick % 64 == 0 {
                    if let Some(win) = app.get_webview_window("main") {
                        if let Ok(p) = win.outer_position() {
                            origin = (p.x, p.y);
                        }
                        if let Ok(s) = win.scale_factor() {
                            scale = s;
                        }
                    }
                }
                if let Some(p) = cursor_pos() {
                    if p != last_mouse {
                        last_mouse = p;
                        let payload = MousePayload {
                            x: (p.0 - origin.0) as f64 / scale,
                            y: (p.1 - origin.1) as f64 / scale,
                        };
                        let _ = app.emit("mouse", payload);
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(16));
        }
    });
}

/// Register Ctrl+Shift+<key> with the OS. Registered keys never reach other apps.
/// A failure (another app owns the combo) is logged and the overlay still runs.
fn register_hotkeys(app: &AppHandle) {
    for (code, label, action) in HOTKEYS {
        let shortcut = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), code);
        let result = app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let _ = app.emit("hotkey", action);
            }
        });
        if let Err(e) = result {
            eprintln!("could not register Ctrl+Shift+{label}: {e}");
        }
    }
}

/// Stretch the window over the whole primary monitor, taskbar included.
fn cover_primary_monitor(win: &WebviewWindow) -> tauri::Result<()> {
    if let Some(mon) = win.primary_monitor()? {
        let pos = mon.position();
        let size = mon.size();
        win.set_position(PhysicalPosition::new(pos.x, pos.y))?;
        win.set_size(PhysicalSize::new(size.width, size.height))?;
    }
    Ok(())
}

/// Tray icon = escape hatch. The window is hidden from the taskbar, so this is
/// the way to quit or re-lock if the UI is ever unreachable.
fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let lock = MenuItem::with_id(app, "lock", "Lock interactive (no hotkey needed)", true, None::<&str>)?;
    let unlock = MenuItem::with_id(
        app,
        "unlock",
        &format!("Unlock (click-through, hold {HOLD_LABEL})"),
        true,
        None::<&str>,
    )?;
    let kill = MenuItem::with_id(app, "kill", "Disconnect all phones", true, None::<&str>)?;
    let stream = MenuItem::with_id(app, "stream", "Toggle stream mode (bigger)", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit overlay", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&lock, &unlock, &kill, &stream, &quit])?;
    TrayIconBuilder::new()
        .icon(app.default_window_icon().expect("default icon").clone())
        .menu(&menu)
        .tooltip("Webinar overlay")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "lock" => set_locked_inner(app, true),
            "unlock" => set_locked_inner(app, false),
            "kill" => {
                let _ = app.emit("hotkey", "kill");
            }
            "stream" => {
                let _ = app.emit("hotkey", "stream");
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Mutex::new(OverlayState { locked: true, hold: false }))
        .invoke_handler(tauri::generate_handler![set_locked, get_mode, quit_app])
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(win) = app.get_webview_window("main") {
                cover_primary_monitor(&win)?;
            }
            build_tray(&handle)?;
            register_hotkeys(&handle);
            apply_mode(&handle);
            spawn_hold_poller(handle);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
