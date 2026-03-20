import { useState, useEffect, useRef, useCallback } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SystemStats {
  cpu_percent:  number;
  ram_percent:  number;
  ram_used_gb:  number;
  ram_total_gb: number;
  disk_percent: number;
  disk_free_gb: number;
  uptime_secs:  number;
  cpu_temp:     number | null;
  gpu_temp:     number | null;
  battery:      null;
}

export interface NetworkStats {
  download_bytes: number;
  upload_bytes:   number;
  total_recv_mb:  number;
  total_sent_mb:  number;
}

export interface ProcessInfo {
  name:        string;
  cpu_percent: number;
  mem_percent: number;
  pid:         number;
}

export interface SpotifyInfo {
  playing: boolean;
  track:   string;
  artist:  string;
}

export interface SystemInfo {
  cpu_name:     string;
  cpu_cores:    number;
  os_name:      string;
  os_version:   string;
  hostname:     string;
  ram_total_gb: number;
}

export type PerfMode = 'eco' | 'normal' | 'turbo';

export const PERF_CONFIG = {
  eco:    { icon: '🌿', label: 'ECO',    interval: 5000, slowInterval: 30000, net: false, spotify: false, procs: false, weather: false },
  normal: { icon: '⚡', label: 'NORMAL', interval: 1000, slowInterval: 2000,  net: true,  spotify: true,  procs: true,  weather: true  },
  turbo:  { icon: '🚀', label: 'TURBO',  interval: 500,  slowInterval: 1000,  net: true,  spotify: true,  procs: true,  weather: true  },
} as const;

// ── Settings persistence ──────────────────────────────────────────────────────

const SETTINGS_KEY = 'jarvis_settings_v3';

export interface Settings {
  darkTheme:   boolean;
  alwaysOnTop: boolean;
  perfMode:    PerfMode;
}

export function loadSettings(): Settings {
  try { return { darkTheme: false, alwaysOnTop: false, perfMode: 'normal', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { darkTheme: false, alwaysOnTop: false, perfMode: 'normal' }; }
}

export function saveSettings(s: Partial<Settings>) {
  const cur = loadSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...cur, ...s }));
}

// ── Invoke helper ─────────────────────────────────────────────────────────────

async function inv<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<T>(cmd, args);
  } catch { return null; }
}

// ── History helper ────────────────────────────────────────────────────────────

function makeHistory(len = 60): number[] { return Array(len).fill(0); }

function pushHistory(hist: number[], val: number): number[] {
  const next = [...hist.slice(1), val];
  return next;
}

// ── Main hook ─────────────────────────────────────────────────────────────────

export function useSystemData() {
  const [sys,     setSys]     = useState<SystemStats>({ cpu_percent:0, ram_percent:0, ram_used_gb:0, ram_total_gb:0, disk_percent:0, disk_free_gb:0, uptime_secs:0, cpu_temp:null, gpu_temp:null, battery:null });
  const [net,     setNet]     = useState({ dlSpeed:0, ulSpeed:0, totalRecvMb:0, totalSentMb:0 });
  const [spotify, setSpotify] = useState<SpotifyInfo>({ playing:false, track:'', artist:'' });
  const [procs,   setProcs]   = useState<ProcessInfo[]>([]);
  const [weather, setWeather] = useState('...');
  const [sysInfo, setSysInfo] = useState<SystemInfo>({ cpu_name:'...', cpu_cores:0, os_name:'...', os_version:'', hostname:'...', ram_total_gb:0 });
  const [isDemo,  setIsDemo]  = useState(false);

  const [cpuHist, setCpuHist] = useState(makeHistory());
  const [ramHist, setRamHist] = useState(makeHistory());
  const [gpuHist, setGpuHist] = useState(makeHistory());
  const [netHist, setNetHist] = useState(makeHistory());

  const prevRecv   = useRef(0);
  const prevSent   = useRef(0);
  const weatherTs  = useRef(0);
  const mockTick   = useRef(0);
  const sysInfoFetched = useRef(false);

  const fastId = useRef<ReturnType<typeof setInterval> | null>(null);
  const slowId = useRef<ReturnType<typeof setInterval> | null>(null);

  const [settings, setSettingsState] = useState<Settings>(loadSettings);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const fastTick = useCallback(async () => {
    mockTick.current++;
    const mode = PERF_CONFIG[settings.perfMode];
    const s = await inv<SystemStats>('get_system_stats');

    if (s) {
      setSys(s);
      setIsDemo(false);
      setCpuHist(h => pushHistory(h, s.cpu_percent));
      setRamHist(h => pushHistory(h, s.ram_percent));
    } else {
      const t = mockTick.current;
      const mockCpu = 25 + Math.sin(t * 0.12) * 18 + Math.random() * 5;
      const mockRam = 58 + Math.sin(t * 0.07) * 12;
      const mockGpu = 40 + Math.sin(t * 0.09) * 20;
      setSys(prev => ({ ...prev, cpu_percent: mockCpu, ram_percent: mockRam, disk_percent: 55, disk_free_gb: 220, uptime_secs: prev.uptime_secs + 1, cpu_temp: 68, gpu_temp: 72, ram_used_gb: 9.3, ram_total_gb: 16 }));
      setIsDemo(true);
      setCpuHist(h => pushHistory(h, mockCpu));
      setRamHist(h => pushHistory(h, mockRam));
      setGpuHist(h => pushHistory(h, mockGpu));
    }

    if (mode.net) {
      const n = await inv<NetworkStats>('get_network_stats');
      if (n) {
        const dl = Math.max(0, n.download_bytes - prevRecv.current) / 1024;
        const ul = Math.max(0, n.upload_bytes   - prevSent.current) / 1024;
        prevRecv.current = n.download_bytes;
        prevSent.current = n.upload_bytes;
        setNet({ dlSpeed: dl, ulSpeed: ul, totalRecvMb: n.total_recv_mb, totalSentMb: n.total_sent_mb });
        setNetHist(h => pushHistory(h, dl));
      }
    } else {
      if (!s) {
        const dl = Math.abs(Math.sin(mockTick.current * 0.2)) * 300;
        setNet(prev => ({ ...prev, dlSpeed: dl, ulSpeed: dl * 0.1 }));
        setNetHist(h => pushHistory(h, dl));
      }
    }
  }, [settings.perfMode]);

  const slowTick = useCallback(async () => {
    const mode = PERF_CONFIG[settings.perfMode];

    if (mode.weather && Date.now() - weatherTs.current > 300_000) {
      const w = await inv<string>('get_weather');
      if (w) { setWeather(w); weatherTs.current = Date.now(); }
    }

    if (mode.procs) {
      const p = await inv<ProcessInfo[]>('get_processes');
      if (p) setProcs(p);
    }

    if (mode.spotify) {
      const sp = await inv<SpotifyInfo>('get_spotify');
      if (sp) {
        setSpotify(prev => {
          if (sp.playing && sp.track && sp.track !== prev.track) {
            // Save to spotify stats
            const STATS_KEY = 'jarvis_spotify_stats';
            try {
              const data = JSON.parse(localStorage.getItem(STATS_KEY) || '{"plays":[]}');
              const now = Date.now();
              const d = new Date(now); const day = d.getDay() || 7; d.setDate(d.getDate() - day + 1);
              data.plays = [{ track: sp.track, artist: sp.artist, ts: now, weekKey: d.toISOString().slice(0,10), monthKey: new Date(now).toISOString().slice(0,7) }, ...data.plays].slice(0, 2000);
              localStorage.setItem(STATS_KEY, JSON.stringify(data));
            } catch {}
          }
          return sp;
        });
      }
    }

    if (!sysInfoFetched.current) {
      const si = await inv<SystemInfo>('get_system_info');
      if (si) { setSysInfo(si); sysInfoFetched.current = true; }
    }
  }, [settings.perfMode]);

  // Start/restart polling when perfMode changes
  const startPolling = useCallback(() => {
    if (fastId.current) clearInterval(fastId.current);
    if (slowId.current) clearInterval(slowId.current);
    const mode = PERF_CONFIG[settings.perfMode];
    fastTick();
    slowTick();
    fastId.current = setInterval(fastTick, mode.interval);
    slowId.current = setInterval(slowTick, mode.slowInterval);
  }, [settings.perfMode, fastTick, slowTick]);

  useEffect(() => {
    startPolling();
    // Apply alwaysOnTop on mount
    if (settings.alwaysOnTop) {
      import('@tauri-apps/api/window').then(({ Window }) =>
        Window.getCurrent().then(w => w.setAlwaysOnTop(true)).catch(() => {})
      );
    }
    return () => {
      if (fastId.current) clearInterval(fastId.current);
      if (slowId.current) clearInterval(slowId.current);
    };
  }, [settings.perfMode]); // restart when perfMode changes

  return { sys, net, spotify, procs, weather, sysInfo, isDemo, cpuHist, ramHist, gpuHist, netHist, settings, updateSettings };
}
