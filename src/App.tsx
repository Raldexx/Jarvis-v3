import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, BarChart2, Zap, Minus, Maximize2, X, Crown, Image, Clock } from 'lucide-react';
import { useSystemData, PERF_CONFIG, TRANSLATIONS, type PerfMode, type Language, type I18n } from '@/store/system';
import { Modal } from '@/components/ui/Modal';
import { MetricCard } from '@/components/MetricCard';
import { ChartModal } from '@/components/ChartModal';
import { SpotifyPanel } from '@/components/SpotifyPanel';
import { fmtSpeed, fmtTemp, fmtUptime, cn } from '@/lib/utils';
import { ICARDI_IMG, ICARDI_IMG2 } from '@/assets/icardi';
import { MADISON_IMG } from '@/assets/madison';

type ModalType = 'chart' | 'spotify' | 'settings' | 'stats' | 'actions' | 'changelog' | 'notes' | 'premium' | 'worldclock' | 'imagetools' | null;
type ChartKey = 'cpu' | 'ram' | 'gpu' | 'net' | 'disk';
type ArtistTheme = 'madison' | 'icardi' | null;

// ── Artist theme detection ────────────────────────────────────────────────────
function getArtistTheme(artist: string, track: string): ArtistTheme {
  const a = artist.toLowerCase();
  const t = track.toLowerCase();
  if (a.includes('madison beer')) return 'madison';
  if (a.includes('simge') || t.includes('aşkın olayım') || t.includes('icardi')) return 'icardi';
  return null;
}

// ── Theme config ──────────────────────────────────────────────────────────────
interface ThemeConfig {
  bg: string;
  accent: string;
  accentSoft: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textMuted: string;
  sparkline: string;
  nowPlayingColor: string;
  banner: string;
  bannerBg: string;
  bannerBorder: string;
  bannerText: string;
  photo: string;
  photo2?: string;
}

const THEME_CFG: Record<NonNullable<ArtistTheme>, ThemeConfig> = {
  madison: {
    bg:             'linear-gradient(160deg,#0d0018 0%,#1a0030 45%,#2d0a1a 100%)',
    accent:         '#e879f9',
    accentSoft:     '#a21caf',
    cardBg:         'rgba(10,0,20,0.18)',
    cardBorder:     'rgba(232,121,249,0.25)',
    textPrimary:    '#f5d0fe',
    textMuted:      'rgba(245,208,254,0.50)',
    sparkline:      '#e879f9',
    nowPlayingColor:'#e879f9',
    banner:         '💜 Madison Beer mode',
    bannerBg:       'rgba(168,85,247,0.15)',
    bannerBorder:   'rgba(168,85,247,0.30)',
    bannerText:     '#d8b4fe',
    photo:          MADISON_IMG,
  },
  icardi: {
    bg:             'linear-gradient(160deg,#0a0000 0%,#1f0400 38%,#2e0c00 70%,#1a0900 100%)',
    accent:         '#fbbf24',
    accentSoft:     '#dc2626',
    cardBg:         'rgba(15,3,0,0.18)',
    cardBorder:     'rgba(251,191,36,0.28)',
    textPrimary:    '#fef3c7',
    textMuted:      'rgba(254,243,199,0.50)',
    sparkline:      '#f59e0b',
    nowPlayingColor:'#fbbf24',
    banner:         '⚽ Galatasaray — İcardi #99',
    bannerBg:       'rgba(220,38,38,0.18)',
    bannerBorder:   'rgba(251,191,36,0.38)',
    bannerText:     '#fbbf24',
    photo:          ICARDI_IMG,  // will be randomised at runtime
    photo2:         ICARDI_IMG2,
  },
};

// ── Artist Background — only photo + dark veil, zero decorations ─────────────
function ArtistBackground({ theme, photo }: { theme: NonNullable<ArtistTheme>; photo: string }) {
  const cfg = THEME_CFG[theme];
  return (
    <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden', zIndex:0, borderRadius:'inherit' }}>
      {/* The real photo, full cover */}
      <img
        src={cfg.photo}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: theme === 'icardi' ? 'center 15%' : 'center 30%',
          opacity: 0.85,
          filter: 'brightness(0.70) saturate(1.0)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />
      {/* Single dark overlay so text stays readable — that's all */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'rgba(0,0,0,0.28)',
        pointerEvents: 'none',
      }} />
    </div>
  );
}

// ── Window controls ───────────────────────────────────────────────────────────
async function getWin() {
  const { Window } = await import('@tauri-apps/api/window');
  return Window.getCurrent();
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function useClock(lang: Language) {
  const [clock, setClock] = useState('--:--:--');
  useEffect(() => {
    const locale = lang === 'tr' ? 'tr-TR' : lang === 'es' ? 'es-ES' : 'en-GB';
    const id = setInterval(() => setClock(new Date().toLocaleTimeString(locale, { hour:'2-digit', minute:'2-digit', second:'2-digit' })), 1000);
    return () => clearInterval(id);
  }, [lang]);
  return clock;
}

// ── Notes ─────────────────────────────────────────────────────────────────────
interface Note { id: number; text: string; ts: number; }
function useNotes() {
  const [notes, setNotes] = useState<Note[]>(() => { try { return JSON.parse(localStorage.getItem('jarvis_notes') || '[]'); } catch { return []; } });
  const save = (ns: Note[]) => { setNotes(ns); localStorage.setItem('jarvis_notes', JSON.stringify(ns)); };
  return {
    notes,
    add: (text: string) => save([{ id: Date.now(), text, ts: Date.now() }, ...notes]),
    remove: (id: number) => save(notes.filter(n => n.id !== id)),
    update: (id: number, text: string) => save(notes.map(n => n.id === id ? { ...n, text, ts: Date.now() } : n)),
  };
}

// ── World Clock Modal ─────────────────────────────────────────────────────────
const WORLD_CITIES = [
  {name:'Istanbul',tz:'Europe/Istanbul'},{name:'London',tz:'Europe/London'},
  {name:'New York',tz:'America/New_York'},{name:'Los Angeles',tz:'America/Los_Angeles'},
  {name:'Tokyo',tz:'Asia/Tokyo'},{name:'Dubai',tz:'Asia/Dubai'},
  {name:'Paris',tz:'Europe/Paris'},{name:'Sydney',tz:'Australia/Sydney'},
  {name:'Berlin',tz:'Europe/Berlin'},{name:'Singapore',tz:'Asia/Singapore'},
  {name:'São Paulo',tz:'America/Sao_Paulo'},{name:'Mumbai',tz:'Asia/Kolkata'},
  {name:'Moscow',tz:'Europe/Moscow'},{name:'Beijing',tz:'Asia/Shanghai'},
  {name:'Cairo',tz:'Africa/Cairo'},{name:'Toronto',tz:'America/Toronto'},
  {name:'Chicago',tz:'America/Chicago'},{name:'Seoul',tz:'Asia/Seoul'},
  {name:'Amsterdam',tz:'Europe/Amsterdam'},{name:'Mexico City',tz:'America/Mexico_City'},
];

function WorldClockModal({ open, onClose, t, tc }: { open:boolean; onClose:()=>void; t:I18n; tc:ThemeConfig|null }) {
  const [search, setSearch] = useState('');
  const [, setTick] = useState(0);
  useEffect(() => { if (!open) return; const id = setInterval(()=>setTick(x=>x+1),1000); return()=>clearInterval(id); }, [open]);
  const filtered = WORLD_CITIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
  const getCityTime = (tz:string) => new Date().toLocaleTimeString('en-GB',{timeZone:tz,hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const getCityDate = (tz:string) => new Date().toLocaleDateString('en-GB',{timeZone:tz,day:'2-digit',month:'short'});
  return (
    <Modal open={open} onClose={onClose} title={t.worldClock} tc={tc}>
      <div className="mb-3 no-drag">
        <input className={cn('w-full px-3 py-2 rounded-xl border text-[12px] focus:outline-none transition-colors',
          tc ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-white/30'
             : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.08] dark:border-white/[0.1] text-[#1a1a1a] dark:text-[#e8e8ea] focus:border-blue-300 dark:focus:border-blue-700')}
          placeholder={t.searchCity} value={search} onChange={e=>setSearch(e.target.value)} />
      </div>
      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[360px]">
        {filtered.map(city => (
          <div key={city.tz} style={tc?{background:tc.cardBg,borderColor:tc.cardBorder}:undefined}
            className={cn('flex items-center justify-between px-3 py-2 rounded-xl border',
              !tc && 'bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.04] dark:border-white/[0.05]')}>
            <div>
              <div className="text-[12px] font-semibold" style={{color:tc?tc.textPrimary:undefined}}
                >{city.name}</div>
              <div className="text-[9px]" style={{color:tc?tc.textMuted:undefined}}
                ><span className={!tc?'text-black/30 dark:text-white/30':''}>{getCityDate(city.tz)}</span></div>
            </div>
            <div className="font-mono text-[14px] font-bold tabular-nums" style={{color:tc?tc.accent:undefined}}
              ><span className={!tc?'text-[#1a1a1a] dark:text-[#e8e8ea]':''}>{getCityTime(city.tz)}</span></div>
          </div>
        ))}
      </div>
      <button onClick={onClose} style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined}
        className={cn('mt-3 w-full py-2.5 rounded-xl text-[12px] font-semibold transition-colors',
          !tc && 'bg-black/[0.04] dark:bg-white/[0.06] text-black/40 dark:text-white/40 hover:bg-black/[0.07]')}>
        {t.close}
      </button>
    </Modal>
  );
}

// ── Image Tools Modal ────────────────────────────────────────────────────────
function ImageToolsModal({ open, onClose, tc }: { open:boolean; onClose:()=>void; tc:ThemeConfig|null }) {
  const [img, setImg]           = useState<string|null>(null);
  const [fileName, setFileName] = useState('');
  const [tab, setTab]           = useState<'edit'|'upscale'|'sort'>('edit');
  const [op, setOp]             = useState<string|null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast]     = useState(100);
  const [upscaleScale, setUpscaleScale] = useState(2);
  const [processing, setProcessing] = useState(false);
  // Sort state
  const [srcFolder, setSrcFolder]     = useState('');
  const [outFolder, setOutFolder]     = useState('');
  const [sortMode, setSortMode]       = useState<'copy'|'move'>('copy');
  const [sortStatus, setSortStatus]   = useState('');
  const [sortRunning, setSortRunning] = useState(false);
  const [pythonVer, setPythonVer]     = useState('');

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const v = await invoke<string>('check_python');
        setPythonVer(v || 'not_found');
      } catch { setPythonVer('not_found'); }
    })();
  }, [open]);

  function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    setFileName(f.name);
    const r = new FileReader();
    r.onload = ev => { setImg(ev.target?.result as string); setOp(null); };
    r.readAsDataURL(f);
  }

  function getFilter() {
    if (op==='grayscale') return 'grayscale(100%)';
    if (op==='invert')    return 'invert(100%)';
    if (op==='blur')      return 'blur(4px)';
    if (op==='sepia')     return 'sepia(100%)';
    if (op==='brightness') return `brightness(${brightness}%)`;
    if (op==='contrast')  return `contrast(${contrast}%)`;
    return 'none';
  }

  function download() {
    if (!img) return;
    const canvas = document.createElement('canvas');
    const image  = new window.Image();
    image.onload = () => {
      canvas.width=image.width; canvas.height=image.height;
      const ctx=canvas.getContext('2d')!; ctx.filter=getFilter(); ctx.drawImage(image,0,0);
      const a=document.createElement('a'); a.href=canvas.toDataURL('image/png');
      a.download='jarvis_'+fileName; a.click();
    };
    image.src = img;
  }

  async function doUpscale() {
    if (!img) return;
    setProcessing(true);
    await new Promise(r => setTimeout(r, 50));
    const image = new window.Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width  = image.width  * upscaleScale;
      canvas.height = image.height * upscaleScale;
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `upscaled_x${upscaleScale}_${fileName}`;
      a.click();
      setProcessing(false);
    };
    image.src = img;
  }

  async function pickFolder(setter: (v:string)=>void) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const path = await invoke<string>('open_folder_picker');
      if (path) setter(path);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('cancelled')) setSortStatus('❌ ' + msg);
    }
  }

  async function runSort() {
    if (!srcFolder) { setSortStatus('❌ Select source folder first'); return; }
    const out = outFolder || srcFolder + '\\Sorted';
    setSortRunning(true);
    setSortStatus('⏳ Sorting...');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<string>('sort_files', { folder: srcFolder, output: out, mode: sortMode });
      setSortStatus(result);
    } catch (e: unknown) {
      setSortStatus('❌ ' + (e instanceof Error ? e.message : String(e)));
    }
    setSortRunning(false);
  }

  async function launchCLI() {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<string>('open_image_tools_cli');
      setSortStatus('✅ ' + result);
    } catch (e: unknown) {
      setSortStatus('❌ ' + (e instanceof Error ? e.message : String(e)));
    }
  }

  // Shared styles
  const panelBg: React.CSSProperties  = tc ? { background:'rgba(255,255,255,0.05)', borderRadius:12, padding:10 } : { background:'rgba(0,0,0,0.03)', borderRadius:12, padding:10 };
  const inputCls = cn('w-full px-2.5 py-1.5 rounded-lg border text-[11px] focus:outline-none',
    tc ? 'bg-white/5 border-white/10 text-white placeholder-white/30' : 'bg-white dark:bg-[#1c1c1e] border-black/[0.08] dark:border-white/[0.1] text-[#1a1a1a] dark:text-[#e8e8ea]');
  const btnPrimary = cn('py-2 rounded-xl text-[11px] font-bold transition-all');
  const btnSec     = cn('py-1.5 rounded-lg text-[10px] font-semibold transition-all border');

  const tabActive  = tc ? { background: tc.accent, color: '#000' } : undefined;
  const tabInactive: React.CSSProperties = tc ? { background:'rgba(255,255,255,0.07)', color: tc.textMuted } : {};

  const editOps = [
    {key:'grayscale',label:'Grayscale',icon:'◑'},{key:'invert',label:'Invert',icon:'◎'},
    {key:'sepia',label:'Sepia',icon:'▩'},{key:'blur',label:'Blur',icon:'◌'},
    {key:'brightness',label:'Bright',icon:'☀'},{key:'contrast',label:'Contrast',icon:'◧'},
  ];

  return (
    <Modal open={open} onClose={onClose} title="IMAGE TOOLS" wide tc={tc}>
      {/* Tab bar */}
      <div className="flex gap-1 mb-3 no-drag p-1 rounded-xl" style={tc?{background:'rgba(255,255,255,0.06)'}:{background:'rgba(0,0,0,0.04)'}}>
        {(['edit','upscale','sort'] as const).map(t2=>(
          <button key={t2} onClick={()=>setTab(t2)}
            style={tab===t2 ? (tc?tabActive:{}) : (tc?tabInactive:{})}
            className={cn('flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all',
              !tc&&(tab===t2?'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]':'text-black/40 dark:text-white/40'))}>
            {t2==='edit'?'🎨 Edit':t2==='upscale'?'🔍 Upscale':'📂 Sort'}
          </button>
        ))}
      </div>

      {/* ── EDIT TAB ── */}
      {tab==='edit' && <>
        <label className={cn('flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed cursor-pointer mb-3 no-drag',
          tc?'border-white/15 hover:border-white/30':'border-black/[0.10] dark:border-white/[0.12] hover:bg-black/[0.02]')}>
          <Image size={14} style={tc?{color:tc.textMuted}:{}} className={!tc?'text-black/30 dark:text-white/30':''}/>
          <span className="text-[11px]" style={tc?{color:tc.textMuted}:{}}><span className={!tc?'text-black/40 dark:text-white/40':''}>{fileName||'Click to upload image'}</span></span>
          <input type="file" accept="image/*" className="hidden" onChange={loadFile}/>
        </label>
        {img && <>
          <div className="rounded-xl overflow-hidden flex items-center justify-center mb-3" style={{...panelBg, minHeight:130, maxHeight:200, padding:0}}>
            <img src={img} alt="preview" style={{maxHeight:195,maxWidth:'100%',filter:getFilter(),borderRadius:10,transition:'filter 0.25s'}}/>
          </div>
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {editOps.map(o=>(
              <button key={o.key} onClick={()=>setOp(prev=>prev===o.key?null:o.key)}
                style={op===o.key?(tc?{background:tc.accent,color:'#000',border:'none'}:undefined):(tc?{background:'rgba(255,255,255,0.07)',borderColor:'rgba(255,255,255,0.10)',color:tc.textMuted}:undefined)}
                className={cn(btnSec,!tc&&(op===o.key?'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a] border-transparent':'bg-black/[0.03] dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.06] text-black/50 dark:text-white/50'))}>
                {o.icon} {o.label}
              </button>
            ))}
          </div>
          {op==='brightness'&&<div className="flex items-center gap-2 mb-2 no-drag"><span className="text-[10px] w-14" style={tc?{color:tc.textMuted}:{}}><span className={!tc?'text-black/40 dark:text-white/40':''}>Bright</span></span><input type="range" min={0} max={200} value={brightness} onChange={e=>setBrightness(+e.target.value)} className="flex-1"/><span className="text-[10px] w-8 font-mono" style={tc?{color:tc.textMuted}:{}}>{brightness}%</span></div>}
          {op==='contrast'&&<div className="flex items-center gap-2 mb-2 no-drag"><span className="text-[10px] w-14" style={tc?{color:tc.textMuted}:{}}><span className={!tc?'text-black/40 dark:text-white/40':''}>Contrast</span></span><input type="range" min={0} max={200} value={contrast} onChange={e=>setContrast(+e.target.value)} className="flex-1"/><span className="text-[10px] w-8 font-mono" style={tc?{color:tc.textMuted}:{}}>{contrast}%</span></div>}
          <button onClick={download} style={tc?{background:tc.accent,color:'#000'}:undefined}
            className={cn(btnPrimary,'w-full',!tc&&'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]')}>
            ⬇ Download edited image
          </button>
        </>}
      </>}

      {/* ── UPSCALE TAB ── */}
      {tab==='upscale' && <div className="flex flex-col gap-3">
        <div className="text-[11px]" style={tc?{color:tc.textMuted}:{}}><span className={!tc?'text-black/50 dark:text-white/50':''}>Browser upscale (Lanczos-quality) — for Smart/Photo/Sharpen algorithms use the CLI below.</span></div>
        <label className={cn('flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed cursor-pointer no-drag',
          tc?'border-white/15 hover:border-white/30':'border-black/[0.10] dark:border-white/[0.12]')}>
          <Image size={14} style={tc?{color:tc.textMuted}:{}} className={!tc?'text-black/30':''}/>
          <span className="text-[11px]" style={tc?{color:tc.textMuted}:{}}><span className={!tc?'text-black/40 dark:text-white/40':''}>{fileName||'Click to upload image'}</span></span>
          <input type="file" accept="image/*" className="hidden" onChange={loadFile}/>
        </label>
        <div className="flex gap-2 no-drag">
          {[2,3,4].map(s=>(
            <button key={s} onClick={()=>setUpscaleScale(s)}
              style={upscaleScale===s?(tc?{background:tc.accent,color:'#000',border:'none'}:undefined):(tc?{background:'rgba(255,255,255,0.07)',borderColor:'rgba(255,255,255,0.10)',color:tc.textMuted}:undefined)}
              className={cn('flex-1 py-2 rounded-xl text-[13px] font-bold border transition-all',
                !tc&&(upscaleScale===s?'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a] border-transparent':'bg-black/[0.04] dark:bg-white/[0.06] border-black/[0.08] dark:border-white/[0.08] text-black/50 dark:text-white/50'))}>
              x{s}
            </button>
          ))}
        </div>
        <button onClick={doUpscale} disabled={!img||processing}
          style={!(!img||processing)&&tc?{background:tc.accent,color:'#000'}:undefined}
          className={cn(btnPrimary,'w-full',!tc&&'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]',(!img||processing)&&'opacity-40 cursor-not-allowed')}>
          {processing?'⏳ Processing...':`🔍 Upscale ×${upscaleScale} & Download`}
        </button>
        {/* CLI launcher */}
        <div style={panelBg}>
          <div className="text-[10px] font-bold mb-2" style={tc?{color:tc.accent}:{}}><span className={!tc?'text-black/50 dark:text-white/50':''}>Advanced CLI (Smart/Photo/Sharpen algorithms)</span></div>
          <div className="text-[10px] mb-2" style={tc?{color:tc.textMuted}:{}}><span className={!tc?'text-black/40 dark:text-white/40':''}>Python: <span className="font-mono">{pythonVer==='not_found'?'❌ Not found':pythonVer}</span></span></div>
          <button onClick={launchCLI}
            style={tc?{background:tc.accent,color:'#000'}:undefined}
            className={cn(btnPrimary,'w-full',!tc&&'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]')}>
            🚀 Launch image_upscaler.py in Terminal
          </button>
          {sortStatus&&<div className="mt-2 text-[10px]" style={tc?{color:tc.textMuted}:{}}>{sortStatus}</div>}
        </div>
      </div>}

      {/* ── SORT TAB ── */}
      {tab==='sort' && <div className="flex flex-col gap-3">
        <div className="text-[11px]" style={tc?{color:tc.textMuted}:{}}><span className={!tc?'text-black/50 dark:text-white/50':''}>Sorts files into folders by type (Images, Videos, Music, Documents, Code, Archives, Applications).</span></div>
        {/* Source folder */}
        <div>
          <div className="text-[9px] font-bold mb-1" style={tc?{color:tc.accent}:{}}><span className={!tc?'text-black/40 dark:text-white/40':''}>SOURCE FOLDER</span></div>
          <div className="flex gap-2 no-drag">
            <input value={srcFolder} onChange={e=>setSrcFolder(e.target.value)} placeholder="C:\Users\...\Downloads" className={cn(inputCls,'flex-1')}/>
            <button onClick={()=>pickFolder(setSrcFolder)}
              style={tc?{background:'rgba(255,255,255,0.10)',color:tc.textPrimary,border:'none'}:undefined}
              className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap',!tc&&'bg-black/[0.08] dark:bg-white/[0.10] text-[#333] dark:text-[#ccc] border border-black/[0.08] dark:border-white/[0.10]')}>
              Browse
            </button>
          </div>
        </div>
        {/* Output folder */}
        <div>
          <div className="text-[9px] font-bold mb-1" style={tc?{color:tc.accent}:{}}><span className={!tc?'text-black/40 dark:text-white/40':''}>OUTPUT FOLDER <span className="font-normal opacity-60">(optional — defaults to Sorted/ inside source)</span></span></div>
          <div className="flex gap-2 no-drag">
            <input value={outFolder} onChange={e=>setOutFolder(e.target.value)} placeholder="Leave empty for auto" className={cn(inputCls,'flex-1')}/>
            <button onClick={()=>pickFolder(setOutFolder)}
              style={tc?{background:'rgba(255,255,255,0.10)',color:tc.textPrimary,border:'none'}:undefined}
              className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap',!tc&&'bg-black/[0.08] dark:bg-white/[0.10] text-[#333] dark:text-[#ccc] border border-black/[0.08] dark:border-white/[0.10]')}>
              Browse
            </button>
          </div>
        </div>
        {/* Mode */}
        <div className="flex gap-2 no-drag">
          {(['copy','move'] as const).map(m=>(
            <button key={m} onClick={()=>setSortMode(m)}
              style={sortMode===m?(tc?{background:tc.accent,color:'#000',border:'none'}:undefined):(tc?{background:'rgba(255,255,255,0.07)',borderColor:'rgba(255,255,255,0.10)',color:tc.textMuted}:undefined)}
              className={cn('flex-1 py-1.5 rounded-xl text-[11px] font-semibold border transition-all',
                !tc&&(sortMode===m?'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a] border-transparent':'bg-black/[0.04] dark:bg-white/[0.06] border-black/[0.08] dark:border-white/[0.08] text-black/50 dark:text-white/50'))}>
              {m==='copy'?'📋 Copy':'✂️ Move'}
            </button>
          ))}
        </div>
        {/* Run */}
        <button onClick={runSort} disabled={sortRunning}
          style={!sortRunning&&tc?{background:tc.accent,color:'#000'}:undefined}
          className={cn(btnPrimary,'w-full',!tc&&'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]',sortRunning&&'opacity-60 cursor-not-allowed')}>
          {sortRunning?'⏳ Sorting files...':'📂 Sort Files Now'}
        </button>
        {sortStatus&&<div className="text-[11px] p-2.5 rounded-xl font-mono" style={tc?{background:'rgba(255,255,255,0.05)',color:tc.textMuted}:{background:'rgba(0,0,0,0.04)',color:'rgba(0,0,0,0.5)'}}>{sortStatus}</div>}
        {/* Advanced CLI */}
        <div style={panelBg}>
          <div className="text-[10px] font-bold mb-1" style={tc?{color:tc.accent}:{}}><span className={!tc?'text-black/50':''}>Full CLI (upscale + sort)</span></div>
          <button onClick={launchCLI} style={tc?{background:'rgba(255,255,255,0.10)',color:tc.textPrimary}:undefined}
            className={cn('w-full py-1.5 rounded-lg text-[10px] font-bold',!tc&&'bg-black/[0.06] dark:bg-white/[0.08] text-black/50 dark:text-white/50')}>
            🖥 Launch image_upscaler.py in Terminal
          </button>
        </div>
      </div>}

      <button onClick={onClose} style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined}
        className={cn('mt-3 w-full py-2 rounded-xl text-[12px] font-semibold transition-colors',!tc&&'bg-black/[0.04] dark:bg-white/[0.06] text-black/40 dark:text-white/40 hover:bg-black/[0.07]')}>
        Close
      </button>
    </Modal>
  );
}


// ── Premium Modal ─────────────────────────────────────────────────────────────
function PremiumModal({ open, onClose, t, tc }: { open:boolean; onClose:()=>void; t:I18n; tc:ThemeConfig|null }) {
  return (
    <Modal open={open} onClose={onClose} title={t.premiumTitle} tc={tc}>
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg">👑</div>
        <div className="text-center">
          <div className="text-[16px] font-extrabold mb-1" style={{color:tc?tc.textPrimary:undefined}}><span className={!tc?'text-[#1a1a1a] dark:text-[#e8e8ea]':''}>JARVIS Premium</span></div>
          <div className="text-[12px]" style={{color:tc?tc.textMuted:undefined}}><span className={!tc?'text-black/40 dark:text-white/40 max-w-[260px]':''}>Unlock advanced features: Spotify lyrics, custom themes, cloud sync and more.</span></div>
        </div>
        <div className="w-full rounded-2xl border p-4" style={tc?{background:'rgba(251,191,36,0.08)',borderColor:'rgba(251,191,36,0.25)'}:{background:'rgb(255,251,235)',borderColor:'rgb(253,230,138)'}}>
          <div className="text-[11px] font-bold mb-2 text-amber-600 dark:text-amber-400">Want Premium access?</div>
          <div className="text-[11px] text-amber-600 dark:text-amber-500">
            Contact on Discord:<br/>
            <span className="font-bold text-[15px] font-mono select-all text-amber-700 dark:text-amber-300">.raldexx</span>
          </div>
        </div>
        <div className="text-[10px] text-center" style={{color:tc?tc.textMuted:undefined}}><span className={!tc?'text-black/20 dark:text-white/20':''}>Premium is manually granted.<br/>Reach out with your username to get access.</span></div>
      </div>
      <button onClick={onClose} style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined}
        className={cn('mt-2 w-full py-2.5 rounded-xl text-[12px] font-semibold transition-colors',
          !tc && 'bg-black/[0.04] dark:bg-white/[0.06] text-black/40 dark:text-white/40 hover:bg-black/[0.07]')}>
        {t.close}
      </button>
    </Modal>
  );
}

// ── Tour Modal ────────────────────────────────────────────────────────────────
function TourModal({ open, onClose, t, tc }: { open:boolean; onClose:()=>void; t:I18n; tc:ThemeConfig|null }) {
  const [step, setStep] = useState(0);
  const steps = Object.values(t.tour);
  const isLast = step === steps.length - 1;
  return (
    <Modal open={open} onClose={onClose} title={t.firstRunTitle} tc={tc}>
      <div className="flex flex-col gap-4 py-1">
        <div className="text-[12px]" style={{color:tc?tc.textMuted:undefined}}><span className={!tc?'text-black/50 dark:text-white/50':''}>{t.firstRunDesc}</span></div>
        <div className="flex gap-1 justify-center">
          {steps.map((_,i) => (
            <div key={i} onClick={()=>setStep(i)}
              style={i===step&&tc?{background:tc.accent}:undefined}
              className={cn('h-1.5 rounded-full cursor-pointer transition-all',i===step?'w-5 '+(tc?'':'bg-blue-500'):'w-1.5 bg-black/10 dark:bg-white/10')} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}} transition={{duration:0.18}}
            className="rounded-2xl p-4 border min-h-[64px] flex items-center"
            style={tc?{background:tc.cardBg,borderColor:tc.cardBorder}:{background:'rgba(0,0,0,0.03)',borderColor:'rgba(0,0,0,0.05)'}}>
            <span className="text-[13px]" style={{color:tc?tc.textPrimary:undefined}}><span className={!tc?'text-[#1a1a1a] dark:text-[#e8e8ea]':''}>{steps[step]}</span></span>
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-2">
          {step > 0 && <button onClick={()=>setStep(s=>s-1)} style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined} className={cn('flex-1 py-2.5 rounded-xl text-[12px] font-semibold transition-colors',!tc&&'bg-black/[0.04] dark:bg-white/[0.06] text-black/40 dark:text-white/40')}>←</button>}
          <button onClick={()=>isLast?onClose():setStep(s=>s+1)}
            style={tc?{background:tc.accent,color:'#000'}:undefined}
            className={cn('flex-1 py-2.5 rounded-xl text-[12px] font-bold transition-opacity hover:opacity-90',!tc&&'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]')}>
            {isLast?t.gotIt:'→'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Notes + Timer Modal ───────────────────────────────────────────────────────
function NotesModal({ open, onClose, t, tc, notes, addNote, removeNote, updateNote }: {
  open:boolean; onClose:()=>void; t:I18n; tc:ThemeConfig|null;
  notes:Note[]; addNote:(s:string)=>void; removeNote:(id:number)=>void; updateNote:(id:number,s:string)=>void;
}) {
  const [noteInput, setNoteInput] = useState('');
  const [editId, setEditId]       = useState<number|null>(null);
  const [timerMode, setTimerMode] = useState<'up'|'down'>('up');
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerInput, setTimerInput] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);

  function fmtNoteTs(ts:number) {
    return new Date(ts).toLocaleDateString('en-GB',{day:'2-digit',month:'short'})+' '+new Date(ts).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
  }
  function fmtTime(s:number) {
    const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
    if(h>0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }
  useEffect(()=>{
    if(timerRunning){
      timerRef.current=setInterval(()=>setTimerSecs(s=>{
        if(timerMode==='up') return s+1;
        if(s<=1){ setTimerRunning(false); try{ if('Notification' in window&&Notification.permission==='granted'){new Notification('JARVIS Timer',{body:'Timer finished!'})}else alert('⏰ Timer finished!');}catch{}; return 0; }
        return s-1;
      }),1000);
    } else { if(timerRef.current) clearInterval(timerRef.current); }
    return ()=>{ if(timerRef.current) clearInterval(timerRef.current); };
  },[timerRunning,timerMode]);

  function startTimer(){ if(timerMode==='down') setTimerSecs(timerInput); else setTimerSecs(0); setTimerRunning(true); }
  function stopTimer(){ setTimerRunning(false); }
  function resetTimer(){ setTimerRunning(false); setTimerSecs(timerMode==='down'?timerInput:0); }

  const inputCls = cn('w-full px-3 py-2.5 rounded-xl border text-[12px] resize-none focus:outline-none transition-colors',
    tc ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-white/30'
       : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.08] dark:border-white/[0.1] text-[#1a1a1a] dark:text-[#e8e8ea] focus:border-blue-300 dark:focus:border-blue-700');

  return (
    <Modal open={open} onClose={()=>{onClose();setEditId(null);setNoteInput('');}} title={t.quickNotes} wide tc={tc}>
      <div className="grid grid-cols-2 gap-4">
        {/* LEFT — Notes */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 no-drag">
            <textarea className={inputCls} placeholder={t.notePlaceholder} rows={3} value={noteInput}
              onChange={e=>setNoteInput(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&e.ctrlKey){if(editId!==null){updateNote(editId,noteInput);setEditId(null);}else{addNote(noteInput);}setNoteInput('');}}} />
            <div className="flex gap-2 justify-end">
              {editId!==null&&<button onClick={()=>{setEditId(null);setNoteInput('');}} style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined} className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold',!tc&&'bg-black/[0.05] text-black/40')}>{t.cancel}</button>}
              <button onClick={()=>{if(!noteInput.trim())return;if(editId!==null){updateNote(editId,noteInput);setEditId(null);}else{addNote(noteInput);}setNoteInput('');}}
                style={tc?{background:tc.accent,color:'#000'}:undefined}
                className={cn('px-4 py-1.5 rounded-lg text-[11px] font-bold',!tc&&'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]')}>
                {editId!==null?t.update:t.add}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[230px]">
            {notes.length===0
              ? <div className="text-center py-6 text-[12px]" style={{color:tc?tc.textMuted:undefined}}><span className={!tc?'text-black/20 dark:text-white/20':''}>{t.noNotes}</span></div>
              : notes.map(n=>(
                <div key={n.id} className="rounded-xl border p-2.5"
                  style={tc?{background:editId===n.id?'rgba(255,255,255,0.08)':tc.cardBg,borderColor:editId===n.id?tc.accent:tc.cardBorder}:undefined}>
                  <div className="text-[12px] whitespace-pre-wrap break-words mb-1.5" style={{color:tc?tc.textPrimary:undefined}}><span className={!tc?'text-[#1a1a1a] dark:text-[#e8e8ea]':''}>{n.text}</span></div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px]" style={{color:tc?tc.textMuted:undefined}}><span className={!tc?'text-black/20 dark:text-white/20':''}>{fmtNoteTs(n.ts)}</span></span>
                    <div className="flex gap-1.5">
                      <button onClick={()=>{setEditId(n.id);setNoteInput(n.text);}} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500">{t.edit}</button>
                      <button onClick={()=>removeNote(n.id)} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-400">{t.delete}</button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
        {/* RIGHT — Timer */}
        <div className="flex flex-col gap-3">
          <div className="text-[9px] font-bold tracking-[0.12em]" style={{color:tc?tc.accent:undefined,textShadow:tc?'0 1px 5px rgba(0,0,0,0.9)':undefined}}><span className={!tc?'text-black/30 dark:text-white/30':''}>{t.timer.toUpperCase()}</span></div>
          <div className="flex gap-1 no-drag">
            {(['up','down'] as const).map(m=>(
              <button key={m} onClick={()=>{setTimerMode(m);resetTimer();}}
                style={timerMode===m&&tc?{background:tc.accent,color:'#000'}:tc?{background:tc.cardBg,borderColor:tc.cardBorder,color:tc.textMuted}:undefined}
                className={cn('flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all border',
                  !tc&&(timerMode===m?'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a] border-transparent':'bg-black/[0.04] dark:bg-white/[0.06] text-black/40 dark:text-white/40 border-transparent'))}>
                {m==='up'?'▲ Up':'▼ Down'}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center py-5 rounded-2xl border" style={tc?{background:tc.cardBg,borderColor:tc.cardBorder}:{background:'rgba(0,0,0,0.03)',borderColor:'rgba(0,0,0,0.05)'}}>
            <span className="font-mono text-[36px] font-extrabold tabular-nums" style={{color:tc?tc.textPrimary:undefined}}><span className={!tc?'text-[#1a1a1a] dark:text-[#e8e8ea]':''}>{fmtTime(timerSecs)}</span></span>
          </div>
          {timerMode==='down'&&!timerRunning&&(
            <div className="flex items-center gap-2 no-drag">
              <span className="text-[10px] w-16" style={{color:tc?tc.textMuted:undefined}}><span className={!tc?'text-black/40 dark:text-white/40':''}>Sec</span></span>
              <input type="number" min={1} max={86400} value={timerInput} onChange={e=>setTimerInput(Math.max(1,+e.target.value))}
                className={cn('flex-1 px-2 py-1 rounded-lg border font-mono text-[12px] focus:outline-none',
                  tc?'bg-white/5 border-white/10 text-white':'border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1c1c1e] text-[#1a1a1a] dark:text-[#e8e8ea]')} />
            </div>
          )}
          <div className="flex gap-2 no-drag">
            {!timerRunning
              ? <button onClick={startTimer} style={tc?{background:tc.accent,color:'#000'}:undefined} className={cn('flex-1 py-2 rounded-xl text-[12px] font-bold',!tc&&'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]')}>▶ Start</button>
              : <button onClick={stopTimer} className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-[12px] font-bold">⏸ Pause</button>}
            <button onClick={resetTimer} style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined} className={cn('flex-1 py-2 rounded-xl text-[12px] font-semibold',!tc&&'bg-black/[0.04] dark:bg-white/[0.06] text-black/40 dark:text-white/40')}>↺ Reset</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { sys, net, spotify, procs, weather, sysInfo, isDemo, cpuHist, ramHist, gpuHist, netHist, settings, updateSettings } = useSystemData();
  const t: I18n = TRANSLATIONS[settings.language];
  const clock = useClock(settings.language);
  const { notes, add: addNote, remove: removeNote, update: updateNote } = useNotes();

  const [modal, setModal] = useState<ModalType>(null);
  const [chartKey, setChartKey] = useState<ChartKey|null>(null);
  const [showTour, setShowTour] = useState(false);

  // Theme: manual override from settings, or auto-detected from playing track
  const autoTheme: ArtistTheme = spotify.playing ? getArtistTheme(spotify.artist, spotify.track) : null;
  const artistTheme: ArtistTheme = settings.manualTheme !== 'none' ? settings.manualTheme : autoTheme;

  // Randomise Icardi photo (pick one on mount, re-pick when theme activates)
  const iciPhotoRef = useRef<string>(Math.random() < 0.5 ? ICARDI_IMG : ICARDI_IMG2);
  useEffect(() => {
    if (artistTheme === 'icardi') {
      iciPhotoRef.current = Math.random() < 0.5 ? ICARDI_IMG : ICARDI_IMG2;
    }
  }, [artistTheme]);
  const tc: ThemeConfig|null = artistTheme ? THEME_CFG[artistTheme] : null;

  useEffect(() => { document.documentElement.classList.toggle('dark', settings.darkTheme); }, [settings.darkTheme]);
  useEffect(() => { if (!settings.tourSeen) { const timer = setTimeout(()=>setShowTour(true),800); return ()=>clearTimeout(timer); } }, []);

  function closeTour() { setShowTour(false); updateSettings({ tourSeen: true }); }
  function openChart(key: ChartKey) { setChartKey(key); setModal('chart'); }

  const perfCfg = PERF_CONFIG[settings.perfMode];
  const appStyle: React.CSSProperties = tc ? { background: tc.bg } : {};
  const bgClass = tc ? '' : 'bg-[#f5f5f7] dark:bg-[#111113]';

  // Card style helper
  const cardStyle = (extra?: React.CSSProperties): React.CSSProperties => tc
    ? { background: tc.cardBg, borderColor: tc.cardBorder, backdropFilter:'blur(2px)', WebkitBackdropFilter:'blur(2px)', ...extra }
    : (extra || {});
  const txt  = (opacity?: string): React.CSSProperties => tc ? { color: opacity ? `rgba(${hexToRgb(tc.textPrimary)},${opacity})` : tc.textPrimary } : {};
  const muted = (): React.CSSProperties => tc ? { color: tc.textMuted, textShadow:'0 1px 6px rgba(0,0,0,0.85)' } : {};

  function hexToRgb(hex: string): string {
    const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return r?`${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)}`:'255,255,255';
  }

  const btnBase = cn('flex flex-col items-center gap-1 py-2.5 rounded-2xl text-[9px] font-bold tracking-[0.05em] transition-all duration-150 border');
  const cardCls = cn('rounded-2xl border p-3.5 transition-all duration-150', !tc&&'bg-white dark:bg-[#1c1c1e] border-black/[0.06] dark:border-white/[0.07]');
  const clickCardCls = cn(cardCls, 'cursor-pointer', !tc&&'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]', tc&&'hover:opacity-90');

  return (
    <div
      className={cn('jarvis-root font-sans', bgClass)}
      style={appStyle}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.no-drag, button, input, textarea, select, a')) return;
        // Only start dragging after mouse moves (threshold), so clicks still fire
        const startX = e.clientX;
        const startY = e.clientY;
        let dragging = false;
        const onMove = async (me: MouseEvent) => {
          if (!dragging && (Math.abs(me.clientX - startX) > 4 || Math.abs(me.clientY - startY) > 4)) {
            dragging = true;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            try { const { Window } = await import('@tauri-apps/api/window'); (await Window.getCurrent()).startDragging(); } catch {}
          }
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      }}
    >
      {tc && <ArtistBackground theme={artistTheme!} photo={artistTheme==='icardi' ? iciPhotoRef.current : THEME_CFG['madison'].photo} />}

      {/* Scrollable content layer */}
      <div className="jarvis-scroll">

        {/* ═══ HEADER ═══ */}
        <div style={cardStyle()} className={cn(cardCls,'flex items-center justify-between px-4 py-3.5')}>
          <div>
            <div className="text-[9px] font-bold tracking-[0.18em]" style={muted()}><span className={!tc?'text-black/25 dark:text-white/25':''}>{t.systemMonitor}</span></div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[20px] font-extrabold tracking-tight" style={tc?{color:tc.textPrimary}:{}}>
                <span className={!tc?'text-[#1a1a1a] dark:text-[#e8e8ea]':''}>JARVIS</span>
                <span className="text-[13px] font-normal ml-1" style={muted()}><span className={!tc?'text-black/20 dark:text-white/20':''}>v3.2</span></span>
              </span>
              <AnimatePresence mode="wait">
                <motion.div key={settings.perfMode}
                  initial={{opacity:0,x:-8,scale:0.85}} animate={{opacity:1,x:0,scale:1}} exit={{opacity:0,x:-8,scale:0.85}}
                  transition={{type:'spring',stiffness:400,damping:20}}
                  className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold',
                    !tc && settings.perfMode==='eco'    && 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
                    !tc && settings.perfMode==='normal' && 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
                    !tc && settings.perfMode==='turbo'  && 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 animate-pulse2',
                  )}
                  style={tc?{background:'rgba(255,255,255,0.10)',color:tc.accent}:{}}>
                  <span>{perfCfg.icon}</span><span>{perfCfg.label}</span>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <button className="text-[13px] font-bold font-mono tabular-nums no-drag hover:opacity-70 transition-opacity flex items-center gap-1"
              style={tc?{color:tc.textPrimary}:{}} onClick={()=>setModal('worldclock')}>
              <Clock size={10} className={!tc?'text-black/30 dark:text-white/30 opacity-60':''} style={tc?{color:tc.textMuted}:{}}/>
              <span className={!tc?'text-[#1a1a1a] dark:text-[#e8e8ea]':''}>{clock}</span>
            </button>
            <div className="text-[10px]" style={muted()}><span className={!tc?'text-black/30 dark:text-white/30':''}>⏱ {fmtUptime(sys.uptime_secs)}</span></div>
            <div className="text-[10px]" style={muted()}><span className={!tc?'text-black/30 dark:text-white/30':''}>🌤 {weather}</span></div>
            <div className="flex gap-1 no-drag mt-0.5">
              {[
                {icon:<Minus size={8}/>, action:()=>getWin().then(w=>w.minimize())},
                {icon:<Maximize2 size={8}/>, action:()=>getWin().then(w=>w.isMaximized().then(m=>m?w.unmaximize():w.maximize()))},
                {icon:<X size={8}/>, action:()=>getWin().then(w=>w.close()), close:true},
              ].map((btn,i)=>(
                <button key={i} onClick={btn.action}
                  className={cn('w-5 h-5 rounded-full flex items-center justify-center transition-colors',
                    btn.close ? 'bg-black/05 dark:bg-white/08 text-black/30 dark:text-white/30 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500'
                              : 'bg-black/05 dark:bg-white/08 text-black/30 dark:text-white/30 hover:bg-black/10 dark:hover:bg-white/15')}
                  style={tc?{background:'rgba(255,255,255,0.08)',color:tc.textMuted}:{}}>{btn.icon}</button>
              ))}
            </div>
          </div>
        </div>

        {isDemo && <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 text-center">{t.demoMode}</div>}


        {/* ═══ CPU + RAM ═══ */}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="CPU" value={`${Math.round(sys.cpu_percent)}%`} sub={`${fmtTemp(sys.cpu_temp)} · load`} color="#3b82f6" history={cpuHist} onClick={()=>openChart('cpu')} tc={tc} />
          <MetricCard label="RAM" value={`${Math.round(sys.ram_percent)}%`} sub={`${sys.ram_used_gb.toFixed(1)} / ${sys.ram_total_gb.toFixed(1)} GB`} color="#8b5cf6" history={ramHist} onClick={()=>openChart('ram')} tc={tc} />
        </div>

        {/* ═══ GPU + NETWORK ═══ */}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="GPU" value={`${Math.round(0)}%`} sub={fmtTemp(sys.gpu_temp)} color="#f59e0b" history={gpuHist} onClick={()=>openChart('gpu')} tc={tc} />
          <MetricCard label="NETWORK" value={fmtSpeed(net.dlSpeed)} sub={`↑ ${fmtSpeed(net.ulSpeed)}`} color="#10b981" history={netHist} onClick={()=>openChart('net')} tc={tc} />
        </div>

        {/* ═══ DISK + NOW PLAYING ═══ */}
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="DISK" value={`${Math.round(sys.disk_percent)}%`} sub={`${sys.disk_free_gb.toFixed(0)} GB ${t.free}`} color="#6b7280" history={Array(60).fill(sys.disk_percent)} onClick={()=>openChart('disk')} tc={tc}>
            <div className="h-[3px] rounded-full overflow-hidden mt-1" style={{background:tc?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)'}}>
              <div className="h-full rounded-full transition-all duration-500" style={{width:`${sys.disk_percent}%`,background:tc?tc.sparkline:'#6b7280'}} />
            </div>
          </MetricCard>
          <div style={cardStyle()} className={cn(clickCardCls,'relative flex flex-col gap-1.5')} onClick={()=>setModal('spotify')}>
            <div className="text-[9px] font-bold tracking-[0.12em]" style={{color:tc?tc.nowPlayingColor:'#1DB954'}}>{t.nowPlaying}</div>
            <div className="text-[14px] font-bold truncate" style={tc?{color:tc.textPrimary}:{}}><span className={!tc?'text-[#1a1a1a] dark:text-[#e8e8ea]':''}>{settings.perfMode==='eco'?t.ecoNoSpotify:(spotify.playing?spotify.track:t.notPlaying)}</span></div>
            {spotify.artist&&settings.perfMode!=='eco'&&<div className="text-[10px] truncate" style={muted()}><span className={!tc?'text-black/30 dark:text-white/30':''}>{spotify.artist}</span></div>}
            <div className="absolute top-3 right-3 text-[10px] font-bold" style={muted()}><span className={!tc?'text-black/20 dark:text-white/20':''}>↗</span></div>
            <div className="flex items-end gap-[2px] h-5 mt-auto">
              {Array(12).fill(0).map((_,i)=>(
                <div key={i} className="flex-1 rounded-[2px_2px_0_0]"
                  style={{background:tc?tc.nowPlayingColor:'#1DB954',height:(spotify.playing&&settings.perfMode!=='eco')?`${4+Math.random()*14}px`:'3px',opacity:0.6,transition:'height 0.3s'}} />
              ))}
            </div>
          </div>
        </div>

        {/* ═══ SYSTEM + TOP PROCESSES ═══ */}
        <div className="grid grid-cols-2 gap-2">
          <div style={cardStyle()} className={cardCls}>
            <div className="text-[9px] font-bold tracking-[0.14em] mb-2" style={{color:tc?tc.accent:undefined,textShadow:tc?'0 1px 5px rgba(0,0,0,0.9)':undefined}}><span className={!tc?'text-black/30 dark:text-white/30':''}>{t.system}</span></div>
            <div className="flex flex-col gap-1.5">
              {[['CPU',sysInfo.cpu_name.length>20?sysInfo.cpu_name.slice(0,20)+'…':sysInfo.cpu_name],['Cores',sysInfo.cpu_cores>0?String(sysInfo.cpu_cores):'...'],['RAM',sysInfo.ram_total_gb>0?`${sysInfo.ram_total_gb.toFixed(0)} GB`:'...'],['OS',`${sysInfo.os_name} ${sysInfo.os_version}`.trim()],['Host',sysInfo.hostname]].map(([k,v])=>(
                <div key={k} className="flex justify-between border-b pb-1.5 last:border-0 last:pb-0" style={tc?{borderColor:'rgba(255,255,255,0.05)'}:{borderColor:'rgba(0,0,0,0.04)'}}>
                  <span className="text-[9px] font-bold tracking-[0.1em]" style={muted()}><span className={!tc?'text-black/25 dark:text-white/25':''}>{k}</span></span>
                  <span className="text-[10px] font-semibold max-w-[110px] truncate text-right" style={tc?{color:tc.textPrimary,textShadow:'0 1px 6px rgba(0,0,0,0.9)'}:{}}><span className={!tc?'text-[#333] dark:text-[#ccc]':''}>{v}</span></span>
                </div>
              ))}
            </div>
          </div>
          <div style={cardStyle()} className={cardCls}>
            <div className="text-[9px] font-bold tracking-[0.14em] mb-2" style={{color:tc?tc.accent:undefined,textShadow:tc?'0 1px 5px rgba(0,0,0,0.9)':undefined}}><span className={!tc?'text-black/30 dark:text-white/30':''}>{t.topProcesses}</span></div>
            <div className="flex flex-col gap-1.5">
              {procs.length===0
                ? <div className="text-[10px] py-2" style={muted()}><span className={!tc?'text-black/20 dark:text-white/20':''}>No data</span></div>
                : procs.slice(0,5).map(p=>(
                  <div key={p.pid} className="flex items-center gap-2 border-b pb-1.5 last:border-0 last:pb-0" style={tc?{borderColor:'rgba(255,255,255,0.05)'}:{borderColor:'rgba(0,0,0,0.04)'}}>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold truncate" style={tc?{color:tc.textPrimary}:{}}><span className={!tc?'text-[#333] dark:text-[#ccc]':''}>{p.name}</span></div>
                      <div className="h-[2px] rounded-full mt-0.5 overflow-hidden" style={{background:tc?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.05)'}}>
                        <div className="h-full rounded-full transition-all duration-300" style={{width:`${Math.min(100,p.cpu_percent)}%`,background:tc?tc.sparkline:'#3b82f6'}} />
                      </div>
                    </div>
                    <span className="text-[9px] font-mono flex-shrink-0" style={muted()}><span className={!tc?'text-black/30 dark:text-white/30':''}>{p.cpu_percent.toFixed(1)}%</span></span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* ═══ NOTES preview ═══ */}
        <div style={cardStyle()} className={cn(clickCardCls,'relative flex flex-col gap-1.5')} onClick={()=>setModal('notes')}>
          <div className="flex items-center justify-between">
            <div className="text-[9px] font-bold tracking-[0.14em]" style={{color:tc?tc.accent:undefined,textShadow:tc?'0 1px 5px rgba(0,0,0,0.9)':undefined}}><span className={!tc?'text-black/30 dark:text-white/30':''}>{t.notes}</span></div>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={tc?{background:'rgba(255,255,255,0.08)',color:tc.textMuted}:{background:'rgba(0,0,0,0.05)',color:'rgba(0,0,0,0.3)'}}>{notes.length}</span>
          </div>
          {notes.length===0
            ? <div className="text-[11px] flex-1 flex items-center" style={muted()}><span className={!tc?'text-black/20 dark:text-white/20':''}>{t.notesAdd}</span></div>
            : <div className="flex flex-col gap-1 flex-1">
                {notes.slice(0,3).map(n=>(
                  <div key={n.id} className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full flex-shrink-0" style={{background:tc?tc.accent:'#60a5fa'}} />
                    <span className="text-[10px] truncate" style={muted()}><span className={!tc?'text-[#555] dark:text-[#999]':''}>{n.text.length>30?n.text.slice(0,30)+'…':n.text}</span></span>
                  </div>
                ))}
                {notes.length>3&&<div className="text-[9px] pl-2.5" style={muted()}><span className={!tc?'text-black/20 dark:text-white/20':''}>{t.notesMore(notes.length-3)}</span></div>}
              </div>
          }
          <div className="text-[9px] mt-auto" style={muted()}><span className={!tc?'text-black/15 dark:text-white/15':''}>{t.noteAddBtn}</span></div>
          <div className="absolute top-3 right-3 text-[10px] font-bold" style={muted()}><span className={!tc?'text-black/20 dark:text-white/20':''}>↗</span></div>
        </div>

        {/* ═══ BOTTOM BUTTONS ═══ */}
        <div className="grid grid-cols-4 gap-2 no-drag">
          {[
            {icon:<Settings size={14}/>,  label:t.settings,  action:()=>setModal('settings')},
            {icon:<BarChart2 size={14}/>, label:t.changelog, action:()=>setModal('changelog')},
            {icon:<Image size={14}/>,     label:t.imageTools, action:()=>setModal('imagetools')},
            {icon:<Crown size={14}/>,     label:t.premium,    action:()=>setModal('premium'), gold:true},
          ].map(({icon,label,action,gold})=>(
            <button key={label} onClick={action}
              style={!gold&&tc?{background:tc.cardBg,borderColor:tc.cardBorder,color:tc.textMuted}:undefined}
              className={cn(btnBase,
                gold ? 'bg-gradient-to-b from-amber-400 to-orange-500 text-white border-amber-300 hover:opacity-90'
                     : !tc ? 'bg-white dark:bg-[#1c1c1e] text-black/40 dark:text-white/40 border-black/[0.07] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
                           : 'hover:opacity-80')}>
              {icon}{label}
            </button>
          ))}
        </div>
        <button onClick={()=>setModal('actions')}
          style={tc?{background:tc.cardBg,borderColor:tc.cardBorder,color:tc.textPrimary}:undefined}
          className={cn('w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-bold tracking-[0.06em] transition-all duration-150 border no-drag',
            !tc&&'bg-white dark:bg-[#1c1c1e] text-black/50 dark:text-white/50 border-black/[0.07] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.05]',
            tc&&'hover:opacity-80')}>
          <Zap size={14}/>{t.actions}
        </button>

        {/* ═══ MODALS ═══ */}
        <ChartModal open={modal==='chart'} onClose={()=>setModal(null)} chartKey={chartKey} sys={sys} net={net} sysInfo={sysInfo} cpuHist={cpuHist} ramHist={ramHist} gpuHist={gpuHist} netHist={netHist} />
        <SpotifyPanel open={modal==='spotify'} onClose={()=>setModal(null)} spotify={spotify} t={t} isEco={settings.perfMode==='eco'} tc={tc} />

        {/* Settings */}
        <Modal open={modal==='settings'} onClose={()=>setModal(null)} title="SETTINGS" tc={tc}>
          <div className="flex flex-col gap-0 divide-y" style={tc?{borderColor:'rgba(255,255,255,0.06)'}:{}}>
            {[
              {label:t.theme, ctrl:(
                <div className="flex gap-1 no-drag">
                  {(['false','true'] as const).map((v,i)=>(
                    <button key={v} onClick={()=>updateSettings({darkTheme:i===1})}
                      style={settings.darkTheme===(i===1)&&tc?{background:tc.accent,color:'#000'}:tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined}
                      className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                        !tc&&(settings.darkTheme===(i===1)?'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]':'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'))}>
                      {i===0?t.light:t.dark}
                    </button>
                  ))}
                </div>
              )},
              {label:t.language, ctrl:(
                <div className="flex gap-1 no-drag">
                  {(['en','tr','es'] as Language[]).map(l=>(
                    <button key={l} onClick={()=>updateSettings({language:l})}
                      style={settings.language===l&&tc?{background:tc.accent,color:'#000'}:tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined}
                      className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                        !tc&&(settings.language===l?'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]':'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'))}>
                      {{'en':'🇬🇧 EN','tr':'🇹🇷 TR','es':'🇪🇸 ES'}[l]}
                    </button>
                  ))}
                </div>
              )},
              {label:t.alwaysOnTop, ctrl:(
                <div className="flex gap-1 no-drag">
                  {[true,false].map(v=>(
                    <button key={String(v)} onClick={async()=>{updateSettings({alwaysOnTop:v});try{(await getWin()).setAlwaysOnTop(v);}catch{}}}
                      style={settings.alwaysOnTop===v&&tc?{background:tc.accent,color:'#000'}:tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined}
                      className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                        !tc&&(settings.alwaysOnTop===v?'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]':'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'))}>
                      {v?t.on:t.off}
                    </button>
                  ))}
                </div>
              )},
              {label:t.startWithWindows, ctrl:(
                <div className="flex gap-1 no-drag">
                  {[true,false].map(v=>(
                    <button key={String(v)} onClick={()=>updateSettings({startWithWindows:v})}
                      style={settings.startWithWindows===v&&tc?{background:tc.accent,color:'#000'}:tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined}
                      className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                        !tc&&(settings.startWithWindows===v?'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]':'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'))}>
                      {v?t.on:t.off}
                    </button>
                  ))}
                </div>
              )},
              {label:t.performance, ctrl:(
                <div className="flex gap-1 no-drag">
                  {(['eco','normal','turbo'] as PerfMode[]).map(m=>(
                    <button key={m} onClick={()=>updateSettings({perfMode:m})}
                      style={settings.perfMode===m&&tc?{background:tc.accent,color:'#000'}:tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined}
                      className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                        !tc&&(settings.perfMode===m?'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]':'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'))}>
                      {PERF_CONFIG[m].icon} {PERF_CONFIG[m].label}
                    </button>
                  ))}
                </div>
              )},
              {label: settings.language==='tr'?'Tema':'Theme', ctrl:(
                <div className="flex gap-1 no-drag">
                  {([['none','⬜ Off'],['icardi','⚽ İcardi'],['madison','💜 Madison']] as const).map(([v,lbl])=>(
                    <button key={v}
                      onClick={()=>updateSettings({manualTheme: v as 'none'|'madison'|'icardi'})}
                      style={settings.manualTheme===v&&tc?{background:tc.accent,color:'#000'}:tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined}
                      className={cn('px-2 py-1.5 rounded-lg text-[10px] font-semibold transition-all',
                        !tc&&(settings.manualTheme===v?'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]':'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'))}>
                      {lbl}
                    </button>
                  ))}
                </div>
              )},
            ].map(row=>(
              <div key={row.label} className={cn('flex items-center justify-between py-3',!tc&&'divide-black/[0.05] dark:divide-white/[0.06]')}>
                <span className="text-[12px]" style={tc?{color:tc.textPrimary}:{}}><span className={!tc?'text-[#555] dark:text-[#aaa]':''}>{row.label}</span></span>
                {row.ctrl}
              </div>
            ))}
            <div className="pt-3 text-[10px] rounded-xl px-3 py-2.5" style={tc?{background:'rgba(255,255,255,0.05)',color:tc.textMuted}:{background:'rgba(0,0,0,0.02)',color:'rgba(0,0,0,0.3)'}}>
              {{'eco':t.perfEcoInfo,'normal':t.perfNormalInfo,'turbo':t.perfTurboInfo}[settings.perfMode]}
            </div>
            <div className="pt-3">
              <button onClick={()=>{setModal(null);setShowTour(true);}} className="w-full py-2 rounded-xl text-[11px] font-semibold bg-blue-50 dark:bg-blue-900/20 text-blue-500 hover:bg-blue-100 transition-colors">
                🗺 {settings.language==='tr'?'Özellik turunu tekrar göster':settings.language==='es'?'Repetir tour de funciones':'Show feature tour again'}
              </button>
            </div>
          </div>
          <button onClick={()=>setModal(null)} style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined}
            className={cn('mt-4 w-full py-2.5 rounded-xl text-[12px] font-semibold transition-colors',!tc&&'bg-black/[0.04] dark:bg-white/[0.06] text-black/40 dark:text-white/40 hover:bg-black/[0.07]')}>
            {t.close}
          </button>
        </Modal>

        {/* Notes + Timer */}
        <NotesModal open={modal==='notes'} onClose={()=>setModal(null)} t={t} tc={tc} notes={notes} addNote={addNote} removeNote={removeNote} updateNote={updateNote} />

        {/* Actions */}
        <Modal open={modal==='actions'} onClose={()=>setModal(null)} title={t.quickActions} tc={tc}>
          <div className="flex flex-col gap-2">
            {[{label:t.restart,cmd:'restart'},{label:t.shutdown,cmd:'shutdown'},{label:t.sleep,cmd:'sleep'}].map(({label,cmd})=>(
              <button key={cmd} onClick={async()=>{
                const confirmMsg = cmd==='restart'?t.confirmRestart:cmd==='shutdown'?t.confirmShutdown:null;
                if(confirmMsg&&!confirm(confirmMsg)) return;
                const {invoke}=await import('@tauri-apps/api/core'); invoke('system_action',{action:cmd}).catch(()=>{});
              }}
                style={tc?{background:tc.cardBg,borderColor:tc.cardBorder,color:tc.textPrimary}:undefined}
                className={cn('px-4 py-3 rounded-xl border text-[12px] font-semibold text-left transition-colors',
                  !tc&&'bg-black/[0.03] dark:bg-white/[0.04] border-black/[0.05] dark:border-white/[0.06] text-[#333] dark:text-[#ccc] hover:bg-black/[0.06] dark:hover:bg-white/[0.08]',
                  tc&&'hover:opacity-80')}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={()=>setModal(null)} className="mt-3 w-full py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-[12px] font-semibold text-red-400 hover:bg-red-100 transition-colors">✕ {t.close}</button>
        </Modal>

        {/* Changelog */}
        <Modal open={modal==='changelog'} onClose={()=>setModal(null)} title="CHANGELOG" tc={tc}>
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[420px]">
            {[
              {ver:'v3.2.0',date:'Current',items:[
                {type:'add',text:t.changelog==='Changelog'?'Language support: English, Turkish, Spanish':'Dil desteği: İngilizce, Türkçe, İspanyolca'},
                {type:'add',text:'World Clock — click header clock'},
                {type:'add',text:'Image Tools: edit, upscale, sort (+ image-tools-box CLI)'},
                {type:'add',text:'Premium section — contact .raldexx on Discord'},
                {type:'add',text:'First-run feature tour'},
                {type:'add',text:'Notes + Timer panel'},
                {type:'add',text:'Artist themes: Madison Beer 💜 & İcardi / Galatasaray 🔴🟡'},
                {type:'add',text:'Real photos as transparent background in themes'},
                {type:'add',text:'Top Processes restored & system processes filtered out'},
                {type:'add',text:'Start with Windows setting'},
                {type:'fix',text:'Eco mode shows correct message instead of frozen track'},
                {type:'fix',text:'Actions button theme-consistent'},
                {type:'fix',text:'Performance labels lowercase (eco/normal/turbo)'},
                {type:'fix',text:'All text/card colors correct in dark & theme modes'},
                {type:'fix',text:'Modals open on single click'},
                {type:'fix',text:'Scrollable layout — content no longer clipped'},
                {type:'rem',text:'Removed broken Task Manager button'},
              ]},
              {ver:'v3.1.0',date:'',items:[{type:'add',text:'Migrated to React + TypeScript + Tailwind'},{type:'add',text:'Framer Motion animations'},{type:'imp',text:'Component architecture with custom hooks'}]},
              {ver:'v3.0.0',date:'Initial release',items:[{type:'add',text:'Full rewrite from Python/PyQt6 to Tauri + React + Rust'},{type:'add',text:'Spotify integration'},{type:'add',text:'GitHub Actions CI/CD'}]},
            ].map(({ver,date,items})=>(
              <div key={ver}>
                <div className="flex items-center gap-2 mb-2 pb-2 border-b" style={tc?{borderColor:'rgba(255,255,255,0.06)'}:{borderColor:'rgba(0,0,0,0.05)'}}>
                  <span className="text-[13px] font-extrabold" style={tc?{color:tc.textPrimary}:{}}><span className={!tc?'text-[#1a1a1a] dark:text-[#e8e8ea]':''}>{ver}</span></span>
                  {date&&<span className="text-[10px]" style={muted()}><span className={!tc?'text-black/25 dark:text-white/25':''}>{date}</span></span>}
                </div>
                <div className="flex flex-col gap-1">
                  {items.map((item,i)=>(
                    <div key={i} className="flex items-start gap-2">
                      <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',item.type==='add'&&'bg-green-400',item.type==='fix'&&'bg-blue-400',item.type==='imp'&&'bg-amber-400',item.type==='rem'&&'bg-red-400')} />
                      <span className="text-[11px]" style={muted()}><span className={!tc?'text-[#555] dark:text-[#888]':''}>{item.text}</span></span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <button onClick={()=>setModal(null)} style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:undefined}
            className={cn('mt-4 w-full py-2.5 rounded-xl text-[12px] font-semibold transition-colors',!tc&&'bg-black/[0.04] dark:bg-white/[0.06] text-black/40 dark:text-white/40 hover:bg-black/[0.07]')}>
            {t.close}
          </button>
        </Modal>

        <WorldClockModal open={modal==='worldclock'} onClose={()=>setModal(null)} t={t} tc={tc} />
        <ImageToolsModal open={modal==='imagetools'} onClose={()=>setModal(null)} tc={tc} />
        <PremiumModal open={modal==='premium'} onClose={()=>setModal(null)} t={t} tc={tc} />
        <TourModal open={showTour} onClose={closeTour} t={t} tc={tc} />

      </div>{/* end scrollable */}
    </div>
  );
}
