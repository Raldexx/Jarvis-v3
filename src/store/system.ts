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
export type Language = 'en' | 'tr' | 'es';

export const PERF_CONFIG = {
  eco:    { icon: '🌿', label: 'eco',    interval: 5000, slowInterval: 30000, net: false, spotify: false, procs: false, weather: false },
  normal: { icon: '⚡', label: 'normal', interval: 1000, slowInterval: 2000,  net: true,  spotify: true,  procs: true,  weather: true  },
  turbo:  { icon: '🚀', label: 'turbo',  interval: 500,  slowInterval: 1000,  net: true,  spotify: true,  procs: true,  weather: true  },
} as const;

// ── i18n ──────────────────────────────────────────────────────────────────────

export const TRANSLATIONS: Record<Language, I18n> = {
  en: {
    systemMonitor: 'SYSTEM MONITOR',
    settings: 'Settings',
    changelog: 'Changelog',
    actions: 'Actions',
    notes: 'NOTES',
    notesAdd: 'Tap to add a note',
    notesMore: (n: number) => `+${n} more`,
    noteAddBtn: '+ Add note',
    nowPlaying: 'NOW PLAYING',
    notPlaying: 'Not Playing',
    openSpotify: 'Open Spotify',
    system: 'SYSTEM',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    alwaysOnTop: 'Always on top',
    on: 'On',
    off: 'Off',
    performance: 'Performance',
    close: 'Close',
    language: 'Language',
    startWithWindows: 'Start with Windows',
    quickNotes: 'QUICK NOTES',
    notePlaceholder: 'Write a note... (Ctrl+Enter to save)',
    update: '✓ Update',
    add: '+ Add',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    noNotes: 'No notes yet',
    quickActions: 'QUICK ACTIONS',
    restart: '🔄 Restart System',
    shutdown: '⚫ Shutdown',
    sleep: '😴 Sleep Mode',
    confirmRestart: 'Confirm restart?',
    confirmShutdown: 'Confirm shutdown?',
    music: 'MUSIC',
    recentlyPlayed: 'RECENTLY PLAYED',
    visualizer: 'VISUALIZER',
    musicService: 'MUSIC SERVICE',
    stats: '📊 Stats',
    demoMode: 'DEMO MODE',
    uptime: 'Uptime',
    free: 'free',
    perfEcoInfo: 'CPU & RAM only · 5s refresh · low load',
    perfNormalInfo: 'All metrics · 1s refresh · balanced',
    perfTurboInfo: 'All metrics · 500ms refresh · max accuracy',
    topProcesses: 'TOP PROCESSES',
    ecoNoSpotify: 'Spotify tracking paused in Eco mode',
    premium: 'Premium',
    premiumTitle: 'PREMIUM',
    timer: 'Timer',
    worldClock: 'World Clock',
    searchCity: 'Search city...',
    imageTools: 'Image Tools',
    firstRunTitle: 'Welcome to F.R.I.D.A.Y.',
    firstRunDesc: "Here's a quick tour of all features:",
    tour: {
      cpu: '📊 CPU / RAM / GPU — Click any card to see a 60-second history chart.',
      network: '🌐 Network — Real-time download & upload speed with sparkline.',
      disk: '💿 Disk — Shows usage % and free space.',
      nowPlaying: '🎵 Now Playing — Click to open the Music panel with track history.',
      system: '🖥 System — Your hardware info at a glance.',
      notes: '📝 Notes — Click to open notes & timer panel.',
      settings: '⚙️ Settings — Theme, language, performance mode and more.',
      actions: '⚡ Actions — Quick system controls.',
      clock: '🕐 Clock — Click the clock to check world times.',
    },
    gotIt: 'Got it!',
    artistThemeLabel: 'Artist Theme',
    photoRotationLabel: 'Photo Rotation',
    changelogEntries: [
      {
        ver: 'v4.0.0', date: 'Current — JARVIS → F.R.I.D.A.Y.',
        items: [
          { type: 'add', text: '🤖 Renamed: JARVIS → F.R.I.D.A.Y. (Female Replacement Intelligent Digital Assistant Youth)' },
          { type: 'add', text: '🎙 F.R.I.D.A.Y. AI — Real-time voice assistant via OpenAI Realtime API (WebRTC, gpt-4o-realtime-preview)' },
          { type: 'add', text: '🌀 Animated 72-bar audio ring visualizer — reacts to mic volume in real time' },
          { type: 'add', text: '🚀 Protocol commands: start / work / gaming / night protocol' },
          { type: 'add', text: '🧠 Semantic memory — automatic learning from conversations (fact / preference categories)' },
          { type: 'add', text: '📝 Google Meet integration + Obsidian .md note template + AI meeting summary' },
          { type: 'add', text: '🔄 AI Translator card — replaced System Info card (8 languages, auto-debounce)' },
          { type: 'add', text: '⏱ Timer split into its own card — Notes and Timer are now two side-by-side cards' },
          { type: 'add', text: '💤 Idle mode — after 15 min inactivity shows large clock + CPU/RAM/GPU mini metrics' },
          { type: 'fix', text: 'F.R.I.D.A.Y. voice commands disabled in Eco mode' },
          { type: 'fix', text: 'Realtime API language follows app language setting (TR/EN/ES whisper)' },
          { type: 'fix', text: 'System Info moved into CPU chart modal' },
          { type: 'fix', text: 'Google Drive / Calendar accessible via F.R.I.D.A.Y. AI' },
        ],
      },
      {
        ver: 'v3.2.0', date: 'Last JARVIS release',
        items: [
          { type: 'add', text: 'Language support: English, Turkish, Spanish' },
          { type: 'add', text: 'World Clock, Image Tools, Notes+Timer, Artist themes (Madison / İcardi)' },
          { type: 'add', text: 'OpenAI Realtime API first integration — completed in this version' },
        ],
      },
      {
        ver: 'v3.0.0', date: 'Initial release',
        items: [
          { type: 'add', text: 'Full rewrite from Python/PyQt6 to Tauri + React + Rust' },
          { type: 'add', text: 'Spotify integration' },
          { type: 'add', text: 'GitHub Actions CI/CD' },
        ],
      },
    ],
  },
  tr: {
    systemMonitor: 'SİSTEM MONİTÖRÜ',
    settings: 'Ayarlar',
    changelog: 'Değişiklikler',
    actions: 'Eylemler',
    notes: 'NOTLAR',
    notesAdd: 'Not eklemek için tıkla',
    notesMore: (n: number) => `+${n} daha`,
    noteAddBtn: '+ Not ekle',
    nowPlaying: 'ŞU AN ÇALIYOR',
    notPlaying: 'Çalmıyor',
    openSpotify: "Spotify'ı aç",
    system: 'SİSTEM',
    theme: 'Tema',
    light: 'Açık',
    dark: 'Koyu',
    alwaysOnTop: 'Her zaman üstte',
    on: 'Açık',
    off: 'Kapalı',
    performance: 'Performans',
    close: 'Kapat',
    language: 'Dil',
    startWithWindows: 'Windows ile başlat',
    quickNotes: 'HIZLI NOTLAR',
    notePlaceholder: 'Not yaz... (Ctrl+Enter ile kaydet)',
    update: '✓ Güncelle',
    add: '+ Ekle',
    cancel: 'İptal',
    edit: 'Düzenle',
    delete: 'Sil',
    noNotes: 'Henüz not yok',
    quickActions: 'HIZLI EYLEMLER',
    restart: '🔄 Sistemi Yeniden Başlat',
    shutdown: '⚫ Kapat',
    sleep: '😴 Uyku Modu',
    confirmRestart: 'Yeniden başlatılsın mı?',
    confirmShutdown: 'Kapatılsın mı?',
    music: 'MÜZİK',
    recentlyPlayed: 'SON ÇALINANLAR',
    visualizer: 'GÖRSELLEŞTİRİCİ',
    musicService: 'MÜZİK SERVİSİ',
    stats: '📊 İstatistik',
    demoMode: 'DEMO MODU',
    uptime: 'Çalışma süresi',
    free: 'boş',
    perfEcoInfo: 'Yalnızca CPU & RAM · 5s yenileme · düşük yük',
    perfNormalInfo: 'Tüm metrikler · 1s yenileme · dengeli',
    perfTurboInfo: 'Tüm metrikler · 500ms yenileme · maksimum hassasiyet',
    topProcesses: 'EN YOĞUN İŞLEMLER',
    ecoNoSpotify: 'Eco modda Spotify takibi duraklatıldı',
    premium: 'Premium',
    premiumTitle: 'PREMİUM',
    timer: 'Zamanlayıcı',
    worldClock: 'Dünya Saati',
    searchCity: 'Şehir ara...',
    imageTools: 'Resim Araçları',
    firstRunTitle: "F.R.I.D.A.Y.'e Hoş Geldin",
    firstRunDesc: 'Tüm özelliklere hızlı bir bakış:',
    tour: {
      cpu: '📊 CPU / RAM / GPU — 60 saniyelik geçmiş grafiği için herhangi bir karta tıkla.',
      network: '🌐 Ağ — Anlık indirme ve yükleme hızı sparkline ile.',
      disk: '💿 Disk — Kullanım yüzdesi ve boş alan.',
      nowPlaying: '🎵 Şu An Çalıyor — Müzik panelini açmak için tıkla.',
      system: '🖥 Sistem — Donanım bilgilerini tek bakışta gör.',
      notes: '📝 Notlar — Not ve zamanlayıcı panelini açmak için tıkla.',
      settings: '⚙️ Ayarlar — Tema, dil, performans modu ve daha fazlası.',
      actions: '⚡ Eylemler — Hızlı sistem kontrolleri.',
      clock: '🕐 Saat — Dünya saatlerini kontrol etmek için saate tıkla.',
    },
    gotIt: 'Anladım!',
    artistThemeLabel: 'Sanatçı Teması',
    photoRotationLabel: 'Foto Rotasyonu',
    changelogEntries: [
      {
        ver: 'v4.0.0', date: 'Güncel — JARVIS → F.R.I.D.A.Y.',
        items: [
          { type: 'add', text: '🤖 Yeniden adlandırıldı: JARVIS → F.R.I.D.A.Y. (Female Replacement Intelligent Digital Assistant Youth)' },
          { type: 'add', text: '🎙 F.R.I.D.A.Y. AI — OpenAI Realtime API (WebRTC, gpt-4o-realtime-preview) ile gerçek zamanlı sesli asistan' },
          { type: 'add', text: '🌀 Animasyonlu 72-bar ses halkası visualizer — mic volumüne gerçek zamanlı tepki' },
          { type: 'add', text: '🚀 Protokol komutları: başlangıç / iş / oyun / gece protokolü' },
          { type: 'add', text: '🧠 Semantic memory — konuşmalardan otomatik öğrenme (fact / preference kategorisi)' },
          { type: 'add', text: '📝 Google Meet entegrasyonu + Obsidian .md not şablonu + AI toplantı özeti' },
          { type: 'add', text: '🔄 AI Çeviri kartı — System Info kartının yerine geçti (8 dil, otomatik debounce)' },
          { type: 'add', text: '⏱ Timer ayrı kart olarak bölündü — Notes ve Timer artık yan yana iki kart' },
          { type: 'add', text: '💤 Idle modu — 15 dk hareketsizlikte büyük saat + CPU/RAM/GPU mini metrik ekranı' },
          { type: 'fix', text: 'Eco modda F.R.I.D.A.Y. sesli komut devre dışı bırakıldı' },
          { type: 'fix', text: 'Realtime API dil ayarına uygun (TR/EN/ES whisper dili)' },
          { type: 'fix', text: 'System Info bilgileri CPU modalına taşındı' },
          { type: 'fix', text: 'Google Drive / Calendar bağlantısı F.R.I.D.A.Y. AI üzerinden' },
        ],
      },
      {
        ver: 'v3.2.0', date: 'Son JARVIS sürümü',
        items: [
          { type: 'add', text: 'Dil desteği: İngilizce, Türkçe, İspanyolca' },
          { type: 'add', text: 'Dünya Saati, Resim Araçları, Notlar+Zamanlayıcı, Sanatçı temaları (Madison / İcardi)' },
          { type: 'add', text: 'OpenAI Realtime API ilk entegrasyon — bu sürümde tamamlandı' },
        ],
      },
      {
        ver: 'v3.0.0', date: 'İlk sürüm',
        items: [
          { type: 'add', text: "Python/PyQt6'dan Tauri + React + Rust'a tam yeniden yazım" },
          { type: 'add', text: 'Spotify entegrasyonu' },
          { type: 'add', text: 'GitHub Actions CI/CD' },
        ],
      },
    ],
  },
  es: {
    systemMonitor: 'MONITOR DE SISTEMA',
    settings: 'Ajustes',
    changelog: 'Cambios',
    actions: 'Acciones',
    notes: 'NOTAS',
    notesAdd: 'Toca para añadir una nota',
    notesMore: (n: number) => `+${n} más`,
    noteAddBtn: '+ Añadir nota',
    nowPlaying: 'REPRODUCIENDO',
    notPlaying: 'No hay música',
    openSpotify: 'Abrir Spotify',
    system: 'SISTEMA',
    theme: 'Tema',
    light: 'Claro',
    dark: 'Oscuro',
    alwaysOnTop: 'Siempre encima',
    on: 'Sí',
    off: 'No',
    performance: 'Rendimiento',
    close: 'Cerrar',
    language: 'Idioma',
    startWithWindows: 'Iniciar con Windows',
    quickNotes: 'NOTAS RÁPIDAS',
    notePlaceholder: 'Escribe una nota... (Ctrl+Enter para guardar)',
    update: '✓ Actualizar',
    add: '+ Añadir',
    cancel: 'Cancelar',
    edit: 'Editar',
    delete: 'Eliminar',
    noNotes: 'Sin notas aún',
    quickActions: 'ACCIONES RÁPIDAS',
    restart: '🔄 Reiniciar Sistema',
    shutdown: '⚫ Apagar',
    sleep: '😴 Modo Reposo',
    confirmRestart: '¿Confirmar reinicio?',
    confirmShutdown: '¿Confirmar apagado?',
    music: 'MÚSICA',
    recentlyPlayed: 'REPRODUCIDO RECIENTEMENTE',
    visualizer: 'VISUALIZADOR',
    musicService: 'SERVICIO DE MÚSICA',
    stats: '📊 Estadísticas',
    demoMode: 'MODO DEMO',
    uptime: 'Tiempo activo',
    free: 'libre',
    perfEcoInfo: 'Solo CPU y RAM · 5s · carga baja',
    perfNormalInfo: 'Todas las métricas · 1s · equilibrado',
    perfTurboInfo: 'Todas las métricas · 500ms · máxima precisión',
    topProcesses: 'PROCESOS PRINCIPALES',
    ecoNoSpotify: 'Seguimiento de Spotify pausado en modo Eco',
    premium: 'Premium',
    premiumTitle: 'PREMIUM',
    timer: 'Temporizador',
    worldClock: 'Reloj Mundial',
    searchCity: 'Buscar ciudad...',
    imageTools: 'Herramientas de imagen',
    firstRunTitle: 'Bienvenido a F.R.I.D.A.Y.',
    firstRunDesc: 'Un recorrido rápido por todas las funciones:',
    tour: {
      cpu: '📊 CPU / RAM / GPU — Haz clic en cualquier tarjeta para ver el historial de 60 segundos.',
      network: '🌐 Red — Velocidad de descarga y carga en tiempo real.',
      disk: '💿 Disco — Porcentaje de uso y espacio libre.',
      nowPlaying: '🎵 Reproduciendo — Haz clic para abrir el panel de música.',
      system: '🖥 Sistema — Tu hardware de un vistazo.',
      notes: '📝 Notas — Haz clic para abrir notas y temporizador.',
      settings: '⚙️ Ajustes — Tema, idioma, modo de rendimiento y más.',
      actions: '⚡ Acciones — Controles rápidos del sistema.',
      clock: '🕐 Reloj — Haz clic para ver la hora en otras ciudades.',
    },
    gotIt: '¡Entendido!',
    artistThemeLabel: 'Tema de artista',
    photoRotationLabel: 'Rotación de foto',
    changelogEntries: [
      {
        ver: 'v4.0.0', date: 'Actual — JARVIS → F.R.I.D.A.Y.',
        items: [
          { type: 'add', text: '🤖 Renombrado: JARVIS → F.R.I.D.A.Y. (Female Replacement Intelligent Digital Assistant Youth)' },
          { type: 'add', text: '🎙 F.R.I.D.A.Y. AI — Asistente de voz en tiempo real con OpenAI Realtime API (WebRTC, gpt-4o-realtime-preview)' },
          { type: 'add', text: '🌀 Visualizador animado de 72 barras — responde al volumen del micrófono en tiempo real' },
          { type: 'add', text: '🚀 Comandos de protocolo: inicio / trabajo / juego / protocolo nocturno' },
          { type: 'add', text: '🧠 Memoria semántica — aprendizaje automático de conversaciones (categorías fact / preference)' },
          { type: 'add', text: '📝 Integración con Google Meet + plantilla de nota Obsidian .md + resumen de reunión con IA' },
          { type: 'add', text: '🔄 Tarjeta de traducción con IA — reemplaza la tarjeta de información del sistema (8 idiomas, auto-debounce)' },
          { type: 'add', text: '⏱ Temporizador separado en su propia tarjeta — Notas y Temporizador ahora son dos tarjetas lado a lado' },
          { type: 'add', text: '💤 Modo inactivo — tras 15 min sin actividad muestra reloj grande + métricas mini de CPU/RAM/GPU' },
          { type: 'fix', text: 'Comandos de voz de F.R.I.D.A.Y. desactivados en modo Eco' },
          { type: 'fix', text: 'Realtime API sigue la configuración de idioma de la app (whisper TR/EN/ES)' },
          { type: 'fix', text: 'Información del sistema movida al modal del gráfico de CPU' },
          { type: 'fix', text: 'Google Drive / Calendar accesible desde F.R.I.D.A.Y. AI' },
        ],
      },
      {
        ver: 'v3.2.0', date: 'Última versión de JARVIS',
        items: [
          { type: 'add', text: 'Soporte de idiomas: inglés, turco, español' },
          { type: 'add', text: 'Reloj mundial, herramientas de imagen, notas+temporizador, temas de artista (Madison / İcardi)' },
          { type: 'add', text: 'Primera integración de OpenAI Realtime API — completada en esta versión' },
        ],
      },
      {
        ver: 'v3.0.0', date: 'Lanzamiento inicial',
        items: [
          { type: 'add', text: 'Reescritura completa de Python/PyQt6 a Tauri + React + Rust' },
          { type: 'add', text: 'Integración con Spotify' },
          { type: 'add', text: 'CI/CD con GitHub Actions' },
        ],
      },
    ],
  },

export interface I18n {
  systemMonitor: string;
  settings: string;
  changelog: string;
  actions: string;
  notes: string;
  notesAdd: string;
  notesMore: (n: number) => string;
  noteAddBtn: string;
  nowPlaying: string;
  notPlaying: string;
  openSpotify: string;
  system: string;
  theme: string;
  light: string;
  dark: string;
  alwaysOnTop: string;
  on: string;
  off: string;
  performance: string;
  close: string;
  language: string;
  startWithWindows: string;
  quickNotes: string;
  notePlaceholder: string;
  update: string;
  add: string;
  cancel: string;
  edit: string;
  delete: string;
  noNotes: string;
  quickActions: string;
  restart: string;
  shutdown: string;
  sleep: string;
  confirmRestart: string;
  confirmShutdown: string;
  music: string;
  recentlyPlayed: string;
  visualizer: string;
  musicService: string;
  stats: string;
  demoMode: string;
  uptime: string;
  free: string;
  perfEcoInfo: string;
  perfNormalInfo: string;
  perfTurboInfo: string;
  topProcesses: string;
  ecoNoSpotify: string;
  premium: string;
  premiumTitle: string;
  timer: string;
  worldClock: string;
  searchCity: string;
  imageTools: string;
  firstRunTitle: string;
  firstRunDesc: string;
  tour: {
    cpu: string;
    network: string;
    disk: string;
    nowPlaying: string;
    system: string;
    notes: string;
    settings: string;
    actions: string;
    clock: string;
  };
  gotIt: string;
  artistThemeLabel: string;
  photoRotationLabel: string;
  changelogEntries: ReadonlyArray<{
    ver: string;
    date: string;
    items: ReadonlyArray<{ type: string; text: string }>;
  }>;
}

export type T = I18n;

// ── Settings persistence ──────────────────────────────────────────────────────

const SETTINGS_KEY = 'friday_settings_v1';

export interface Settings {
  darkTheme:        boolean;
  alwaysOnTop:      boolean;
  perfMode:         PerfMode;
  language:         Language;
  startWithWindows: boolean;
  tourSeen:         boolean;
  manualTheme:      'none' | 'madison' | 'icardi';
  photoRotation:    boolean;
}

export function loadSettings(): Settings {
  try { return { darkTheme: false, alwaysOnTop: false, perfMode: 'normal', language: 'en', startWithWindows: false, tourSeen: false, manualTheme: 'none', photoRotation: true, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { darkTheme: false, alwaysOnTop: false, perfMode: 'normal', language: 'en', startWithWindows: false, tourSeen: false, manualTheme: 'none', photoRotation: true }; }
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
  const [net,     setNet]     = useState({ dlSpeed:0, ulSpeed:0, totalRecvMb:0, totalSentMb:0, download_bytes:0, upload_bytes:0 });
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
        setNet({ dlSpeed: dl, ulSpeed: ul, totalRecvMb: n.total_recv_mb, totalSentMb: n.total_sent_mb, download_bytes: n.download_bytes, upload_bytes: n.upload_bytes });
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
            const STATS_KEY = 'friday_spotify_stats';
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
    if (settings.alwaysOnTop) {
      import('@tauri-apps/api/window').then(async ({ Window }) => { try { const w = await Window.getCurrent(); await w.setAlwaysOnTop(true); } catch {} });
    }
    return () => {
      if (fastId.current) clearInterval(fastId.current);
      if (slowId.current) clearInterval(slowId.current);
    };
  }, [settings.perfMode]);

  return { sys, net, spotify, procs, weather, sysInfo, isDemo, cpuHist, ramHist, gpuHist, netHist, settings, updateSettings };
}
