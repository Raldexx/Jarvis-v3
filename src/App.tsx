import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, BarChart2, Zap, Minus, Maximize2, X, Crown, Image, Clock } from 'lucide-react';
import { useSystemData, PERF_CONFIG, TRANSLATIONS, type PerfMode, type Language } from '@/store/system';
import { Card, SectionLabel } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { MetricCard } from '@/components/MetricCard';
import { ChartModal } from '@/components/ChartModal';
import { SpotifyPanel } from '@/components/SpotifyPanel';
import { fmtSpeed, fmtTemp, fmtUptime, cn } from '@/lib/utils';

type ModalType = 'chart' | 'spotify' | 'settings' | 'stats' | 'actions' | 'changelog' | 'notes' | 'premium' | 'worldclock' | 'imagetools' | null;
type ChartKey = 'cpu' | 'ram' | 'gpu' | 'net' | 'disk';

// ── Special artist themes ─────────────────────────────────────────────────────
function getArtistTheme(artist: string, track: string): 'madison' | 'simge' | null {
  const a = artist.toLowerCase();
  const t = track.toLowerCase();
  if (a.includes('madison beer')) return 'madison';
  if (a.includes('simge') || t.includes('aşkın olayım') || t.includes('icardi')) return 'simge';
  return null;
}

// ── Window controls ────────────────────────────────────────────────────────────
async function getWin() {
  const { Window } = await import('@tauri-apps/api/window');
  return Window.getCurrent();
}

// ── Clock ──────────────────────────────────────────────────────────────────────
function useClock(lang: Language) {
  const [clock, setClock] = useState('--:--:--');
  useEffect(() => {
    const locale = lang === 'tr' ? 'tr-TR' : lang === 'es' ? 'es-ES' : 'en-GB';
    const id = setInterval(() => setClock(new Date().toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000);
    return () => clearInterval(id);
  }, [lang]);
  return clock;
}

// ── Notes ──────────────────────────────────────────────────────────────────────
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

// ── World Clock ────────────────────────────────────────────────────────────────
const WORLD_CITIES = [
  { name: 'Istanbul',     tz: 'Europe/Istanbul' },
  { name: 'London',       tz: 'Europe/London' },
  { name: 'New York',     tz: 'America/New_York' },
  { name: 'Los Angeles',  tz: 'America/Los_Angeles' },
  { name: 'Tokyo',        tz: 'Asia/Tokyo' },
  { name: 'Dubai',        tz: 'Asia/Dubai' },
  { name: 'Paris',        tz: 'Europe/Paris' },
  { name: 'Sydney',       tz: 'Australia/Sydney' },
  { name: 'Berlin',       tz: 'Europe/Berlin' },
  { name: 'Singapore',    tz: 'Asia/Singapore' },
  { name: 'São Paulo',    tz: 'America/Sao_Paulo' },
  { name: 'Mumbai',       tz: 'Asia/Kolkata' },
  { name: 'Moscow',       tz: 'Europe/Moscow' },
  { name: 'Beijing',      tz: 'Asia/Shanghai' },
  { name: 'Cairo',        tz: 'Africa/Cairo' },
  { name: 'Toronto',      tz: 'America/Toronto' },
  { name: 'Chicago',      tz: 'America/Chicago' },
  { name: 'Seoul',        tz: 'Asia/Seoul' },
  { name: 'Amsterdam',    tz: 'Europe/Amsterdam' },
  { name: 'Mexico City',  tz: 'America/Mexico_City' },
];

function WorldClockModal({ open, onClose, t }: { open: boolean; onClose: () => void; t: typeof TRANSLATIONS['en'] }) {
  const [search, setSearch] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick(x => x + 1), 1000);
    return () => clearInterval(id);
  }, [open]);

  const filtered = WORLD_CITIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  function getCityTime(tz: string) {
    return new Date().toLocaleTimeString('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function getCityDate(tz: string) {
    return new Date().toLocaleDateString('en-GB', { timeZone: tz, day: '2-digit', month: 'short' });
  }

  return (
    <Modal open={open} onClose={onClose} title={t.worldClock}>
      <div className="mb-3">
        <input
          className="w-full px-3 py-2 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.04] text-[12px] text-[#1a1a1a] dark:text-[#e8e8ea] focus:outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors no-drag"
          placeholder={t.searchCity}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[360px]">
        {filtered.map(city => (
          <div key={city.tz} className="flex items-center justify-between px-3 py-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05]">
            <div>
              <div className="text-[12px] font-semibold text-[#1a1a1a] dark:text-[#e8e8ea]">{city.name}</div>
              <div className="text-[9px] text-black/30 dark:text-white/30">{getCityDate(city.tz)}</div>
            </div>
            <div className="font-mono text-[14px] font-bold text-[#1a1a1a] dark:text-[#e8e8ea] tabular-nums">{getCityTime(city.tz)}</div>
          </div>
        ))}
      </div>
      <button onClick={onClose} className="mt-3 w-full py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[12px] font-semibold text-black/40 dark:text-white/40 hover:bg-black/[0.07] transition-colors">{t.close}</button>
    </Modal>
  );
}

// ── Image Tools ────────────────────────────────────────────────────────────────
function ImageToolsModal({ open, onClose, dark }: { open: boolean; onClose: () => void; dark: boolean }) {
  const [img, setImg] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [op, setOp] = useState<'grayscale' | 'invert' | 'blur' | 'brightness' | 'contrast' | 'sepia' | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast]     = useState(100);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  function loadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    const reader = new FileReader();
    reader.onload = ev => { setImg(ev.target?.result as string); setOp(null); };
    reader.readAsDataURL(f);
  }

  function getFilter() {
    if (op === 'grayscale') return 'grayscale(100%)';
    if (op === 'invert')    return 'invert(100%)';
    if (op === 'blur')      return 'blur(4px)';
    if (op === 'sepia')     return 'sepia(100%)';
    if (op === 'brightness') return `brightness(${brightness}%)`;
    if (op === 'contrast')  return `contrast(${contrast}%)`;
    return 'none';
  }

  function download() {
    if (!img) return;
    const canvas = document.createElement('canvas');
    const image = new window.Image();
    image.onload = () => {
      canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext('2d')!;
      ctx.filter = getFilter();
      ctx.drawImage(image, 0, 0);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'jarvis_' + (fileName || 'image.png');
      a.click();
    };
    image.src = img;
  }

  const ops: { key: typeof op; label: string; icon: string }[] = [
    { key: 'grayscale',  label: 'Grayscale', icon: '◑' },
    { key: 'invert',     label: 'Invert',    icon: '◎' },
    { key: 'sepia',      label: 'Sepia',     icon: '🟫' },
    { key: 'blur',       label: 'Blur',      icon: '◌' },
    { key: 'brightness', label: 'Brightness',icon: '☀' },
    { key: 'contrast',   label: 'Contrast',  icon: '◑' },
  ];

  return (
    <Modal open={open} onClose={onClose} title="IMAGE TOOLS" wide>
      <div className="flex flex-col gap-3">
        {/* Upload */}
        <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-black/[0.12] dark:border-white/[0.12] cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors no-drag">
          <Image size={16} className="text-black/30 dark:text-white/30" />
          <span className="text-[12px] text-black/40 dark:text-white/40">{fileName || 'Click to upload image'}</span>
          <input type="file" accept="image/*" className="hidden" onChange={loadFile} />
        </label>

        {img && (
          <>
            {/* Preview */}
            <div className="relative rounded-2xl overflow-hidden bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05] flex items-center justify-center" style={{ minHeight: 160, maxHeight: 220 }}>
              <img src={img} alt="preview" style={{ maxHeight: 200, maxWidth: '100%', filter: getFilter(), borderRadius: 12, transition: 'filter 0.3s' }} />
            </div>

            {/* Operations */}
            <div className="grid grid-cols-3 gap-1.5">
              {ops.map(o => (
                <button key={o.key}
                  onClick={() => setOp(prev => prev === o.key ? null : o.key)}
                  className={cn('py-2 rounded-xl text-[11px] font-semibold transition-all border',
                    op === o.key
                      ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a] border-transparent'
                      : 'bg-black/[0.03] dark:bg-white/[0.04] border-black/[0.06] dark:border-white/[0.06] text-black/50 dark:text-white/50 hover:bg-black/[0.06]'
                  )}
                >{o.icon} {o.label}</button>
              ))}
            </div>

            {op === 'brightness' && (
              <div className="flex items-center gap-3 no-drag">
                <span className="text-[10px] text-black/40 dark:text-white/40 w-20">Brightness</span>
                <input type="range" min={0} max={200} value={brightness} onChange={e => setBrightness(+e.target.value)} className="flex-1" />
                <span className="text-[10px] font-mono text-black/50 dark:text-white/50 w-8">{brightness}%</span>
              </div>
            )}
            {op === 'contrast' && (
              <div className="flex items-center gap-3 no-drag">
                <span className="text-[10px] text-black/40 dark:text-white/40 w-20">Contrast</span>
                <input type="range" min={0} max={200} value={contrast} onChange={e => setContrast(+e.target.value)} className="flex-1" />
                <span className="text-[10px] font-mono text-black/50 dark:text-white/50 w-8">{contrast}%</span>
              </div>
            )}

            <button onClick={download} className="w-full py-2.5 rounded-xl bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a] text-[12px] font-bold hover:opacity-80 transition-opacity">
              ⬇ Download
            </button>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <button onClick={onClose} className="mt-3 w-full py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[12px] font-semibold text-black/40 dark:text-white/40 hover:bg-black/[0.07] transition-colors">Close</button>
    </Modal>
  );
}

// ── Premium Modal ─────────────────────────────────────────────────────────────
function PremiumModal({ open, onClose, t }: { open: boolean; onClose: () => void; t: typeof TRANSLATIONS['en'] }) {
  return (
    <Modal open={open} onClose={onClose} title={t.premiumTitle}>
      <div className="flex flex-col items-center gap-4 py-2">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-3xl shadow-lg">
          👑
        </div>
        <div className="text-center">
          <div className="text-[16px] font-extrabold text-[#1a1a1a] dark:text-[#e8e8ea] mb-1">JARVIS Premium</div>
          <div className="text-[12px] text-black/40 dark:text-white/40 max-w-[260px]">
            Unlock advanced features: Spotify lyrics, custom themes, cloud sync and more.
          </div>
        </div>
        <div className="w-full rounded-2xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/20 p-4">
          <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 mb-2">Want Premium access?</div>
          <div className="text-[11px] text-amber-600 dark:text-amber-500">
            Contact on Discord:<br />
            <span className="font-bold text-[13px] text-amber-700 dark:text-amber-300 font-mono select-all">Raldexx</span>
          </div>
        </div>
        <div className="text-[10px] text-black/20 dark:text-white/20 text-center">Premium is manually granted.<br/>Reach out with your username to get access.</div>
      </div>
      <button onClick={onClose} className="mt-2 w-full py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[12px] font-semibold text-black/40 dark:text-white/40 hover:bg-black/[0.07] transition-colors">{t.close}</button>
    </Modal>
  );
}

// ── First-run Tour ────────────────────────────────────────────────────────────
function TourModal({ open, onClose, t }: { open: boolean; onClose: () => void; t: typeof TRANSLATIONS['en'] }) {
  const [step, setStep] = useState(0);
  const steps = Object.values(t.tour);
  const isLast = step === steps.length - 1;

  return (
    <Modal open={open} onClose={onClose} title={t.firstRunTitle}>
      <div className="flex flex-col gap-4 py-1">
        <div className="text-[12px] text-black/50 dark:text-white/50">{t.firstRunDesc}</div>
        {/* Step indicator */}
        <div className="flex gap-1 justify-center">
          {steps.map((_, i) => (
            <div key={i} onClick={() => setStep(i)} className={cn('h-1.5 rounded-full cursor-pointer transition-all', i === step ? 'w-5 bg-blue-500' : 'w-1.5 bg-black/10 dark:bg-white/10')} />
          ))}
        </div>
        <AnimatePresence mode="wait">
          <motion.div key={step}
            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
            className="bg-black/[0.03] dark:bg-white/[0.04] rounded-2xl p-4 border border-black/[0.05] dark:border-white/[0.06] min-h-[64px] flex items-center"
          >
            <span className="text-[13px] text-[#1a1a1a] dark:text-[#e8e8ea]">{steps[step]}</span>
          </motion.div>
        </AnimatePresence>
        <div className="flex gap-2">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} className="flex-1 py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[12px] font-semibold text-black/40 dark:text-white/40 hover:bg-black/[0.07] transition-colors">←</button>
          )}
          <button
            onClick={() => isLast ? onClose() : setStep(s => s + 1)}
            className="flex-1 py-2.5 rounded-xl bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a] text-[12px] font-bold hover:opacity-90 transition-opacity"
          >
            {isLast ? t.gotIt : '→'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Notes + Timer Modal ───────────────────────────────────────────────────────
function NotesModal({ open, onClose, t, notes, addNote, removeNote, updateNote }: {
  open: boolean; onClose: () => void; t: typeof TRANSLATIONS['en'];
  notes: Note[]; addNote: (s: string) => void; removeNote: (id: number) => void; updateNote: (id: number, s: string) => void;
}) {
  const [noteInput, setNoteInput] = useState('');
  const [editId, setEditId]       = useState<number | null>(null);
  // Timer state
  const [timerMode, setTimerMode] = useState<'up' | 'down'>('up');
  const [timerSecs, setTimerSecs] = useState(0);
  const [timerInput, setTimerInput] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function fmtNoteTs(ts: number) {
    return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
           new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  function fmtTime(s: number) {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSecs(s => {
          if (timerMode === 'up') return s + 1;
          if (s <= 1) {
            setTimerRunning(false);
            // Windows notification via browser Notification API
            try {
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('JARVIS Timer', { body: 'Timer finished!' });
              } else {
                alert('⏰ Timer finished!');
              }
            } catch {}
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, timerMode]);

  function startTimer() {
    if (timerMode === 'down') setTimerSecs(timerInput);
    else setTimerSecs(0);
    setTimerRunning(true);
  }

  function stopTimer() { setTimerRunning(false); }
  function resetTimer() { setTimerRunning(false); setTimerSecs(timerMode === 'down' ? timerInput : 0); }

  return (
    <Modal open={open} onClose={() => { onClose(); setEditId(null); setNoteInput(''); }} title={t.quickNotes} wide>
      <div className="grid grid-cols-2 gap-4">
        {/* LEFT — Notes */}
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 no-drag">
            <textarea
              className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.04] text-[12px] text-[#1a1a1a] dark:text-[#e8e8ea] resize-none focus:outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
              placeholder={t.notePlaceholder}
              rows={3}
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { if (editId !== null) { updateNote(editId, noteInput); setEditId(null); } else { addNote(noteInput); } setNoteInput(''); } }}
            />
            <div className="flex gap-2 justify-end">
              {editId !== null && <button onClick={() => { setEditId(null); setNoteInput(''); }} className="px-3 py-1.5 rounded-lg bg-black/[0.05] text-[11px] font-semibold text-black/40">{t.cancel}</button>}
              <button onClick={() => { if (!noteInput.trim()) return; if (editId !== null) { updateNote(editId, noteInput); setEditId(null); } else { addNote(noteInput); } setNoteInput(''); }}
                className="px-4 py-1.5 rounded-lg bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a] text-[11px] font-bold">
                {editId !== null ? t.update : t.add}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2 overflow-y-auto max-h-[220px]">
            {notes.length === 0 ? <div className="text-center py-6 text-[12px] text-black/20 dark:text-white/20">{t.noNotes}</div>
              : notes.map(n => (
                <div key={n.id} className={cn('rounded-xl border p-2.5', editId === n.id ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' : 'border-black/[0.05] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03]')}>
                  <div className="text-[12px] text-[#1a1a1a] dark:text-[#e8e8ea] whitespace-pre-wrap break-words mb-1.5">{n.text}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] text-black/20 dark:text-white/20">{fmtNoteTs(n.ts)}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => { setEditId(n.id); setNoteInput(n.text); }} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500">{t.edit}</button>
                      <button onClick={() => removeNote(n.id)} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-400">{t.delete}</button>
                    </div>
                  </div>
                </div>
              ))
            }
          </div>
        </div>

        {/* RIGHT — Timer */}
        <div className="flex flex-col gap-3">
          <div className="text-[9px] font-bold tracking-[0.12em] text-black/30 dark:text-white/30">{t.timer.toUpperCase()}</div>
          {/* Mode */}
          <div className="flex gap-1 no-drag">
            {(['up', 'down'] as const).map(m => (
              <button key={m} onClick={() => { setTimerMode(m); resetTimer(); }}
                className={cn('flex-1 py-1.5 rounded-xl text-[11px] font-semibold transition-all',
                  timerMode === m ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]' : 'bg-black/[0.04] dark:bg-white/[0.06] text-black/40 dark:text-white/40'
                )}>{m === 'up' ? '▲ Count up' : '▼ Countdown'}</button>
            ))}
          </div>
          {/* Display */}
          <div className="flex items-center justify-center py-5 bg-black/[0.03] dark:bg-white/[0.03] rounded-2xl border border-black/[0.05] dark:border-white/[0.05]">
            <span className="font-mono text-[36px] font-extrabold text-[#1a1a1a] dark:text-[#e8e8ea] tabular-nums">{fmtTime(timerSecs)}</span>
          </div>
          {/* Countdown input */}
          {timerMode === 'down' && !timerRunning && (
            <div className="flex items-center gap-2 no-drag">
              <span className="text-[10px] text-black/40 dark:text-white/40">Set (sec)</span>
              <input type="number" min={1} max={86400} value={timerInput}
                onChange={e => setTimerInput(Math.max(1, +e.target.value))}
                className="flex-1 px-2 py-1 rounded-lg border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#1c1c1e] text-[12px] font-mono text-[#1a1a1a] dark:text-[#e8e8ea] focus:outline-none"
              />
            </div>
          )}
          {/* Controls */}
          <div className="flex gap-2 no-drag">
            {!timerRunning
              ? <button onClick={startTimer} className="flex-1 py-2 rounded-xl bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a] text-[12px] font-bold">▶ Start</button>
              : <button onClick={stopTimer}  className="flex-1 py-2 rounded-xl bg-amber-500 text-white text-[12px] font-bold">⏸ Pause</button>
            }
            <button onClick={resetTimer} className="flex-1 py-2 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[12px] font-semibold text-black/40 dark:text-white/40">↺ Reset</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const { sys, net, spotify, procs, weather, sysInfo, isDemo, cpuHist, ramHist, gpuHist, netHist, settings, updateSettings } = useSystemData();
  const t = TRANSLATIONS[settings.language] as typeof TRANSLATIONS['en'];
  const clock = useClock(settings.language);
  const { notes, add: addNote, remove: removeNote, update: updateNote } = useNotes();

  const [modal, setModal] = useState<ModalType>(null);
  const [chartKey, setChartKey] = useState<ChartKey | null>(null);
  const [showTour, setShowTour] = useState(false);

  // Artist theme
  const artistTheme = spotify.playing ? getArtistTheme(spotify.artist, spotify.track) : null;

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkTheme);
  }, [settings.darkTheme]);

  // First-run tour
  useEffect(() => {
    if (!settings.tourSeen) {
      const timer = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  function closeTour() {
    setShowTour(false);
    updateSettings({ tourSeen: true });
  }

  function openChart(key: ChartKey) { setChartKey(key); setModal('chart'); }

  const perfCfg = PERF_CONFIG[settings.perfMode];

  // ── Artist theme CSS vars ──────────────────────────────────────────────────
  const themeStyle: React.CSSProperties = artistTheme === 'madison'
    ? { '--artist-bg': '#1a0a2e', '--artist-accent': '#c084fc', '--artist-card': '#2d1b4e' } as React.CSSProperties
    : artistTheme === 'simge'
    ? { '--artist-bg': '#0f1a2e', '--artist-accent': '#3b82f6', '--artist-card': '#1e3a5f' } as React.CSSProperties
    : {};

  const bgClass = artistTheme === 'madison'
    ? 'bg-[#1a0a2e]'
    : artistTheme === 'simge'
    ? 'bg-[#0f1a2e]'
    : 'bg-[#f5f5f7] dark:bg-[#111113]';

  return (
    <div
      className={cn('w-full min-h-screen p-4 flex flex-col gap-2.5 font-sans', bgClass)}
      style={themeStyle}
      onMouseDown={async (e) => {
        const t2 = e.target as HTMLElement;
        if (t2.closest('.no-drag, button, input, textarea, select')) return;
        try { (await getWin()).startDragging(); } catch {}
      }}
    >

      {/* ═══ HEADER ═══ */}
      <Card artistTheme={artistTheme} className="flex items-center justify-between px-4 py-3.5">
        <div>
          <div className="text-[9px] font-bold tracking-[0.18em] text-black/25 dark:text-white/25">{t.systemMonitor}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-[20px] font-extrabold tracking-tight', artistTheme ? 'text-white' : 'text-[#1a1a1a] dark:text-[#e8e8ea]')}>
              JARVIS <span className="text-[13px] font-normal text-black/20 dark:text-white/20">v3.2</span>
            </span>
            <AnimatePresence mode="wait">
              <motion.div
                key={settings.perfMode}
                initial={{ opacity: 0, x: -8, scale: 0.85 }}
                animate={{ opacity: 1, x: 0,  scale: 1 }}
                exit={{ opacity: 0, x: -8, scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold',
                  settings.perfMode === 'eco'    && 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
                  settings.perfMode === 'normal' && 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
                  settings.perfMode === 'turbo'  && 'bg-red-50 dark:bg-red-900/20 text-red-500 dark:text-red-400 animate-pulse2',
                )}
              >
                <span>{perfCfg.icon}</span>
                <span>{perfCfg.label}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {/* Clickable clock → world clock */}
          <button
            className="text-[13px] font-bold font-mono tabular-nums no-drag hover:opacity-70 transition-opacity flex items-center gap-1"
            style={{ color: artistTheme ? 'white' : undefined }}
            onClick={() => setModal('worldclock')}
          >
            <Clock size={10} className="opacity-40" />
            <span className={artistTheme ? 'text-white' : 'text-[#1a1a1a] dark:text-[#e8e8ea]'}>{clock}</span>
          </button>
          <div className="text-[10px] text-black/30 dark:text-white/30">⏱ {fmtUptime(sys.uptime_secs)}</div>
          <div className="text-[10px] text-black/30 dark:text-white/30">🌤 {weather}</div>
          <div className="flex gap-1 no-drag mt-0.5">
            <button onClick={() => getWin().then(w => w.minimize())} className="w-5 h-5 rounded-full bg-black/05 dark:bg-white/08 flex items-center justify-center text-black/30 dark:text-white/30 hover:bg-black/10 dark:hover:bg-white/15 transition-colors">
              <Minus size={8} />
            </button>
            <button onClick={() => getWin().then(w => w.isMaximized().then(m => m ? w.unmaximize() : w.maximize()))} className="w-5 h-5 rounded-full bg-black/05 dark:bg-white/08 flex items-center justify-center text-black/30 dark:text-white/30 hover:bg-black/10 dark:hover:bg-white/15 transition-colors">
              <Maximize2 size={8} />
            </button>
            <button onClick={() => getWin().then(w => w.close())} className="w-5 h-5 rounded-full bg-black/05 dark:bg-white/08 flex items-center justify-center text-black/30 dark:text-white/30 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors">
              <X size={8} />
            </button>
          </div>
        </div>
      </Card>

      {isDemo && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl px-3 py-2 text-[10px] font-bold text-amber-700 dark:text-amber-400 text-center">
          {t.demoMode}
        </div>
      )}

      {/* Artist theme banner */}
      {artistTheme === 'madison' && (
        <div className="rounded-xl px-3 py-2 text-[10px] font-bold text-center text-purple-300 bg-purple-900/30 border border-purple-700/30">
          ✨ Madison Beer mode active
        </div>
      )}
      {artistTheme === 'simge' && (
        <div className="rounded-xl px-3 py-2 text-[10px] font-bold text-center text-blue-300 bg-blue-900/30 border border-blue-700/30">
          ⚽ Aşkın Olayım — İcardi theme active
        </div>
      )}

      {/* ═══ CPU + RAM ═══ */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="CPU" value={`${Math.round(sys.cpu_percent)}%`} sub={`${fmtTemp(sys.cpu_temp)} · load`} color="#3b82f6" history={cpuHist} onClick={() => openChart('cpu')} artistTheme={artistTheme} />
        <MetricCard label="RAM" value={`${Math.round(sys.ram_percent)}%`} sub={`${sys.ram_used_gb.toFixed(1)} / ${sys.ram_total_gb.toFixed(1)} GB`} color="#8b5cf6" history={ramHist} onClick={() => openChart('ram')} artistTheme={artistTheme} />
      </div>

      {/* ═══ GPU + NETWORK ═══ */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="GPU" value={`${Math.round(0)}%`} sub={fmtTemp(sys.gpu_temp)} color="#f59e0b" history={gpuHist} onClick={() => openChart('gpu')} artistTheme={artistTheme} />
        <MetricCard label="NETWORK" value={fmtSpeed(net.dlSpeed)} sub={`↑ ${fmtSpeed(net.ulSpeed)}`} color="#10b981" history={netHist} onClick={() => openChart('net')} artistTheme={artistTheme} />
      </div>

      {/* ═══ DISK + NOW PLAYING ═══ */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="DISK"
          value={`${Math.round(sys.disk_percent)}%`}
          sub={`${sys.disk_free_gb.toFixed(0)} GB ${t.free}`}
          color="#6b7280"
          history={Array(60).fill(sys.disk_percent)}
          onClick={() => openChart('disk')}
          artistTheme={artistTheme}
        >
          <div className="h-[3px] bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden mt-1">
            <div className="h-full bg-[#6b7280] rounded-full transition-all duration-500" style={{ width: `${sys.disk_percent}%` }} />
          </div>
        </MetricCard>

        <Card clickable hover onClick={() => setModal('spotify')} artistTheme={artistTheme} className="relative flex flex-col gap-1.5">
          <div className={cn('text-[9px] font-bold tracking-[0.12em]', artistTheme ? 'text-purple-400' : 'text-spotify')}>{t.nowPlaying}</div>
          <div className={cn('text-[14px] font-bold truncate', artistTheme ? 'text-white' : 'text-[#1a1a1a] dark:text-[#e8e8ea]')}>
            {settings.perfMode === 'eco' ? t.ecoNoSpotify : (spotify.playing ? spotify.track : t.notPlaying)}
          </div>
          {spotify.artist && settings.perfMode !== 'eco' && <div className="text-[10px] text-black/30 dark:text-white/30 truncate">{spotify.artist}</div>}
          <div className="absolute top-3 right-3 text-[10px] font-bold text-black/20 dark:text-white/20">↗</div>
          <div className="flex items-end gap-[2px] h-5 mt-auto">
            {Array(12).fill(0).map((_, i) => (
              <div key={i} className={cn('flex-1 rounded-[2px_2px_0_0]', artistTheme ? 'bg-purple-400' : 'bg-spotify')}
                style={{ height: (spotify.playing && settings.perfMode !== 'eco') ? `${4 + Math.random() * 14}px` : '3px', opacity: 0.6, transition: 'height 0.3s' }}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* ═══ SYSTEM INFO + TOP PROCESSES ═══ */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* System Info */}
        <Card artistTheme={artistTheme} className="p-3.5">
          <SectionLabel>{t.system}</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {[
              ['CPU',   sysInfo.cpu_name.length > 20 ? sysInfo.cpu_name.slice(0,20)+'…' : sysInfo.cpu_name],
              ['Cores', sysInfo.cpu_cores > 0 ? String(sysInfo.cpu_cores) : '...'],
              ['RAM',   sysInfo.ram_total_gb > 0 ? `${sysInfo.ram_total_gb.toFixed(0)} GB` : '...'],
              ['OS',    `${sysInfo.os_name} ${sysInfo.os_version}`.trim()],
              ['Host',  sysInfo.hostname],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-black/[0.04] dark:border-white/[0.04] pb-1.5 last:border-0 last:pb-0">
                <span className="text-[9px] font-bold tracking-[0.1em] text-black/25 dark:text-white/25">{k}</span>
                <span className={cn('text-[10px] font-semibold max-w-[110px] truncate text-right', artistTheme ? 'text-white/80' : 'text-[#333] dark:text-[#ccc]')}>{v}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Processes */}
        <Card artistTheme={artistTheme} className="p-3.5">
          <SectionLabel>{t.topProcesses}</SectionLabel>
          <div className="flex flex-col gap-1.5">
            {procs.length === 0
              ? <div className="text-[10px] text-black/20 dark:text-white/20 py-2">No data</div>
              : procs.slice(0,4).map(p => (
                <div key={p.pid} className="flex items-center gap-2 border-b border-black/[0.04] dark:border-white/[0.04] pb-1.5 last:border-0 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <div className={cn('text-[10px] font-semibold truncate', artistTheme ? 'text-white/80' : 'text-[#333] dark:text-[#ccc]')}>{p.name}</div>
                    <div className="h-[2px] bg-black/[0.05] dark:bg-white/[0.08] rounded-full mt-0.5 overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full transition-all duration-300" style={{ width: `${Math.min(100, p.cpu_percent)}%` }} />
                    </div>
                  </div>
                  <span className="text-[9px] font-mono text-black/30 dark:text-white/30 flex-shrink-0">{p.cpu_percent.toFixed(1)}%</span>
                </div>
              ))
            }
          </div>
        </Card>
      </div>

      {/* ═══ NOTES preview ═══ */}
      <Card clickable hover onClick={() => setModal('notes')} artistTheme={artistTheme} className="relative flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <SectionLabel className="mb-0">{t.notes}</SectionLabel>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-black/30 dark:text-white/30">{notes.length}</span>
        </div>
        {notes.length === 0
          ? <div className={cn('text-[11px] flex-1 flex items-center', artistTheme ? 'text-white/30' : 'text-black/20 dark:text-white/20')}>{t.notesAdd}</div>
          : <div className="flex flex-col gap-1 flex-1">
              {notes.slice(0,3).map(n => (
                <div key={n.id} className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                  <span className="text-[10px] text-[#555] dark:text-[#999] truncate">{n.text.length > 30 ? n.text.slice(0,30)+'…' : n.text}</span>
                </div>
              ))}
              {notes.length > 3 && <div className="text-[9px] text-black/20 dark:text-white/20 pl-2.5">{t.notesMore(notes.length - 3)}</div>}
            </div>
        }
        <div className={cn('text-[9px] mt-auto', artistTheme ? 'text-white/20' : 'text-black/15 dark:text-white/15')}>{t.noteAddBtn}</div>
        <div className="absolute top-3 right-3 text-[10px] font-bold text-black/20 dark:text-white/20">↗</div>
      </Card>

      {/* ═══ BUTTONS ═══ */}
      <div className="grid grid-cols-4 gap-2 no-drag">
        {[
          { icon: <Settings size={14} />, label: t.settings,  action: () => setModal('settings') },
          { icon: <BarChart2 size={14} />, label: t.changelog, action: () => setModal('changelog') },
          { icon: <Image size={14} />,    label: t.imageTools, action: () => setModal('imagetools') },
          { icon: <Crown size={14} />,    label: t.premium,    action: () => setModal('premium'), gold: true },
        ].map(({ icon, label, action, gold }) => (
          <button
            key={label}
            onClick={action}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 rounded-2xl text-[9px] font-bold tracking-[0.05em] transition-all duration-150 border',
              gold
                ? 'bg-gradient-to-b from-amber-400 to-orange-500 text-white border-amber-300 hover:opacity-90'
                : artistTheme
                ? 'bg-white/10 text-white/70 border-white/10 hover:bg-white/15'
                : 'bg-white dark:bg-[#1c1c1e] text-black/40 dark:text-white/40 border-black/[0.07] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
            )}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ═══ ACTIONS button (separate, theme-correct) ═══ */}
      <button
        onClick={() => setModal('actions')}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[11px] font-bold tracking-[0.06em] transition-all duration-150 border no-drag',
          artistTheme
            ? 'bg-white/10 text-white border-white/10 hover:bg-white/15'
            : 'bg-white dark:bg-[#1c1c1e] text-black/50 dark:text-white/50 border-black/[0.07] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
        )}
      >
        <Zap size={14} />
        {t.actions}
      </button>

      {/* ═══ MODALS ═══ */}
      <ChartModal open={modal === 'chart'} onClose={() => setModal(null)} chartKey={chartKey} sys={sys} net={net} sysInfo={sysInfo} cpuHist={cpuHist} ramHist={ramHist} gpuHist={gpuHist} netHist={netHist} />
      <SpotifyPanel open={modal === 'spotify'} onClose={() => setModal(null)} spotify={spotify} t={t} isEco={settings.perfMode === 'eco'} />

      {/* Settings */}
      <Modal open={modal === 'settings'} onClose={() => setModal(null)} title="SETTINGS">
        <div className="flex flex-col gap-0 divide-y divide-black/[0.05] dark:divide-white/[0.06]">
          {/* Theme */}
          <div className="flex items-center justify-between py-3">
            <span className="text-[12px] text-[#555] dark:text-[#aaa]">{t.theme}</span>
            <div className="flex gap-1 no-drag">
              {(['false','true'] as const).map((v, i) => (
                <button key={v} onClick={() => updateSettings({ darkTheme: i === 1 })}
                  className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                    settings.darkTheme === (i === 1) ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]' : 'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'
                  )}>{i === 0 ? t.light : t.dark}</button>
              ))}
            </div>
          </div>
          {/* Language */}
          <div className="flex items-center justify-between py-3">
            <span className="text-[12px] text-[#555] dark:text-[#aaa]">{t.language}</span>
            <div className="flex gap-1 no-drag">
              {(['en','tr','es'] as Language[]).map(l => (
                <button key={l} onClick={() => updateSettings({ language: l })}
                  className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                    settings.language === l ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]' : 'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'
                  )}>{{ en: '🇬🇧 EN', tr: '🇹🇷 TR', es: '🇪🇸 ES' }[l]}</button>
              ))}
            </div>
          </div>
          {/* Always on top */}
          <div className="flex items-center justify-between py-3">
            <span className="text-[12px] text-[#555] dark:text-[#aaa]">{t.alwaysOnTop}</span>
            <div className="flex gap-1 no-drag">
              {[true, false].map((v) => (
                <button key={String(v)} onClick={async () => {
                  updateSettings({ alwaysOnTop: v });
                  try { (await getWin()).setAlwaysOnTop(v); } catch {}
                }}
                  className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                    settings.alwaysOnTop === v ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]' : 'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'
                  )}>{v ? t.on : t.off}</button>
              ))}
            </div>
          </div>
          {/* Start with Windows */}
          <div className="flex items-center justify-between py-3">
            <span className="text-[12px] text-[#555] dark:text-[#aaa]">{t.startWithWindows}</span>
            <div className="flex gap-1 no-drag">
              {[true, false].map((v) => (
                <button key={String(v)} onClick={() => updateSettings({ startWithWindows: v })}
                  className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                    settings.startWithWindows === v ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]' : 'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'
                  )}>{v ? t.on : t.off}</button>
              ))}
            </div>
          </div>
          {/* Perf mode */}
          <div className="flex items-center justify-between py-3">
            <span className="text-[12px] text-[#555] dark:text-[#aaa]">{t.performance}</span>
            <div className="flex gap-1 no-drag">
              {(['eco','normal','turbo'] as PerfMode[]).map(m => (
                <button key={m} onClick={() => updateSettings({ perfMode: m })}
                  className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                    settings.perfMode === m ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]' : 'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'
                  )}>{PERF_CONFIG[m].icon} {PERF_CONFIG[m].label}</button>
              ))}
            </div>
          </div>
          {/* Perf info */}
          <div className="pt-3 text-[10px] text-black/30 dark:text-white/30 bg-black/[0.02] dark:bg-white/[0.03] rounded-xl px-3 py-2.5">
            {{ eco: t.perfEcoInfo, normal: t.perfNormalInfo, turbo: t.perfTurboInfo }[settings.perfMode]}
          </div>
          {/* Re-tour button */}
          <div className="pt-3">
            <button onClick={() => { setModal(null); setShowTour(true); }} className="w-full py-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-[11px] font-semibold text-blue-500 hover:bg-blue-100 transition-colors">
              🗺 {settings.language === 'tr' ? 'Özellik turunu tekrar göster' : settings.language === 'es' ? 'Repetir tour de funciones' : 'Show feature tour again'}
            </button>
          </div>
        </div>
        <button onClick={() => setModal(null)} className="mt-4 w-full py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[12px] font-semibold text-black/40 dark:text-white/40 hover:bg-black/[0.07] transition-colors">{t.close}</button>
      </Modal>

      {/* Notes + Timer */}
      <NotesModal open={modal === 'notes'} onClose={() => setModal(null)} t={t} notes={notes} addNote={addNote} removeNote={removeNote} updateNote={updateNote} />

      {/* Actions — Task Manager removed */}
      <Modal open={modal === 'actions'} onClose={() => setModal(null)} title={t.quickActions}>
        <div className="flex flex-col gap-2">
          {[
            { label: t.restart,  cmd: 'restart' },
            { label: t.shutdown, cmd: 'shutdown' },
            { label: t.sleep,    cmd: 'sleep' },
          ].map(({ label, cmd }) => (
            <button key={cmd} onClick={async () => {
              const confirm2 = cmd === 'restart' ? t.confirmRestart : cmd === 'shutdown' ? t.confirmShutdown : null;
              if (confirm2 && !confirm(confirm2)) return;
              const { invoke } = await import('@tauri-apps/api/core');
              invoke('system_action', { action: cmd }).catch(()=>{});
            }}
              className="px-4 py-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] text-[12px] font-semibold text-[#333] dark:text-[#ccc] text-left hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors">
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setModal(null)} className="mt-3 w-full py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-[12px] font-semibold text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">✕ {t.close}</button>
      </Modal>

      {/* Changelog */}
      <Modal open={modal === 'changelog'} onClose={() => setModal(null)} title="CHANGELOG">
        <div className="flex flex-col gap-4 overflow-y-auto max-h-[420px]">
          {[
            { ver: 'v3.2.0', date: 'Current', items: [
              { type: 'add', text: 'Language support: English, Turkish, Spanish — saved to settings' },
              { type: 'add', text: 'World Clock — click the header clock to see time in any city' },
              { type: 'add', text: 'Image Tools panel — grayscale, invert, sepia, blur, brightness, contrast' },
              { type: 'add', text: 'Premium section with Discord contact info' },
              { type: 'add', text: 'First-run feature tour (step-by-step guide)' },
              { type: 'add', text: 'Notes panel expanded with integrated Timer (count-up & countdown)' },
              { type: 'add', text: 'Artist themes: Madison Beer 💜 and Simge / İcardi 💙' },
              { type: 'add', text: 'Top Processes restored to System section' },
              { type: 'add', text: 'Start with Windows setting' },
              { type: 'fix', text: 'Eco mode now shows "Spotify tracking paused" instead of freezing last track' },
              { type: 'fix', text: 'Actions button now matches card theme (no longer inverted)' },
              { type: 'fix', text: 'Performance mode labels are now lowercase (eco / normal / turbo)' },
              { type: 'rem', text: 'Removed broken Task Manager button from Actions' },
            ]},
            { ver: 'v3.1.0', date: '', items: [
              { type: 'add', text: 'Migrated from Svelte to React + TypeScript + Tailwind CSS' },
              { type: 'add', text: 'Added Framer Motion animations throughout the UI' },
              { type: 'imp', text: 'Cleaner component architecture with custom hooks' },
            ]},
            { ver: 'v3.0.0', date: 'Initial release', items: [
              { type: 'add', text: 'Full rewrite from Python/PyQt6 to Tauri + React + Rust' },
              { type: 'add', text: 'White theme with big number metric cards' },
              { type: 'add', text: 'Spotify integration with animated visualizer' },
            ]},
          ].map(({ ver, date, items }) => (
            <div key={ver}>
              <div className="flex items-center gap-2 mb-2 pb-2 border-b border-black/[0.05] dark:border-white/[0.06]">
                <span className="text-[13px] font-extrabold text-[#1a1a1a] dark:text-[#e8e8ea]">{ver}</span>
                {date && <span className="text-[10px] text-black/25 dark:text-white/25">{date}</span>}
              </div>
              <div className="flex flex-col gap-1">
                {items.map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                      item.type === 'add' && 'bg-green-400',
                      item.type === 'fix' && 'bg-blue-400',
                      item.type === 'imp' && 'bg-amber-400',
                      item.type === 'rem' && 'bg-red-400',
                    )} />
                    <span className="text-[11px] text-[#555] dark:text-[#888]">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button onClick={() => setModal(null)} className="mt-4 w-full py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[12px] font-semibold text-black/40 dark:text-white/40 hover:bg-black/[0.07] transition-colors">{t.close}</button>
      </Modal>

      {/* World Clock */}
      <WorldClockModal open={modal === 'worldclock'} onClose={() => setModal(null)} t={t} />

      {/* Image Tools */}
      <ImageToolsModal open={modal === 'imagetools'} onClose={() => setModal(null)} dark={settings.darkTheme} />

      {/* Premium */}
      <PremiumModal open={modal === 'premium'} onClose={() => setModal(null)} t={t} />

      {/* First-run Tour */}
      <TourModal open={showTour} onClose={closeTour} t={t} />

    </div>
  );
}
