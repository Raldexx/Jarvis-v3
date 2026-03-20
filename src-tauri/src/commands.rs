use serde::Serialize;
use sysinfo::{Components, Disks, Networks, System, ProcessesToUpdate};
use std::sync::Mutex;

// ── Persistent System instance ────────────────────────────────────────────────
// sysinfo calculates CPU% as a delta between two refresh() calls.
// Creating a new System every call = no delta = garbage CPU readings.
// We keep one instance alive in a Mutex and only refresh it.

struct SysState {
    sys: System,
}

static SYS: Mutex<Option<SysState>> = Mutex::new(None);

fn with_sys<F, R>(f: F) -> R
where
    F: FnOnce(&mut System) -> R,
{
    let mut guard = SYS.lock().unwrap();
    if guard.is_none() {
        let mut sys = System::new_all();
        sys.refresh_all();
        *guard = Some(SysState { sys });
    }
    f(&mut guard.as_mut().unwrap().sys)
}

// ── Response Types ────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct SystemStats {
    pub cpu_percent:  f32,
    pub ram_percent:  f32,
    pub ram_used_gb:  f64,
    pub ram_total_gb: f64,
    pub disk_percent: f64,
    pub disk_free_gb: f64,
    pub uptime_secs:  u64,
    pub cpu_temp:     Option<f32>,
    pub gpu_temp:     Option<f32>,
    pub battery:      Option<BatteryInfo>,
}

#[derive(Serialize)]
pub struct BatteryInfo {
    pub percent:  f32,
    pub charging: bool,
}

#[derive(Serialize)]
pub struct NetworkStats {
    pub download_bytes: u64,
    pub upload_bytes:   u64,
    pub total_recv_mb:  f64,
    pub total_sent_mb:  f64,
}

#[derive(Serialize)]
pub struct ProcessInfo {
    pub name:        String,
    pub cpu_percent: f32,
    pub mem_percent: f32,
    pub pid:         u32,
}

#[derive(Serialize)]
pub struct SpotifyInfo {
    pub playing: bool,
    pub track:   String,
    pub artist:  String,
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn get_system_stats() -> SystemStats {
    // First refresh — prime the CPU counter
    with_sys(|sys| { sys.refresh_cpu_usage(); sys.refresh_memory(); });

    // Wait so the delta window is meaningful
    std::thread::sleep(std::time::Duration::from_millis(200));

    // Second refresh — now CPU% is accurate
    with_sys(|sys| {
        sys.refresh_cpu_usage();
        sys.refresh_memory();

        let cpu_percent  = sys.global_cpu_usage();
        let ram_used     = sys.used_memory();
        let ram_total    = sys.total_memory();
        let ram_percent  = if ram_total > 0 { ram_used as f32 / ram_total as f32 * 100.0 } else { 0.0 };
        let ram_used_gb  = ram_used  as f64 / 1_073_741_824.0;
        let ram_total_gb = ram_total as f64 / 1_073_741_824.0;

        let disks = Disks::new_with_refreshed_list();
        let (disk_percent, disk_free_gb) = disks.iter().next().map(|d| {
            let total = d.total_space() as f64;
            let free  = d.available_space() as f64;
            (if total > 0.0 { (total - free) / total * 100.0 } else { 0.0 }, free / 1_073_741_824.0)
        }).unwrap_or((0.0, 0.0));

        let uptime_secs = System::uptime();

        let components = Components::new_with_refreshed_list();
        let cpu_temp: Option<f32> = components.iter()
            .find(|c| { let l = c.label().to_lowercase(); l.contains("cpu") || l.contains("core") || l.contains("package") })
            .and_then(|c| c.temperature());
        let gpu_temp: Option<f32> = components.iter()
            .find(|c| { let l = c.label().to_lowercase(); l.contains("gpu") || l.contains("nvidia") || l.contains("amd") || l.contains("radeon") })
            .and_then(|c| c.temperature());

        SystemStats {
            cpu_percent, ram_percent, ram_used_gb, ram_total_gb,
            disk_percent, disk_free_gb, uptime_secs,
            cpu_temp, gpu_temp, battery: None,
        }
    })
}

#[tauri::command]
pub fn get_network_stats() -> NetworkStats {
    let mut networks = Networks::new_with_refreshed_list();
    std::thread::sleep(std::time::Duration::from_millis(200));
    networks.refresh(false);

    let (mut dl, mut ul, mut tr, mut ts) = (0u64, 0u64, 0u64, 0u64);
    for (_, d) in &networks { dl += d.received(); ul += d.transmitted(); tr += d.total_received(); ts += d.total_transmitted(); }
    NetworkStats { download_bytes: dl, upload_bytes: ul, total_recv_mb: tr as f64 / 1_048_576.0, total_sent_mb: ts as f64 / 1_048_576.0 }
}

#[tauri::command]
pub fn get_processes() -> Vec<ProcessInfo> {
    with_sys(|sys| {
        sys.refresh_processes(ProcessesToUpdate::All, true);
        let ram_total = sys.total_memory() as f32;
        let mut procs: Vec<ProcessInfo> = sys.processes().values().map(|p| ProcessInfo {
            name:        p.name().to_string_lossy().into_owned(),
            cpu_percent: p.cpu_usage(),
            mem_percent: if ram_total > 0.0 { p.memory() as f32 / ram_total * 100.0 } else { 0.0 },
            pid:         p.pid().as_u32(),
        }).collect();
        procs.sort_by(|a, b| b.cpu_percent.partial_cmp(&a.cpu_percent).unwrap());
        procs.truncate(5);
        procs
    })
}

#[tauri::command]
pub async fn get_weather() -> String {
    match reqwest::get("https://wttr.in/?format=%t+%C").await {
        Ok(r) => r.text().await.unwrap_or_else(|_| "Offline".into()),
        Err(_) => "Offline".into(),
    }
}

#[tauri::command]
pub fn get_spotify() -> SpotifyInfo {
    #[cfg(target_os = "windows")]
    if let Some(title) = find_spotify_title() {
        if title.contains(" - ") {
            let mut p = title.splitn(2, " - ");
            let artist = p.next().unwrap_or("").trim().to_string();
            let track  = p.next().unwrap_or("").trim().to_string();
            return SpotifyInfo { playing: true, track, artist };
        }
        return SpotifyInfo { playing: true, track: title, artist: "Unknown".into() };
    }
    SpotifyInfo { playing: false, track: String::new(), artist: String::new() }
}

#[cfg(target_os = "windows")]
fn find_spotify_title() -> Option<String> {
    use std::ptr;
    use winapi::shared::minwindef::{BOOL, LPARAM};
    use winapi::shared::windef::HWND;
    use winapi::um::winuser::{EnumWindows, GetWindowTextW, GetWindowThreadProcessId, IsWindowVisible};
    use winapi::um::processthreadsapi::OpenProcess;
    use winapi::um::psapi::GetModuleBaseNameW;
    use winapi::um::winnt::PROCESS_QUERY_INFORMATION;

    static mut RESULT: Option<String> = None;

    unsafe extern "system" fn cb(hwnd: HWND, _: LPARAM) -> BOOL {
        if IsWindowVisible(hwnd) == 0 { return 1; }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, &mut pid);
        let h = OpenProcess(PROCESS_QUERY_INFORMATION | 0x0010, 0, pid);
        if h.is_null() { return 1; }
        let mut name = [0u16; 260];
        GetModuleBaseNameW(h, ptr::null_mut(), name.as_mut_ptr(), 260);
        let pname = String::from_utf16_lossy(&name).trim_matches('\0').to_lowercase();
        if pname.contains("spotify") {
            let mut title = [0u16; 512];
            let len = GetWindowTextW(hwnd, title.as_mut_ptr(), 512);
            if len > 0 {
                let s = String::from_utf16_lossy(&title[..len as usize]).to_string();
                let skip = ["", "Spotify", "Spotify Premium", "Spotify Free", "GDI+ Window"];
                if !skip.contains(&s.as_str()) { RESULT = Some(s); }
            }
        }
        1
    }

    unsafe { RESULT = None; EnumWindows(Some(cb), 0); RESULT.clone() }
}

#[derive(Serialize)]
pub struct SystemInfo {
    pub cpu_name:    String,
    pub cpu_cores:   usize,
    pub os_name:     String,
    pub os_version:  String,
    pub hostname:    String,
    pub ram_total_gb: f64,
}

#[tauri::command]
pub fn get_system_info() -> SystemInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_name = sys.cpus().first()
        .map(|c| c.brand().trim().to_string())
        .unwrap_or_else(|| "Unknown CPU".into());

    let cpu_cores = sys.cpus().len();
    let ram_total_gb = sys.total_memory() as f64 / 1_073_741_824.0;

    let os_name    = System::name().unwrap_or_else(|| "Unknown".into());
    let os_version = System::os_version().unwrap_or_else(|| "".into());
    let hostname   = System::host_name().unwrap_or_else(|| "Unknown".into());

    SystemInfo { cpu_name, cpu_cores, os_name, os_version, hostname, ram_total_gb }
}


#[tauri::command]
pub fn system_action(action: String) -> Result<(), String> {
    match action.as_str() {
        "restart"  => { #[cfg(windows)] std::process::Command::new("shutdown").args(["/r","/t","1"]).spawn().ok(); }
        "shutdown" => { #[cfg(windows)] std::process::Command::new("shutdown").args(["/s","/t","1"]).spawn().ok(); }
        "sleep"    => { #[cfg(windows)] std::process::Command::new("rundll32.exe").args(["powrprof.dll,SetSuspendState","0,1,0"]).spawn().ok(); }
        "taskmgr"  => { #[cfg(windows)] std::process::Command::new("taskmgr").spawn().ok(); }
        _ => return Err(format!("Unknown: {action}")),
    }
    Ok(())
}
