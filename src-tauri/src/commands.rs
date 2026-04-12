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
    // System/host processes to exclude
    let exclude: &[&str] = &[
        "msedgewebview2.exe", "RuntimeBroker.exe", "svchost.exe",
        "SearchHost.exe", "SearchIndexer.exe", "WmiPrvSE.exe",
        "audiodg.exe", "dwm.exe", "csrss.exe", "lsass.exe",
        "services.exe", "smss.exe", "wininit.exe", "winlogon.exe",
        "System", "Registry", "Idle", "conhost.exe", "fontdrvhost.exe",
        "MsMpEng.exe", "NisSrv.exe", "SecurityHealthService.exe",
        "spoolsv.exe", "msdtc.exe", "dllhost.exe", "taskhostw.exe",
        "ctfmon.exe", "sihost.exe", "ShellExperienceHost.exe",
        "StartMenuExperienceHost.exe", "TextInputHost.exe",
    ];

    with_sys(|sys| {
        sys.refresh_processes(ProcessesToUpdate::All, true);
        let ram_total = sys.total_memory() as f32;
        let mut procs: Vec<ProcessInfo> = sys.processes().values()
            .filter(|p| {
                let name = p.name().to_string_lossy().to_lowercase();
                // Must use >0.1% CPU or >0.5% memory
                let cpu = p.cpu_usage();
                let mem = if ram_total > 0.0 { p.memory() as f32 / ram_total * 100.0 } else { 0.0 };
                if cpu < 0.05 && mem < 0.3 { return false; }
                // Exclude system processes
                let name_orig = p.name().to_string_lossy();
                if exclude.iter().any(|e| name_orig.eq_ignore_ascii_case(e)) { return false; }
                // Exclude Windows host process patterns
                if name.starts_with("runtime") && name.contains("broker") { return false; }
                if name == "system" || name == "registry" || name == "idle" { return false; }
                true
            })
            .map(|p| ProcessInfo {
                name:        p.name().to_string_lossy().into_owned(),
                cpu_percent: p.cpu_usage(),
                mem_percent: if ram_total > 0.0 { p.memory() as f32 / ram_total * 100.0 } else { 0.0 },
                pid:         p.pid().as_u32(),
            }).collect();
        procs.sort_by(|a, b| b.cpu_percent.partial_cmp(&a.cpu_percent).unwrap());
        procs.truncate(6);
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

// ── Image Tools Box integration ───────────────────────────────────────────────

#[tauri::command]
pub fn open_image_tools_cli() -> Result<String, String> {
    // Try to find python in common locations
    let python_cmds = ["python", "python3", "py"];
    let script_name = "image_upscaler.py";

    // Look for the script next to the executable
    let exe_dir = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.to_path_buf()));

    let search_paths: Vec<std::path::PathBuf> = [
        exe_dir.clone().map(|d| d.join(script_name)),
        exe_dir.clone().map(|d| d.join("resources").join(script_name)),
        Some(std::path::PathBuf::from(script_name)),
    ].into_iter().flatten().collect();

    let script_path = search_paths.into_iter().find(|p| p.exists());

    let script_str = match &script_path {
        Some(p) => p.to_string_lossy().into_owned(),
        None => return Err("image_upscaler.py not found. Place it next to JARVIS.exe".into()),
    };

    for py in python_cmds {
        let result = std::process::Command::new(py)
            .args(["--version"])
            .output();
        if result.is_ok() {
            // Launch in a new terminal window
            #[cfg(windows)]
            std::process::Command::new("cmd")
                .args(["/c", "start", "cmd", "/k", py, &script_str])
                .spawn()
                .map_err(|e| e.to_string())?;
            #[cfg(not(windows))]
            std::process::Command::new("bash")
                .args(["-c", &format!("x-terminal-emulator -e {py} {script_str} || xterm -e {py} {script_str} || gnome-terminal -- {py} {script_str}")])
                .spawn()
                .map_err(|e| e.to_string())?;
            return Ok(format!("Launched: {py} {script_str}"));
        }
    }
    Err("Python not found. Install Python 3 and run: pip install opencv-python Pillow numpy".into())
}

#[tauri::command]
pub fn check_python() -> String {
    let cmds = ["python", "python3", "py"];
    for py in cmds {
        if let Ok(out) = std::process::Command::new(py).args(["--version"]).output() {
            if out.status.success() {
                return String::from_utf8_lossy(&out.stdout).trim().to_string();
            }
        }
    }
    "not_found".into()
}

#[tauri::command]
pub fn open_folder_picker() -> Result<String, String> {
    // Open a folder browser dialog via PowerShell on Windows
    #[cfg(windows)]
    {
        let out = std::process::Command::new("powershell")
            .args(["-Command",
                "[System.Reflection.Assembly]::LoadWithPartialName('System.windows.forms') | Out-Null;\
                $f = New-Object System.Windows.Forms.FolderBrowserDialog;\
                $f.Description = 'Select folder';\
                if($f.ShowDialog() -eq 'OK'){$f.SelectedPath}else{''}"])
            .output()
            .map_err(|e| e.to_string())?;
        let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if path.is_empty() { return Err("cancelled".into()); }
        return Ok(path);
    }
    #[cfg(not(windows))]
    Err("folder_picker only supported on Windows currently".into())
}

#[tauri::command]
pub fn sort_files(folder: String, output: String, mode: String) -> Result<String, String> {
    use std::fs;
    use std::collections::HashMap;

    let src = std::path::Path::new(&folder);
    let out_base = std::path::Path::new(&output);

    if !src.exists() { return Err(format!("Folder not found: {folder}")); }

    let ext_map: HashMap<&str, &str> = [
        ("jpg","Images"),("jpeg","Images"),("png","Images"),("gif","Images"),
        ("bmp","Images"),("webp","Images"),("tiff","Images"),("svg","Images"),("ico","Images"),
        ("mp4","Videos"),("mkv","Videos"),("avi","Videos"),("mov","Videos"),
        ("wmv","Videos"),("flv","Videos"),("webm","Videos"),
        ("mp3","Music"),("flac","Music"),("wav","Music"),("aac","Music"),
        ("ogg","Music"),("m4a","Music"),("wma","Music"),
        ("pdf","Documents"),("doc","Documents"),("docx","Documents"),
        ("xls","Documents"),("xlsx","Documents"),("ppt","Documents"),
        ("pptx","Documents"),("txt","Documents"),("rtf","Documents"),("csv","Documents"),
        ("py","Code"),("js","Code"),("ts","Code"),("html","Code"),("css","Code"),
        ("json","Code"),("xml","Code"),("yaml","Code"),("yml","Code"),("sql","Code"),
        ("rs","Code"),("go","Code"),("cpp","Code"),("c","Code"),("h","Code"),
        ("zip","Archives"),("rar","Archives"),("7z","Archives"),("tar","Archives"),("gz","Archives"),
        ("exe","Applications"),("msi","Applications"),("dmg","Applications"),("apk","Applications"),
        ("ttf","Fonts"),("otf","Fonts"),("woff","Fonts"),
    ].iter().cloned().collect();

    let mut moved = 0u32;
    let mut errors: Vec<String> = vec![];

    let entries = fs::read_dir(src).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() { continue; }
        let ext = path.extension()
            .and_then(|e| e.to_str())
            .map(|e| e.to_lowercase())
            .unwrap_or_default();
        let group = ext_map.get(ext.as_str()).copied().unwrap_or("Other");
        let dest_dir = out_base.join(group);
        if let Err(e) = fs::create_dir_all(&dest_dir) {
            errors.push(format!("{}: {e}", path.display())); continue;
        }
        let mut dest = dest_dir.join(path.file_name().unwrap());
        let mut counter = 1u32;
        while dest.exists() {
            let stem = path.file_stem().and_then(|s|s.to_str()).unwrap_or("file");
            let ext2 = path.extension().and_then(|e|e.to_str()).unwrap_or("");
            dest = dest_dir.join(format!("{stem}_{counter}.{ext2}"));
            counter += 1;
        }
        let result = if mode == "move" {
            fs::rename(&path, &dest).or_else(|_| fs::copy(&path, &dest).map(|_|()).and_then(|_| fs::remove_file(&path)))
        } else {
            fs::copy(&path, &dest).map(|_|())
        };
        match result {
            Ok(_) => moved += 1,
            Err(e) => errors.push(format!("{}: {e}", path.display())),
        }
    }

    if errors.is_empty() {
        Ok(format!("✅ {moved} files sorted into {}", out_base.display()))
    } else {
        Ok(format!("⚠️ {moved} sorted, {} errors: {}", errors.len(), errors.join("; ")))
    }
}

// ── F.R.I.D.A.Y. System Control Commands ─────────────────────────────────────

/// Open a URL or protocol link using the OS default handler
#[tauri::command]
pub fn open_url(url: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(format!("Opened: {url}"))
}

/// Kill a process by name (Windows: taskkill, Linux/Mac: pkill)
#[tauri::command]
pub fn kill_process(name: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let out = std::process::Command::new("taskkill")
            .args(["/F", "/IM", &name])
            .output()
            .map_err(|e| e.to_string())?;
        return Ok(String::from_utf8_lossy(&out.stdout).to_string());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let out = std::process::Command::new("pkill")
            .arg("-f")
            .arg(&name)
            .output()
            .map_err(|e| e.to_string())?;
        return Ok(String::from_utf8_lossy(&out.stdout).to_string());
    }
}

/// Run an arbitrary shell command (use with care — only called from trusted UI)
#[tauri::command]
pub fn run_command(command: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    let out = std::process::Command::new("cmd")
        .args(["/c", &command])
        .output()
        .map_err(|e| e.to_string())?;
    #[cfg(not(target_os = "windows"))]
    let out = std::process::Command::new("sh")
        .args(["-c", &command])
        .output()
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}
