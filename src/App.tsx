import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, BarChart2, Zap, Minus, Maximize2, X } from 'lucide-react';
import { useSystemData, PERF_CONFIG, type PerfMode } from '@/store/system';
import { Card, SectionLabel } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { MetricCard } from '@/components/MetricCard';
import { ChartModal } from '@/components/ChartModal';
import { SpotifyPanel } from '@/components/SpotifyPanel';
import { fmtSpeed, fmtTemp, fmtUptime, cn } from '@/lib/utils';

type ModalType = 'chart' | 'spotify' | 'settings' | 'stats' | 'actions' | 'changelog' | 'notes' | null;
type ChartKey = 'cpu' | 'ram' | 'gpu' | 'net' | 'disk';

// ── Window controls ────────────────────────────────────────────────────────────
async function getWin() {
  const { Window } = await import('@tauri-apps/api/window');
  return Window.getCurrent();
}

// ── Clock ──────────────────────────────────────────────────────────────────────
function useClock() {
  const [clock, setClock] = useState('--:--:--');
  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000);
    return () => clearInterval(id);
  }, []);
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

// ── Main App ───────────────────────────────────────────────────────────────────
export default function App() {
  const { sys, net, spotify, procs, weather, sysInfo, isDemo, cpuHist, ramHist, gpuHist, netHist, settings, updateSettings } = useSystemData();
  const clock = useClock();
  const { notes, add: addNote, remove: removeNote, update: updateNote } = useNotes();

  const [modal, setModal] = useState<ModalType>(null);
  const [chartKey, setChartKey] = useState<ChartKey | null>(null);
  const [noteInput, setNoteInput] = useState('');
  const [editId, setEditId] = useState<number | null>(null);

  // Dark mode
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.darkTheme);
  }, [settings.darkTheme]);

  function openChart(key: ChartKey) { setChartKey(key); setModal('chart'); }

  function fmtNoteTs(ts: number) {
    return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
           new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }

  const perfCfg = PERF_CONFIG[settings.perfMode];

  return (
    <div
      className="w-full min-h-screen bg-[#f5f5f7] dark:bg-[#111113] p-4 flex flex-col gap-2.5 font-sans"
      onMouseDown={async (e) => {
        const t = e.target as HTMLElement;
        if (t.closest('.no-drag, button, input, textarea, select')) return;
        try { (await getWin()).startDragging(); } catch {}
      }}
    >

      {/* ═══ HEADER ═══ */}
      <Card className="flex items-center justify-between px-4 py-3.5">
        <div>
          <div className="text-[9px] font-bold tracking-[0.18em] text-black/25 dark:text-white/25">SYSTEM MONITOR</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[20px] font-extrabold tracking-tight text-[#1a1a1a] dark:text-[#e8e8ea]">
              JARVIS <span className="text-[13px] font-normal text-black/20 dark:text-white/20">v3.1</span>
            </span>
            {/* Perf badge */}
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
          <div className="text-[13px] font-bold text-[#1a1a1a] dark:text-[#e8e8ea] font-mono tabular-nums">{clock}</div>
          <div className="text-[10px] text-black/30 dark:text-white/30">⏱ {fmtUptime(sys.uptime_secs)}</div>
          <div className="text-[10px] text-black/30 dark:text-white/30">🌤 {weather}</div>
          {/* Window controls */}
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
          DEMO MODE
        </div>
      )}

      {/* ═══ CPU + RAM ═══ */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="CPU" value={`${Math.round(sys.cpu_percent)}%`} sub={`${fmtTemp(sys.cpu_temp)} · load`} color="#3b82f6" history={cpuHist} onClick={() => openChart('cpu')} />
        <MetricCard label="RAM" value={`${Math.round(sys.ram_percent)}%`} sub={`${sys.ram_used_gb.toFixed(1)} / ${sys.ram_total_gb.toFixed(1)} GB`} color="#8b5cf6" history={ramHist} onClick={() => openChart('ram')} />
      </div>

      {/* ═══ GPU + NETWORK ═══ */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard label="GPU" value={`${Math.round(0)}%`} sub={fmtTemp(sys.gpu_temp)} color="#f59e0b" history={gpuHist} onClick={() => openChart('gpu')} />
        <MetricCard
          label="NETWORK"
          value={fmtSpeed(net.dlSpeed)}
          sub={`↑ ${fmtSpeed(net.ulSpeed)}`}
          color="#10b981"
          history={netHist}
          onClick={() => openChart('net')}
        />
      </div>

      {/* ═══ DISK + SPOTIFY ═══ */}
      <div className="grid grid-cols-2 gap-2.5">
        <MetricCard
          label="DISK"
          value={`${Math.round(sys.disk_percent)}%`}
          sub={`${sys.disk_free_gb.toFixed(0)} GB free`}
          color="#6b7280"
          history={Array(60).fill(sys.disk_percent)}
          onClick={() => openChart('disk')}
        >
          <div className="h-[3px] bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden mt-1">
            <div className="h-full bg-[#6b7280] rounded-full transition-all duration-500" style={{ width: `${sys.disk_percent}%` }} />
          </div>
        </MetricCard>

        <Card clickable hover onClick={() => setModal('spotify')} className="relative flex flex-col gap-1.5">
          <div className="text-[9px] font-bold tracking-[0.12em] text-spotify">NOW PLAYING</div>
          <div className="text-[14px] font-bold text-[#1a1a1a] dark:text-[#e8e8ea] truncate">
            {spotify.playing ? spotify.track : 'Not Playing'}
          </div>
          {spotify.artist && <div className="text-[10px] text-black/30 dark:text-white/30 truncate">{spotify.artist}</div>}
          <div className="absolute top-3 right-3 text-[10px] font-bold text-black/20 dark:text-white/20">↗</div>
          {/* Mini viz bars */}
          <div className="flex items-end gap-[2px] h-5 mt-auto">
            {Array(12).fill(0).map((_, i) => (
              <div key={i} className="flex-1 rounded-[2px_2px_0_0] bg-spotify"
                style={{ height: spotify.playing ? `${4 + Math.random() * 14}px` : '3px', opacity: 0.6, transition: 'height 0.3s' }}
              />
            ))}
          </div>
        </Card>
      </div>

      {/* ═══ SYSTEM INFO + NOTES ═══ */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* System Info */}
        <Card className="p-3.5">
          <SectionLabel>SYSTEM</SectionLabel>
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
                <span className="text-[10px] font-semibold text-[#333] dark:text-[#ccc] max-w-[110px] truncate text-right">{v}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Notes */}
        <Card clickable hover onClick={() => setModal('notes')} className="relative flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <SectionLabel className="mb-0">NOTES</SectionLabel>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-black/30 dark:text-white/30">{notes.length}</span>
          </div>
          {notes.length === 0
            ? <div className="text-[11px] text-black/20 dark:text-white/20 flex-1 flex items-center">Tap to add a note</div>
            : <div className="flex flex-col gap-1 flex-1">
                {notes.slice(0,3).map(n => (
                  <div key={n.id} className="flex items-center gap-1.5">
                    <div className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-[10px] text-[#555] dark:text-[#999] truncate">{n.text.length > 26 ? n.text.slice(0,26)+'…' : n.text}</span>
                  </div>
                ))}
                {notes.length > 3 && <div className="text-[9px] text-black/20 dark:text-white/20 pl-2.5">+{notes.length - 3} more</div>}
              </div>
          }
          <div className="text-[9px] text-black/15 dark:text-white/15 mt-auto">+ Add note</div>
          <div className="absolute top-3 right-3 text-[10px] font-bold text-black/20 dark:text-white/20">↗</div>
        </Card>
      </div>

      {/* ═══ BUTTONS ═══ */}
      <div className="grid grid-cols-3 gap-2.5 no-drag">
        {[
          { icon: <Settings size={16} />, label: 'Settings', action: () => setModal('settings') },
          { icon: <BarChart2 size={16} />, label: 'Changelog', action: () => setModal('changelog') },
          { icon: <Zap size={16} />, label: 'Actions', action: () => setModal('actions'), dark: true },
        ].map(({ icon, label, action, dark }) => (
          <button
            key={label}
            onClick={action}
            className={cn(
              'flex flex-col items-center gap-1.5 py-3 rounded-2xl text-[10px] font-bold tracking-[0.06em] transition-all duration-150 border',
              dark
                ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a] border-[#1a1a1a] dark:border-[#e8e8ea] hover:bg-[#333] dark:hover:bg-white'
                : 'bg-white dark:bg-[#1c1c1e] text-black/40 dark:text-white/40 border-black/[0.07] dark:border-white/[0.08] hover:bg-black/[0.03] dark:hover:bg-white/[0.05]'
            )}
          >
            {icon}{label}
          </button>
        ))}
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Chart */}
      <ChartModal
        open={modal === 'chart'}
        onClose={() => setModal(null)}
        chartKey={chartKey}
        sys={sys}
        net={{ ...net, dlSpeed: net.dlSpeed, ulSpeed: net.ulSpeed }}
        sysInfo={sysInfo}
        cpuHist={cpuHist} ramHist={ramHist} gpuHist={gpuHist} netHist={netHist}
      />

      {/* Spotify */}
      <SpotifyPanel open={modal === 'spotify'} onClose={() => setModal(null)} spotify={spotify} />

      {/* Settings */}
      <Modal open={modal === 'settings'} onClose={() => setModal(null)} title="SETTINGS">
        <div className="flex flex-col gap-0 divide-y divide-black/[0.05] dark:divide-white/[0.06]">
          {/* Theme */}
          <div className="flex items-center justify-between py-3">
            <span className="text-[12px] text-[#555] dark:text-[#aaa]">Theme</span>
            <div className="flex gap-1 no-drag">
              {(['false','true'] as const).map((v, i) => (
                <button key={v} onClick={() => updateSettings({ darkTheme: i === 1 })}
                  className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                    settings.darkTheme === (i === 1) ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]' : 'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'
                  )}>{i === 0 ? 'Light' : 'Dark'}</button>
              ))}
            </div>
          </div>
          {/* Always on top */}
          <div className="flex items-center justify-between py-3">
            <span className="text-[12px] text-[#555] dark:text-[#aaa]">Always on top</span>
            <div className="flex gap-1 no-drag">
              {[true, false].map((v) => (
                <button key={String(v)} onClick={async () => {
                  updateSettings({ alwaysOnTop: v });
                  try { (await getWin()).setAlwaysOnTop(v); } catch {}
                }}
                  className={cn('px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all',
                    settings.alwaysOnTop === v ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]' : 'bg-black/[0.05] dark:bg-white/[0.07] text-black/40 dark:text-white/40'
                  )}>{v ? 'On' : 'Off'}</button>
              ))}
            </div>
          </div>
          {/* Perf mode */}
          <div className="flex items-center justify-between py-3">
            <span className="text-[12px] text-[#555] dark:text-[#aaa]">Performance</span>
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
            {{ eco: 'CPU & RAM only · 5s refresh · low load', normal: 'All metrics · 1s refresh · balanced', turbo: 'All metrics · 500ms refresh · max accuracy' }[settings.perfMode]}
          </div>
        </div>
        <button onClick={() => setModal(null)} className="mt-4 w-full py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[12px] font-semibold text-black/40 dark:text-white/40 hover:bg-black/[0.07] transition-colors">Close</button>
      </Modal>

      {/* Notes */}
      <Modal open={modal === 'notes'} onClose={() => { setModal(null); setEditId(null); setNoteInput(''); }} title="QUICK NOTES">
        <div className="flex flex-col gap-2 mb-3 no-drag">
          <textarea
            className="w-full px-3 py-2.5 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-black/[0.02] dark:bg-white/[0.04] text-[12px] text-[#1a1a1a] dark:text-[#e8e8ea] resize-none focus:outline-none focus:border-blue-300 dark:focus:border-blue-700 transition-colors"
            placeholder="Write a note... (Ctrl+Enter to save)"
            rows={3}
            value={noteInput}
            onChange={e => setNoteInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) { if (editId !== null) { updateNote(editId, noteInput); setEditId(null); } else { addNote(noteInput); } setNoteInput(''); } }}
          />
          <div className="flex gap-2 justify-end">
            {editId !== null && <button onClick={() => { setEditId(null); setNoteInput(''); }} className="px-3 py-1.5 rounded-lg bg-black/[0.05] text-[11px] font-semibold text-black/40">Cancel</button>}
            <button onClick={() => { if (!noteInput.trim()) return; if (editId !== null) { updateNote(editId, noteInput); setEditId(null); } else { addNote(noteInput); } setNoteInput(''); }}
              className="px-4 py-1.5 rounded-lg bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a] text-[11px] font-bold">
              {editId !== null ? '✓ Update' : '+ Add'}
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2 overflow-y-auto max-h-[280px]">
          {notes.length === 0 ? <div className="text-center py-8 text-[12px] text-black/20 dark:text-white/20">No notes yet</div>
            : notes.map(n => (
              <div key={n.id} className={cn('rounded-xl border p-2.5', editId === n.id ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' : 'border-black/[0.05] dark:border-white/[0.06] bg-black/[0.02] dark:bg-white/[0.03]')}>
                <div className="text-[12px] text-[#1a1a1a] dark:text-[#e8e8ea] whitespace-pre-wrap break-words mb-1.5">{n.text}</div>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-black/20 dark:text-white/20">{fmtNoteTs(n.ts)}</span>
                  <div className="flex gap-1.5">
                    <button onClick={() => { setEditId(n.id); setNoteInput(n.text); }} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-500">Edit</button>
                    <button onClick={() => removeNote(n.id)} className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-400">Delete</button>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      </Modal>

      {/* Actions */}
      <Modal open={modal === 'actions'} onClose={() => setModal(null)} title="QUICK ACTIONS">
        <div className="flex flex-col gap-2">
          {[
            { label: '🔄 Restart System',  cmd: 'restart' },
            { label: '⚫ Shutdown',         cmd: 'shutdown' },
            { label: '😴 Sleep Mode',       cmd: 'sleep' },
            { label: '📋 Task Manager',     cmd: 'taskmgr' },
          ].map(({ label, cmd }) => (
            <button key={cmd} onClick={async () => { if (['restart','shutdown'].includes(cmd) && !confirm(`Confirm ${cmd}?`)) return; const { invoke } = await import('@tauri-apps/api/core'); invoke('system_action', { action: cmd }).catch(()=>{}); }}
              className="px-4 py-3 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.06] text-[12px] font-semibold text-[#333] dark:text-[#ccc] text-left hover:bg-black/[0.06] dark:hover:bg-white/[0.08] transition-colors">
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => setModal(null)} className="mt-3 w-full py-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-[12px] font-semibold text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">✕ Close</button>
      </Modal>

      {/* Changelog */}
      <Modal open={modal === 'changelog'} onClose={() => setModal(null)} title="CHANGELOG">
        <div className="flex flex-col gap-4 overflow-y-auto max-h-[420px]">
          {[
            { ver: 'v3.1.0', date: 'Current', items: [
              { type: 'add', text: 'Migrated from Svelte to React + TypeScript + Tailwind CSS' },
              { type: 'add', text: 'Added Framer Motion animations throughout the UI' },
              { type: 'add', text: 'shadcn/ui design system integration' },
              { type: 'add', text: 'Recharts for data visualization' },
              { type: 'imp', text: 'Cleaner component architecture with custom hooks' },
              { type: 'imp', text: 'Better TypeScript types for all system data' },
              { type: 'imp', text: 'Smoother animations on perf badge and modals' },
            ]},
            { ver: 'v3.0.2', date: '', items: [
              { type: 'add', text: 'Spotify Stats window (weekly/monthly/all-time)' },
              { type: 'add', text: 'Quick Notes with local storage' },
              { type: 'add', text: 'System Info panel replacing Top Processes' },
              { type: 'fix', text: 'Settings persistence (dark theme, always on top, perf mode)' },
              { type: 'fix', text: 'Chart modals now show contextual system info' },
              { type: 'rem', text: 'Removed Clipboard Manager (plugin compatibility issues)' },
            ]},
            { ver: 'v3.0.1', date: '', items: [
              { type: 'add', text: 'Dark / Light theme toggle' },
              { type: 'add', text: 'Performance modes: Eco / Normal / Turbo' },
              { type: 'add', text: 'Animated performance badge in header' },
              { type: 'add', text: 'Window controls (minimize, maximize, close)' },
              { type: 'fix', text: 'Accurate CPU readings with persistent sysinfo instance' },
              { type: 'fix', text: 'Transparent window background on launch' },
            ]},
            { ver: 'v3.0.0', date: 'Initial release', items: [
              { type: 'add', text: 'Full rewrite from Python/PyQt6 to Tauri + Svelte + Rust' },
              { type: 'add', text: 'White theme with big number metric cards' },
              { type: 'add', text: 'Clickable cards with 60s history charts' },
              { type: 'add', text: 'Spotify integration with animated visualizer' },
              { type: 'add', text: 'GitHub Actions CI/CD' },
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
        <button onClick={() => setModal(null)} className="mt-4 w-full py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[12px] font-semibold text-black/40 dark:text-white/40 hover:bg-black/[0.07] transition-colors">Close</button>
      </Modal>

    </div>
  );
}
