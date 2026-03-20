import { useState, useEffect, useMemo } from 'react';
import { Minus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const STATS_KEY = 'jarvis_spotify_stats';

interface Play { track: string; artist: string; ts: number; weekKey: string; monthKey: string; }
interface Stats { plays: Play[]; }

function loadStats(): Stats {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{"plays":[]}'); }
  catch { return { plays: [] }; }
}

function getWeekStart() {
  const d = new Date(); const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1); d.setHours(0,0,0,0); return d;
}
function getMonthStart() {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
}

type Filter = 'weekly' | 'monthly' | 'alltime';

async function getWin() {
  const { Window } = await import('@tauri-apps/api/window');
  return Window.getCurrent();
}

export default function StatsApp() {
  const [stats, setStats]   = useState<Stats>(loadStats);
  const [filter, setFilter] = useState<Filter>('weekly');
  const [clock, setClock]   = useState('--:--:--');
  const [dark, setDark]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('jarvis_settings_v3') || '{}').darkTheme ?? false; }
    catch { return false; }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    const id = setInterval(() => setClock(new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit' })), 1000);
    window.addEventListener('storage', (e) => { if (e.key === STATS_KEY) setStats(loadStats()); });
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'weekly')  return stats.plays.filter(p => new Date(p.ts) >= getWeekStart());
    if (filter === 'monthly') return stats.plays.filter(p => new Date(p.ts) >= getMonthStart());
    return stats.plays;
  }, [stats, filter]);

  const topTracks = useMemo(() => {
    const map: Record<string, {track:string;artist:string;count:number}> = {};
    filtered.forEach(p => {
      const k = `${p.track}|||${p.artist}`;
      if (!map[k]) map[k] = { track: p.track, artist: p.artist, count: 0 };
      map[k].count++;
    });
    return Object.values(map).sort((a,b) => b.count - a.count).slice(0, 10);
  }, [filtered]);

  const topArtists = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach(p => { map[p.artist] = (map[p.artist] || 0) + 1; });
    return Object.entries(map).map(([artist, count]) => ({ artist, count })).sort((a,b) => b.count - a.count).slice(0, 8);
  }, [filtered]);

  const dailyChart = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i)); d.setHours(0,0,0,0);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      return {
        label: d.toLocaleDateString('en-GB', { weekday: 'short' }),
        count: stats.plays.filter(p => { const t = new Date(p.ts); return t >= d && t < next; }).length,
      };
    });
  }, [stats]);

  const maxDaily = Math.max(...dailyChart.map(d => d.count), 1);
  const totalPlays    = filtered.length;
  const uniqueTracks  = new Set(filtered.map(p => p.track)).size;
  const uniqueArtists = new Set(filtered.map(p => p.artist)).size;

  return (
    <div
      className="w-full min-h-screen bg-[#f5f5f7] dark:bg-[#111113] p-4 flex flex-col gap-2.5 font-sans"
      onMouseDown={async (e) => {
        if ((e.target as HTMLElement).closest('.no-drag, button')) return;
        try { (await getWin()).startDragging(); } catch {}
      }}
    >
      {/* Header */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] px-4 py-3.5 flex items-center justify-between">
        <div>
          <div className="text-[9px] font-bold tracking-[0.18em] text-black/25 dark:text-white/25">SYSTEM MONITOR</div>
          <div className="text-[18px] font-extrabold text-[#1a1a1a] dark:text-[#e8e8ea]">
            JARVIS <span className="text-[13px] font-normal text-spotify">Spotify Stats</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="text-[13px] font-bold tabular-nums text-[#1a1a1a] dark:text-[#e8e8ea]">{clock}</div>
          <div className="flex gap-1 no-drag">
            <button onClick={() => getWin().then(w => w.minimize())} className="w-5 h-5 rounded-full bg-black/05 dark:bg-white/08 flex items-center justify-center text-black/30 dark:text-white/30 hover:bg-black/10 transition-colors">
              <Minus size={8} />
            </button>
            <button onClick={() => getWin().then(w => w.close())} className="w-5 h-5 rounded-full bg-black/05 dark:bg-white/08 flex items-center justify-center text-black/30 dark:text-white/30 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-colors">
              <X size={8} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] p-1.5 no-drag">
        {(['weekly','monthly','alltime'] as Filter[]).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('flex-1 py-2 rounded-xl text-[11px] font-semibold transition-all',
              filter === f ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]' : 'text-black/30 dark:text-white/30 hover:bg-black/[0.04] dark:hover:bg-white/[0.05]'
            )}
          >
            {{ weekly:'This Week', monthly:'This Month', alltime:'All Time' }[f]}
          </button>
        ))}
      </div>

      {/* Summary pills */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { val: totalPlays,    label: 'Plays',   color: 'text-spotify' },
          { val: uniqueTracks,  label: 'Tracks',  color: 'text-blue-500' },
          { val: uniqueArtists, label: 'Artists', color: 'text-purple-500' },
        ].map(({ val, label, color }) => (
          <div key={label} className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] p-3.5 text-center">
            <div className={cn('text-[30px] font-extrabold tabular-nums', color)}>{val}</div>
            <div className="text-[9px] font-bold tracking-[0.12em] text-black/25 dark:text-white/25 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Daily chart */}
      <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] p-3.5">
        <div className="text-[9px] font-bold tracking-[0.12em] text-black/25 dark:text-white/25 mb-3">DAILY ACTIVITY (LAST 7 DAYS)</div>
        <div className="flex items-end justify-between gap-2 h-24">
          {dailyChart.map((day, i) => (
            <div key={i} className="flex flex-col items-center gap-1 flex-1">
              <div className="w-full flex items-end justify-center" style={{ height: 80 }}>
                <div
                  className="w-full bg-spotify rounded-[4px_4px_0_0] opacity-75 transition-all duration-500"
                  style={{ height: day.count > 0 ? Math.max(4, day.count / maxDaily * 80) : 0 }}
                />
              </div>
              <div className="text-[9px] font-bold text-spotify min-h-[12px]">{day.count > 0 ? day.count : ''}</div>
              <div className="text-[9px] text-black/25 dark:text-white/25">{day.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top tracks + artists */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Top tracks */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] p-3.5">
          <div className="text-[9px] font-bold tracking-[0.12em] text-black/25 dark:text-white/25 mb-3">TOP TRACKS</div>
          {topTracks.length === 0
            ? <div className="text-[11px] text-black/20 dark:text-white/20 text-center py-6">No data yet.<br/>Play some music!</div>
            : topTracks.map((t, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0">
                <span className="text-[10px] font-bold text-black/15 dark:text-white/15 w-5 text-center">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-[#1a1a1a] dark:text-[#e8e8ea] truncate">{t.track}</div>
                  <div className="text-[9px] text-black/25 dark:text-white/25 truncate">{t.artist}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-8 h-[3px] bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${Math.round(t.count / topTracks[0].count * 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-black/25 dark:text-white/25 w-5 text-right tabular-nums">{t.count}x</span>
                </div>
              </div>
            ))
          }
        </div>

        {/* Top artists */}
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] p-3.5">
          <div className="text-[9px] font-bold tracking-[0.12em] text-black/25 dark:text-white/25 mb-3">TOP ARTISTS</div>
          {topArtists.length === 0
            ? <div className="text-[11px] text-black/20 dark:text-white/20 text-center py-6">No data yet.</div>
            : topArtists.map((a, i) => (
              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-black/[0.04] dark:border-white/[0.04] last:border-0">
                <span className="text-[10px] font-bold text-black/15 dark:text-white/15 w-5 text-center">#{i+1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-[#1a1a1a] dark:text-[#e8e8ea] truncate">{a.artist}</div>
                  <div className="text-[9px] text-black/25 dark:text-white/25">{a.count} plays</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-8 h-[3px] bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                    <div className="h-full bg-spotify rounded-full" style={{ width: `${Math.round(a.count / topArtists[0].count * 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-bold text-black/25 dark:text-white/25 w-5 text-right tabular-nums">{a.count}x</span>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {totalPlays === 0 && (
        <div className="bg-white dark:bg-[#1c1c1e] rounded-2xl border border-black/[0.07] dark:border-white/[0.08] p-10 text-center">
          <div className="text-4xl mb-3">🎵</div>
          <div className="text-[15px] font-bold text-[#333] dark:text-[#ccc] mb-2">No listening data yet</div>
          <div className="text-[11px] text-black/30 dark:text-white/30 leading-relaxed">Play something on Spotify while JARVIS is running.<br/>Your stats will appear here automatically.</div>
        </div>
      )}
    </div>
  );
}
