import { useEffect, useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import type { SpotifyInfo } from '@/store/system';

interface SpotifyPanelProps {
  open:    boolean;
  onClose: () => void;
  spotify: SpotifyInfo;
}

const SPOTIFY_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#1DB954">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
  </svg>
);

function Visualizer({ playing }: { playing: boolean }) {
  const [bars, setBars] = useState(() => Array(24).fill(12));
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let t = 0;
    function animate() {
      t += 0.06;
      setBars(bars => bars.map((_, i) =>
        playing ? Math.max(4, 12 + Math.sin(t + i * 0.38) * 14 + (Math.random() - 0.5) * 4) : Math.max(3, bars[i] * 0.92)
      ));
      rafRef.current = requestAnimationFrame(animate);
    }
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playing]);

  return (
    <div className="flex items-end justify-center gap-[3px] h-14">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-[7px] rounded-[3px_3px_0_0]"
          style={{
            height: h,
            background: '#1DB954',
            opacity: playing ? (0.4 + (i / bars.length) * 0.6) : 0.2,
            transition: 'height 0.1s ease, opacity 0.3s',
          }}
        />
      ))}
    </div>
  );
}

export function SpotifyPanel({ open, onClose, spotify }: SpotifyPanelProps) {
  const [recentTracks, setRecentTracks] = useState<{n:string;a:string;t:string}[]>([]);
  const prevTrack = useRef('');

  useEffect(() => {
    if (spotify.playing && spotify.track && spotify.track !== prevTrack.current) {
      if (prevTrack.current) {
        setRecentTracks(prev => [
          { n: prevTrack.current, a: spotify.artist, t: new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' }) },
          ...prev
        ].slice(0, 8));
      }
      prevTrack.current = spotify.track;
    }
  }, [spotify.track, spotify.playing]);

  async function openStatsWindow() {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const existing = WebviewWindow.getByLabel('stats');
      if (existing) { (await existing).show(); (await existing).setFocus(); return; }
      const win = new WebviewWindow('stats', { url: '/stats', title: 'JARVIS — Spotify Stats', width: 700, height: 780, decorations: false, transparent: true, resizable: true });
      win.once('tauri://created', () => win.show());
    } catch(e) { console.warn(e); }
  }

  return (
    <Modal open={open} onClose={onClose} title="MUSIC" wide
      actions={
        <button
          onClick={openStatsWindow}
          className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-spotify/10 text-spotify hover:bg-spotify/20 transition-colors"
        >
          📊 Stats
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {/* LEFT */}
        <div className="flex flex-col gap-3">
          {/* Now Playing */}
          <div className="bg-black/[0.03] dark:bg-white/[0.04] rounded-2xl p-3 border border-black/[0.05] dark:border-white/[0.06]">
            <div className="text-[9px] font-bold tracking-[0.14em] text-spotify mb-2">NOW PLAYING</div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-spotify to-[#158a3e] flex items-center justify-center text-lg flex-shrink-0">♫</div>
              <div className="min-w-0">
                <div className="text-[14px] font-bold text-[#1a1a1a] dark:text-[#e8e8ea] truncate">{spotify.track || 'Not Playing'}</div>
                <div className="text-[11px] text-black/40 dark:text-white/40">{spotify.artist || (spotify.playing ? '—' : 'Open Spotify')}</div>
              </div>
            </div>
            {spotify.playing ? (
              <>
                <div className="h-[3px] bg-black/[0.06] dark:bg-white/[0.08] rounded-full overflow-hidden">
                  <div className="h-full bg-spotify rounded-full w-[35%]" />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-black/20 dark:text-white/20">
                  <span>—:——</span><span>—:——</span>
                </div>
              </>
            ) : (
              <div className="text-[10px] text-black/20 dark:text-white/20 mt-1">Not playing</div>
            )}
          </div>

          {/* Visualizer */}
          <div className="bg-black/[0.03] dark:bg-white/[0.04] rounded-2xl p-3 border border-black/[0.05] dark:border-white/[0.06]">
            <div className="text-[9px] font-bold tracking-[0.14em] text-black/30 dark:text-white/30 mb-2">VISUALIZER</div>
            <Visualizer playing={spotify.playing} />
          </div>

          {/* Service selector */}
          <div className="bg-black/[0.03] dark:bg-white/[0.04] rounded-2xl p-3 border border-black/[0.05] dark:border-white/[0.06]">
            <div className="text-[9px] font-bold tracking-[0.14em] text-black/30 dark:text-white/30 mb-2">MUSIC SERVICE</div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/50 dark:border-green-800/30">
                <div className="w-6 h-6 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center">{SPOTIFY_ICON}</div>
                <span className="text-[11px] font-semibold text-[#1a1a1a] dark:text-[#e8e8ea] flex-1">Spotify</span>
                <span className="text-[9px] font-bold text-spotify">● Active</span>
              </div>
              <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.05] dark:border-white/[0.05]">
                <div className="w-6 h-6 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#fc3c44"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.17 3.34.428 2.004.958 1.04 1.88.475 3.208c-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.802.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81a5.046 5.046 0 001.88-2.208c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393z"/></svg>
                </div>
                <span className="text-[11px] font-semibold text-[#1a1a1a] dark:text-[#e8e8ea] flex-1">Apple Music</span>
                <span className="text-[9px] font-bold text-black/20 dark:text-white/20">○ Soon</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — Recently played */}
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] text-black/30 dark:text-white/30 mb-2.5">RECENTLY PLAYED</div>
          <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[420px]">
            {/* Currently playing */}
            {spotify.playing && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200/40 dark:border-green-800/30">
                <span className="text-[9px] text-spotify w-3">♪</span>
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-spotify to-[#158a3e] flex items-center justify-center text-white text-[11px]">♫</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-spotify truncate">{spotify.track}</div>
                  <div className="text-[9px] text-black/30 dark:text-white/30 truncate">{spotify.artist}</div>
                </div>
                <span className="text-[9px] text-black/20 dark:text-white/20">now</span>
              </div>
            )}

            {/* History */}
            {recentTracks.map((tr, i) => (
              <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.04] dark:border-white/[0.05] hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors">
                <span className="text-[9px] text-black/20 dark:text-white/20 w-3">{i+1}</span>
                <div className="w-7 h-7 rounded-lg bg-black/[0.05] dark:bg-white/[0.08] flex items-center justify-center text-[11px]">♫</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-[#1a1a1a] dark:text-[#e8e8ea] truncate">{tr.n}</div>
                  <div className="text-[9px] text-black/30 dark:text-white/30 truncate">{tr.a}</div>
                </div>
                <span className="text-[9px] text-black/20 dark:text-white/20">{tr.t}</span>
              </div>
            ))}

            {!spotify.playing && recentTracks.length === 0 && (
              <div className="text-center py-10 text-black/20 dark:text-white/20">
                <div className="text-3xl mb-2">🎵</div>
                <div className="text-[11px]">Open Spotify to see<br/>track info here</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
