<script>
  import { onMount, onDestroy } from 'svelte';

  // ── State ──────────────────────────────────────────────────────────────────
  let cpu = 0, ram = 0, gpu = 0, disk = 0;
  let cpuTemp = null, gpuTemp = null;
  let ramUsed = 0, ramTotal = 0, diskFree = 0;
  let uptimeSecs = 0;
  let dlSpeed = 0, ulSpeed = 0, totalToday = 0;
  let weatherText = '...';
  let spotifyPlaying = false, spotifyTrack = 'Not Playing', spotifyArtist = '';
  let recentTracks = []; // filled from Spotify window title history
  let processList = []; // kept for potential future use

  // System info
  let sysInfo = { cpu_name: '...', cpu_cores: 0, os_name: '...', os_version: '', hostname: '...', ram_total_gb: 0 };

  // Notes
  let notes = JSON.parse(localStorage.getItem('jarvis_notes') || '[]');
  // [{ id, text, ts }]
  let noteModal = false;
  let noteInput = '';
  let editingNote = null;

  function saveNotes() { localStorage.setItem('jarvis_notes', JSON.stringify(notes)); }
  function addNote() {
    if (!noteInput.trim()) return;
    if (editingNote !== null) {
      notes = notes.map(n => n.id === editingNote ? { ...n, text: noteInput.trim(), ts: Date.now() } : n);
      editingNote = null;
    } else {
      notes = [{ id: Date.now(), text: noteInput.trim(), ts: Date.now() }, ...notes];
    }
    noteInput = '';
    saveNotes();
  }
  function deleteNote(id) { notes = notes.filter(n => n.id !== id); saveNotes(); }
  function editNote(note) { editingNote = note.id; noteInput = note.text; }
  function fmtNoteTs(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  }
  let errorMsg = '';
  let modal = null; // null | 'spotify' | 'settings' | 'stats' | 'actions'
  let darkTheme = false;
  let alwaysOnTop = true;
  let perfMode = 'normal'; // 'eco' | 'normal' | 'turbo'

  const PERF = {
    eco:    { icon: '🌿', label: 'ECO',    interval: 5000, slowInterval: 30000, net: false, spotify: false, procs: false, weather: false },
    normal: { icon: '⚡', label: 'NORMAL', interval: 1000, slowInterval: 2000,  net: true,  spotify: true,  procs: true,  weather: true  },
    turbo:  { icon: '🚀', label: 'TURBO',  interval: 500,  slowInterval: 1000,  net: true,  spotify: true,  procs: true,  weather: true  },
  };

  // Chart overlay
  let chartKey = null, chartTitle = '', chartColor = '';
  let chartHistory = [];

  // Histories
  let cpuHist = Array(60).fill(0);
  let ramHist = Array(60).fill(0);
  let gpuHist = Array(60).fill(0);
  let netHist = Array(60).fill(0);

  let prevRecv = 0, prevSent = 0, weatherTs = 0, mockTick = 0;
  let fastId, slowId;

  // ── Invoke ─────────────────────────────────────────────────────────────────
  async function inv(cmd, args) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke(cmd, args);
    } catch(e) {
      return null;
    }
  }

  // ── Ticks ──────────────────────────────────────────────────────────────────
  async function fastTick() {
    mockTick++;
    const s = await inv('get_system_stats');
    if (s) {
      cpu = s.cpu_percent;
      ram = s.ram_percent;
      gpu = 0; // GPU from separate command
      ramUsed = s.ram_used_gb;
      ramTotal = s.ram_total_gb;
      disk = s.disk_percent;
      diskFree = s.disk_free_gb;
      uptimeSecs = s.uptime_secs;
      cpuTemp = s.cpu_temp;
      gpuTemp = s.gpu_temp;
      errorMsg = '';
    } else {
      // Mock data so UI is always alive
      cpu  = 25 + Math.sin(mockTick * 0.12) * 18 + Math.random() * 5;
      ram  = 58 + Math.sin(mockTick * 0.07) * 12;
      gpu  = 40 + Math.sin(mockTick * 0.09) * 20;
      ramUsed = 9.3; ramTotal = 16;
      disk = 55; diskFree = 220;
      uptimeSecs = mockTick * 2;
      cpuTemp = 68; gpuTemp = 72;
      errorMsg = 'DEMO MODE';
    }

    cpuHist = [...cpuHist.slice(1), cpu];
    ramHist = [...ramHist.slice(1), ram];
    gpuHist = [...gpuHist.slice(1), gpu];

    const _mode = PERF[perfMode];
    const n = _mode.net ? await inv('get_network_stats') : null;
    if (n) {
      dlSpeed = Math.max(0, n.download_bytes - prevRecv) / 1024;
      ulSpeed = Math.max(0, n.upload_bytes   - prevSent) / 1024;
      prevRecv = n.download_bytes;
      prevSent = n.upload_bytes;
      totalToday = n.total_recv_mb + n.total_sent_mb;
    } else {
      dlSpeed = Math.abs(Math.sin(mockTick * 0.2)) * 400;
      ulSpeed = Math.abs(Math.sin(mockTick * 0.15)) * 80;
    }
    netHist = [...netHist.slice(1), dlSpeed];
  }

  async function slowTick() {
    const _m = PERF[perfMode];
    const now = Date.now();
    if (_m.weather && now - weatherTs > 300_000) {
      const w = await inv('get_weather');
      weatherText = w || '☀ 22°C';
      weatherTs = now;
    }
    const p = _m.procs ? await inv('get_processes') : null;
    if (p) processList = p;
    else processList = [
      { name: 'chrome.exe',  cpu_percent: 18 + Math.random() * 5 },
      { name: 'code.exe',    cpu_percent: 8  + Math.random() * 3 },
      { name: 'discord.exe', cpu_percent: 3  + Math.random() * 2 },
      { name: 'spotify.exe', cpu_percent: 1  + Math.random() },
    ];
    const sp = _m.spotify ? await inv('get_spotify') : null;

    // System info - fetch once
    if (sysInfo.cpu_name === '...') {
      const si = await inv('get_system_info');
      if (si) sysInfo = si;
    }
    if (sp) {
      if (sp.playing && sp.track && sp.track !== spotifyTrack) {
        // new track started — push old one to history
        if (spotifyTrack && spotifyTrack !== 'Not Playing') {
          recentTracks = [{ n: spotifyTrack, a: spotifyArtist, t: new Date().toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'}) }, ...recentTracks].slice(0, 8);
        }
      }
      spotifyPlaying = sp.playing;
      spotifyTrack   = sp.playing ? sp.track  : 'Not Playing';
      spotifyArtist  = sp.playing ? sp.artist : '';
    }
  }

  function startPolling() {
    clearInterval(fastId); clearInterval(slowId);
    const m = PERF[perfMode];
    fastTick(); slowTick();
    fastId = setInterval(fastTick, m.interval);
    slowId = setInterval(slowTick, m.slowInterval);
  }

  function setPerfMode(mode) {
    perfMode = mode;
    startPolling();
  }

  onMount(() => { startPolling(); });
  onDestroy(() => { clearInterval(fastId); clearInterval(slowId); });

  // ── Helpers ────────────────────────────────────────────────────────────────
  function fmtSpeed(k) {
    if (k >= 1024) return `${(k/1024).toFixed(1)} MB/s`;
    return `${k.toFixed(0)} KB/s`;
  }
  function fmtTemp(t) { return t != null ? `${Math.round(t)}°C` : 'N/A'; }
  function fmtUptime(s) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${m}m`;
  }
  function colForPct(p) {
    if (p > 85) return '#ef4444';
    if (p > 65) return '#f59e0b';
    return null; // default
  }

  // ── Chart open ─────────────────────────────────────────────────────────────
  function openChart(key) {
    const map = {
      cpu:  { title: 'CPU Usage',    color: '#3b82f6', hist: cpuHist  },
      ram:  { title: 'RAM Usage',    color: '#8b5cf6', hist: ramHist  },
      gpu:  { title: 'GPU Usage',    color: '#f59e0b', hist: gpuHist  },
      net:  { title: 'Network ↓',    color: '#10b981', hist: netHist  },
      disk: { title: 'Disk Usage',   color: '#6b7280', hist: Array(60).fill(disk) },
    };
    const m = map[key];
    chartKey = key;
    chartTitle = m.title;
    chartColor = m.color;
    chartHistory = [...m.hist];
    modal = 'chart';
  }

  // ── System action ──────────────────────────────────────────────────────────
  async function doAction(action) {
    if (['restart','shutdown'].includes(action) && !confirm(`Confirm ${action}?`)) return;
    await inv('system_action', { action });
  }

  // ── Clock ──────────────────────────────────────────────────────────────────
  let clockStr = '--:--:--';
  const clockId = setInterval(() => {
    clockStr = new Date().toLocaleTimeString('tr-TR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });
  }, 1000);
  onDestroy(() => clearInterval(clockId));

  // ── Window controls ────────────────────────────────────────────────────────
  // ── Window controls (Tauri v2) ────────────────────────────────────────────
  async function winMinimize() {
    try {
      const { Window } = await import('@tauri-apps/api/window');
      const win = await Window.getCurrent();
      await win.minimize();
    } catch(e) { console.warn('minimize:', e); }
  }

  async function winMaximize() {
    try {
      const { Window } = await import('@tauri-apps/api/window');
      const win = await Window.getCurrent();
      const max = await win.isMaximized();
      if (max) await win.unmaximize();
      else await win.maximize();
    } catch(e) { console.warn('maximize:', e); }
  }

  async function winClose() {
    try {
      const { Window } = await import('@tauri-apps/api/window');
      const win = await Window.getCurrent();
      await win.close();
    } catch(e) { console.warn('close:', e); }
  }

  // ── Visualizer bars (spotify panel) ───────────────────────────────────────
  let vizBars = Array(26).fill(20);
  let vizId;
  $: if (modal === 'spotify') {
    vizId = setInterval(() => {
      const t = Date.now() / 280;
      vizBars = vizBars.map((_, i) => Math.max(4, 20 + Math.sin(t + i * 0.38) * 18 + (Math.random()-0.5)*6));
    }, 80);
  } else {
    clearInterval(vizId);
  }
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div class="shell {darkTheme ? 'dark' : ''}" on:mousedown={async (e) => {
  if (e.target.closest('.no-drag, button, input, select')) return;
  try { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().startDragging(); } catch {}
}}>

  <!-- ═══ HEADER ═══ -->
  <div class="hdr">
    <div>
      <div class="hdr-sub">SYSTEM MONITOR</div>
      <div class="hdr-title-row">
        <div class="hdr-title">JARVIS <span class="hdr-ver">v3.0</span></div>
        {#key perfMode}
          <div class="perf-badge perf-{perfMode}">
            <span class="perf-icon">{PERF[perfMode].icon}</span>
            <span class="perf-label">{PERF[perfMode].label}</span>
          </div>
        {/key}
      </div>
    </div>
    <div class="hdr-right">
      <div class="hdr-clock">{clockStr}</div>
      <div class="hdr-meta">⏱ {fmtUptime(uptimeSecs)}</div>
      <div class="hdr-meta">🌤 {weatherText}</div>
      <div class="win-controls no-drag">
        <button class="win-btn" title="Minimize" on:click={winMinimize}>−</button>
        <button class="win-btn" title="Maximize" on:click={winMaximize}>⤢</button>
        <button class="win-btn win-close" title="Close" on:click={winClose}>✕</button>
      </div>
    </div>
  </div>

  {#if errorMsg}
    <div class="demo-badge">{errorMsg}</div>
  {/if}

  <!-- ═══ CPU + RAM ═══ -->
  <div class="grid2">
    <button class="card metric-card no-drag" on:click={() => openChart('cpu')}>
      <div class="metric-label" style="color:#3b82f6">CPU</div>
      <div class="metric-num" style={colForPct(cpu) ? `color:${colForPct(cpu)}` : ''}>{Math.round(cpu)}<span class="metric-unit">%</span></div>
      <div class="metric-sub">{fmtTemp(cpuTemp)} · {Math.round(cpu)}% load</div>
      <div class="tap-hint">↗</div>
      <div class="sparkline">
        {#each cpuHist.slice(-20) as v}
          <div class="spark-bar" style="height:{Math.max(2, v/100*24)}px; background:#3b82f6; opacity:{0.3 + (v/100)*0.7}"></div>
        {/each}
      </div>
    </button>

    <button class="card metric-card no-drag" on:click={() => openChart('ram')}>
      <div class="metric-label" style="color:#8b5cf6">RAM</div>
      <div class="metric-num" style={colForPct(ram) ? `color:${colForPct(ram)}` : ''}>{Math.round(ram)}<span class="metric-unit">%</span></div>
      <div class="metric-sub">{ramUsed.toFixed(1)} / {ramTotal.toFixed(1)} GB</div>
      <div class="tap-hint">↗</div>
      <div class="sparkline">
        {#each ramHist.slice(-20) as v}
          <div class="spark-bar" style="height:{Math.max(2, v/100*24)}px; background:#8b5cf6; opacity:{0.3 + (v/100)*0.7}"></div>
        {/each}
      </div>
    </button>
  </div>

  <!-- ═══ GPU + NET ═══ -->
  <div class="grid2">
    <button class="card metric-card no-drag" on:click={() => openChart('gpu')}>
      <div class="metric-label" style="color:#f59e0b">GPU</div>
      <div class="metric-num" style={colForPct(gpu) ? `color:${colForPct(gpu)}` : ''}>{Math.round(gpu)}<span class="metric-unit">%</span></div>
      <div class="metric-sub">{fmtTemp(gpuTemp)} · VRAM</div>
      <div class="tap-hint">↗</div>
      <div class="sparkline">
        {#each gpuHist.slice(-20) as v}
          <div class="spark-bar" style="height:{Math.max(2, v/100*24)}px; background:#f59e0b; opacity:{0.3 + (v/100)*0.7}"></div>
        {/each}
      </div>
    </button>

    <button class="card metric-card no-drag" on:click={() => openChart('net')}>
      <div class="metric-label" style="color:#10b981">NETWORK</div>
      <div class="metric-num-sm">{fmtSpeed(dlSpeed)}</div>
      <div class="metric-sub">↑ {fmtSpeed(ulSpeed)} · {totalToday.toFixed(0)} MB today</div>
      <div class="tap-hint">↗</div>
      <div class="sparkline">
        {#each netHist.slice(-20) as v}
          {@const max = Math.max(...netHist, 1)}
          <div class="spark-bar" style="height:{Math.max(2, v/max*24)}px; background:#10b981; opacity:{0.3 + (v/max)*0.7}"></div>
        {/each}
      </div>
    </button>
  </div>

  <!-- ═══ DISK + SPOTIFY ═══ -->
  <div class="grid2">
    <button class="card metric-card no-drag" on:click={() => openChart('disk')}>
      <div class="metric-label" style="color:#6b7280">DISK</div>
      <div class="metric-num" style={colForPct(disk) ? `color:${colForPct(disk)}` : ''}>{Math.round(disk)}<span class="metric-unit">%</span></div>
      <div class="metric-sub">{diskFree.toFixed(0)} GB free</div>
      <div class="tap-hint">↗</div>
      <div class="disk-bar-wrap">
        <div class="disk-bar-fill" style="width:{disk}%; background:{colForPct(disk) || '#6b7280'}"></div>
      </div>
    </button>

    <button class="card spotify-mini no-drag" on:click={() => modal = 'spotify'}>
      <div class="metric-label" style="color:#1DB954">NOW PLAYING</div>
      <div class="sp-track">{spotifyTrack}</div>
      {#if spotifyArtist}<div class="metric-sub">{spotifyArtist}</div>{/if}
      <div class="tap-hint">↗</div>
      <div class="viz-mini">
        {#each Array(12) as _, i}
          <div class="vm-bar" style="background:#1DB954; animation-delay:{i*0.08}s"></div>
        {/each}
      </div>
    </button>
  </div>

  <!-- ═══ SYSTEM INFO + NOTES ═══ -->
  <div class="grid2">

    <!-- System Info -->
    <div class="card sysinfo-card">
      <div class="sec-label">SYSTEM</div>
      <div class="sysinfo-row">
        <span class="sysinfo-key">CPU</span>
        <span class="sysinfo-val" title={sysInfo.cpu_name}>{sysInfo.cpu_name.length > 22 ? sysInfo.cpu_name.slice(0,22)+'…' : sysInfo.cpu_name}</span>
      </div>
      <div class="sysinfo-row">
        <span class="sysinfo-key">Cores</span>
        <span class="sysinfo-val">{sysInfo.cpu_cores > 0 ? sysInfo.cpu_cores : '...'}</span>
      </div>
      <div class="sysinfo-row">
        <span class="sysinfo-key">RAM</span>
        <span class="sysinfo-val">{sysInfo.ram_total_gb > 0 ? sysInfo.ram_total_gb.toFixed(0)+' GB' : '...'}</span>
      </div>
      <div class="sysinfo-row">
        <span class="sysinfo-key">OS</span>
        <span class="sysinfo-val">{sysInfo.os_name} {sysInfo.os_version}</span>
      </div>
      <div class="sysinfo-row">
        <span class="sysinfo-key">Host</span>
        <span class="sysinfo-val">{sysInfo.hostname}</span>
      </div>
    </div>

    <!-- Quick Notes -->
    <button class="card notes-card no-drag" on:click={() => noteModal = true}>
      <div class="sec-label notes-header">
        NOTES
        <span class="notes-count">{notes.length}</span>
      </div>
      {#if notes.length === 0}
        <div class="notes-empty">Tap to add a note</div>
      {:else}
        <div class="notes-preview">
          {#each notes.slice(0,3) as note}
            <div class="note-preview-item">
              <span class="note-preview-dot"></span>
              <span class="note-preview-text">{note.text.length > 28 ? note.text.slice(0,28)+'…' : note.text}</span>
            </div>
          {/each}
          {#if notes.length > 3}
            <div class="notes-more">+{notes.length - 3} more</div>
          {/if}
        </div>
      {/if}
      <div class="notes-add-hint">+ Add note</div>
    </button>

  </div>

  <!-- ═══ BUTTONS ═══ -->
  <div class="grid3 no-drag">
    <button class="btn-action" on:click={() => modal = 'settings'}>⚙ Settings</button>
    <button class="btn-action" on:click={() => modal = 'changelog'}>📋 Changelog</button>
    <button class="btn-action btn-dark" on:click={() => modal = 'actions'}>⚡ Actions</button>
  </div>

</div>

<!-- ═══════════════════════════════════════════════════════════════════════ -->
<!-- MODALS -->
<!-- ═══════════════════════════════════════════════════════════════════════ -->

{#if noteModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="overlay" on:click|self={() => noteModal = false}>
    <div class="mbox notes-mbox">
      <div class="mbox-hdr">
        <span class="mbox-title">QUICK NOTES</span>
        <button class="mclose" on:click={() => { noteModal = false; editingNote = null; noteInput = ''; }}>✕</button>
      </div>

      <!-- Input -->
      <div class="note-input-wrap no-drag">
        <!-- svelte-ignore a11y-autofocus -->
        <textarea
          class="note-textarea"
          placeholder="Write a note..."
          bind:value={noteInput}
          rows="3"
          on:keydown={(e) => { if (e.key === 'Enter' && e.ctrlKey) addNote(); }}
        ></textarea>
        <div class="note-input-actions">
          {#if editingNote !== null}
            <button class="note-cancel-btn" on:click={() => { editingNote = null; noteInput = ''; }}>Cancel</button>
          {/if}
          <button class="note-save-btn" on:click={addNote}>
            {editingNote !== null ? '✓ Update' : '+ Add'}
          </button>
        </div>
        <div class="note-hint">Ctrl+Enter to save</div>
      </div>

      <!-- Notes list -->
      <div class="notes-list">
        {#if notes.length === 0}
          <div class="notes-list-empty">No notes yet. Add one above!</div>
        {:else}
          {#each notes as note}
            <div class="note-item {editingNote === note.id ? 'note-editing' : ''}">
              <div class="note-item-text">{note.text}</div>
              <div class="note-item-footer">
                <span class="note-item-ts">{fmtNoteTs(note.ts)}</span>
                <div class="note-item-actions">
                  <button class="note-edit-btn" on:click={() => editNote(note)}>Edit</button>
                  <button class="note-del-btn"  on:click={() => deleteNote(note.id)}>Delete</button>
                </div>
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

{#if modal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="overlay" on:click|self={() => modal = null}>

    <!-- ── CHART ── -->
    {#if modal === 'chart'}
      <div class="mbox">
        <div class="mbox-hdr">
          <span class="mbox-title">{chartTitle}</span>
          <button class="mclose" on:click={() => modal = null}>✕</button>
        </div>
        <div class="chart-val" style="color:{chartColor}">
          {#if chartKey === 'net'}{fmtSpeed(dlSpeed)}
          {:else if chartKey === 'disk'}{Math.round(disk)}%
          {:else if chartKey === 'cpu'}{Math.round(cpu)}%
          {:else if chartKey === 'ram'}{Math.round(ram)}%
          {:else if chartKey === 'gpu'}{Math.round(gpu)}%
          {/if}
        </div>
        <div class="chart-bars">
          {#each chartHistory as v, i}
            {@const max = Math.max(...chartHistory, 1)}
            <div class="chart-bar" style="
              flex:1;
              height:{Math.max(3, v/max*120)}px;
              background:{chartColor};
              opacity:{0.25 + 0.75*(v/max)};
              border-radius:3px 3px 0 0;
              transition:height .3s ease;
              align-self:flex-end;
            "></div>
          {/each}
        </div>
        <div class="chart-axis">
          <span>60s ago</span><span>now</span>
        </div>
        <button class="close-btn" on:click={() => modal = null}>Close</button>
      </div>

    <!-- ── SPOTIFY ── -->
    {:else if modal === 'spotify'}
      <div class="mbox mbox-wide">
        <div class="mbox-hdr">
          <span class="mbox-title">MUSIC</span>
          <button class="mclose" on:click={() => modal = null}>✕</button>
        </div>
        <div class="sp-body">

          <!-- LEFT -->
          <div class="sp-left">

            <!-- Now Playing -->
            <div class="sp-np-card">
              <div class="sp-np-label">NOW PLAYING</div>
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
                <div class="sp-cover">♫</div>
                <div style="min-width:0">
                  <div class="sp-np-track">{spotifyTrack}</div>
                  <div class="sp-np-artist">{spotifyArtist || (spotifyPlaying ? '—' : 'Spotify kapalı')}</div>
                </div>
              </div>
              {#if spotifyPlaying}
                <div class="sp-prog-track"><div class="sp-prog-fill"></div></div>
                <div class="sp-times"><span>—:——</span><span>—:——</span></div>
              {:else}
                <div style="font-size:10px;color:#ccc;margin-top:8px">Spotify açık değil veya çalmıyor</div>
              {/if}
            </div>

            <!-- Visualizer -->
            <div class="sp-viz-card">
              <div class="sp-viz-label">VISUALIZER</div>
              <div class="sp-viz-bars">
                {#each vizBars as h, i}
                  <div class="sp-vbar" style="height:{spotifyPlaying ? h : 4}px; opacity:{spotifyPlaying ? (0.4 + (i/vizBars.length)*0.6) : 0.2}"></div>
                {/each}
              </div>
              {#if !spotifyPlaying}
                <div style="font-size:10px;color:#ccc;text-align:center;margin-top:4px">Çalmıyor</div>
              {/if}
            </div>

            <!-- Service selector -->
            <div class="sp-svc-card">
              <div class="sp-svc-label">MUSIC SERVICE</div>
              <div class="sp-svc-item sp-svc-active">
                <div class="sp-svc-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#1DB954"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                </div>
                <div class="sp-svc-name">Spotify</div>
                <div class="sp-svc-status" style="color:#1DB954">● Active</div>
              </div>
              <div class="sp-svc-item">
                <div class="sp-svc-icon" style="background:#fff5f5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#fc3c44"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026C4.786.07 4.043.17 3.34.428 2.004.958 1.04 1.88.475 3.208c-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.802.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81a5.046 5.046 0 001.88-2.208c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.157-.95.003-1.68-.537-1.882-1.377-.202-.84.269-1.682 1.15-2.032.27-.107.55-.178.833-.233.388-.073.778-.14 1.164-.219.327-.063.45-.212.45-.54 0-1.428 0-2.856.002-4.284 0-.123-.013-.244-.026-.365-.03-.265-.153-.376-.418-.323-.06.012-.12.027-.178.042l-3.808.947c-.255.063-.375.202-.375.47-.002 2.055 0 4.11-.004 6.163 0 .533-.07 1.057-.277 1.557-.348.844-1.008 1.255-1.907 1.297-.524.023-1.038-.044-1.498-.332-.634-.394-.895-1.01-.7-1.77.14-.545.556-.87 1.078-1.026.345-.104.703-.154 1.058-.225.376-.074.753-.145 1.126-.232.33-.077.47-.247.47-.6V5.58c0-.36.13-.567.476-.658 1.174-.308 2.35-.606 3.527-.908.458-.118.915-.24 1.373-.354.177-.045.355-.084.537-.078.37.012.62.22.648.578.014.18.018.36.018.54.002 1.5 0 3 0 4.394z"/></svg>
                </div>
                <div class="sp-svc-name">Apple Music</div>
                <div class="sp-svc-status" style="color:#ccc">○ Soon</div>
              </div>
            </div>
          </div>

          <!-- RIGHT: recently played -->
          <div class="sp-right">
            <div class="sp-hist-label">RECENTLY PLAYED</div>
            <div class="sp-hist-list">

              <!-- Currently playing -->
              {#if spotifyPlaying}
                <div class="sp-track-item sp-track-active">
                  <div class="sp-track-num">♪</div>
                  <div class="sp-track-dot sp-track-dot-active">♫</div>
                  <div class="sp-track-info">
                    <div class="sp-track-name" style="color:#1DB954">{spotifyTrack}</div>
                    <div class="sp-track-artist">{spotifyArtist}</div>
                  </div>
                  <div class="sp-track-time">now</div>
                </div>
              {/if}

              <!-- History from this session -->
              {#each recentTracks as tr, i}
                <div class="sp-track-item">
                  <div class="sp-track-num">{i+1}</div>
                  <div class="sp-track-dot">♫</div>
                  <div class="sp-track-info">
                    <div class="sp-track-name">{tr.n}</div>
                    <div class="sp-track-artist">{tr.a}</div>
                  </div>
                  <div class="sp-track-time">{tr.t}</div>
                </div>
              {/each}

              {#if !spotifyPlaying && recentTracks.length === 0}
                <div class="sp-empty">
                  <div style="font-size:28px;margin-bottom:8px">🎵</div>
                  <div>Spotify açık değil</div>
                  <div style="font-size:10px;color:#ccc;margin-top:4px">Çalınca geçmiş burada görünür</div>
                </div>
              {/if}

            </div>
          </div>
        </div>
      </div>

    <!-- ── SETTINGS ── -->
    {:else if modal === 'settings'}
      <div class="mbox">
        <div class="mbox-hdr">
          <span class="mbox-title">SETTINGS</span>
          <button class="mclose" on:click={() => modal = null}>✕</button>
        </div>
        <div class="settings-row">
          <span class="settings-label">Theme</span>
          <div class="toggle-wrap no-drag">
            <button class="toggle-btn {!darkTheme ? 'toggle-active' : ''}" on:click={() => darkTheme = false}>Light</button>
            <button class="toggle-btn {darkTheme ? 'toggle-active' : ''}" on:click={() => darkTheme = true}>Dark</button>
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-label">Always on top</span>
          <div class="toggle-wrap no-drag">
            <button class="toggle-btn {alwaysOnTop ? 'toggle-active' : ''}" on:click={async () => {
              alwaysOnTop = true;
              try { const { Window } = await import('@tauri-apps/api/window'); const w = await Window.getCurrent(); await w.setAlwaysOnTop(true); } catch {}
            }}>On</button>
            <button class="toggle-btn {!alwaysOnTop ? 'toggle-active' : ''}" on:click={async () => {
              alwaysOnTop = false;
              try { const { Window } = await import('@tauri-apps/api/window'); const w = await Window.getCurrent(); await w.setAlwaysOnTop(false); } catch {}
            }}>Off</button>
          </div>
        </div>
        <div class="settings-row">
          <span class="settings-label">Performance mode</span>
          <div class="toggle-wrap no-drag" style="gap:6px">
            <button class="toggle-btn perf-toggle {perfMode==='eco'?'toggle-active':''}" on:click={()=>setPerfMode('eco')}>🌿 Eco</button>
            <button class="toggle-btn perf-toggle {perfMode==='normal'?'toggle-active':''}" on:click={()=>setPerfMode('normal')}>⚡ Normal</button>
            <button class="toggle-btn perf-toggle {perfMode==='turbo'?'toggle-active':''}" on:click={()=>setPerfMode('turbo')}>🚀 Turbo</button>
          </div>
        </div>
        <div class="perf-info-box">
          {#if perfMode === 'eco'}
            CPU & RAM only · 5s refresh · minimal system load
          {:else if perfMode === 'normal'}
            All metrics · 1s refresh · balanced
          {:else}
            All metrics · 500ms refresh · maximum accuracy
          {/if}
        </div>
        <div class="settings-row">
          <span class="settings-label">CPU alert threshold</span>
          <span class="settings-val">90%</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">RAM alert threshold</span>
          <span class="settings-val">85%</span>
        </div>
        <button class="close-btn" on:click={() => modal = null}>Close</button>
      </div>

    <!-- ── CHANGELOG ── -->
    {:else if modal === 'changelog'}
      <div class="mbox">
        <div class="mbox-hdr">
          <span class="mbox-title">CHANGELOG</span>
          <button class="mclose" on:click={() => modal = null}>✕</button>
        </div>
        <div class="changelog-list">
          <div class="cl-version">
            <div class="cl-ver-header">
              <span class="cl-ver-tag">v3.0.1</span>
              <span class="cl-ver-date">Current</span>
            </div>
            <div class="cl-item cl-fix">Fixed accurate CPU readings with persistent sysinfo instance</div>
            <div class="cl-item cl-fix">Fixed transparent window background on launch</div>
            <div class="cl-item cl-fix">Fixed font rendering in chart overlays</div>
            <div class="cl-item cl-add">Added Dark / Light theme toggle</div>
            <div class="cl-item cl-add">Added Always on Top toggle in Settings</div>
            <div class="cl-item cl-add">Added Performance modes: Eco / Normal / Turbo</div>
            <div class="cl-item cl-add">Added animated performance badge in header</div>
            <div class="cl-item cl-add">Added System Info panel (CPU, RAM, OS, hostname)</div>
            <div class="cl-item cl-add">Added Quick Notes with local storage</div>
            <div class="cl-item cl-add">Added Changelog modal</div>
            <div class="cl-item cl-add">Added window controls (minimize, maximize, close)</div>
            <div class="cl-item cl-imp">Spotify panel: real session history tracking</div>
            <div class="cl-item cl-imp">Spotify panel: music service selector (Apple Music coming soon)</div>
            <div class="cl-item cl-rem">Removed Top Processes (inaccurate, replaced with System Info)</div>
          </div>
          <div class="cl-version">
            <div class="cl-ver-header">
              <span class="cl-ver-tag">v3.0.0</span>
              <span class="cl-ver-date">Initial release</span>
            </div>
            <div class="cl-item cl-add">Full rewrite from Python/PyQt6 to Tauri + Svelte + Rust</div>
            <div class="cl-item cl-add">White theme with big number metric cards</div>
            <div class="cl-item cl-add">Clickable cards with 60s history charts</div>
            <div class="cl-item cl-add">CPU, RAM, GPU, Disk, Network monitoring</div>
            <div class="cl-item cl-add">Spotify integration with animated visualizer</div>
            <div class="cl-item cl-add">System tray support</div>
            <div class="cl-item cl-add">GitHub Actions CI/CD for Windows builds</div>
          </div>
        </div>
        <button class="close-btn" on:click={() => modal = null}>Close</button>
      </div>

    <!-- ── STATS ── -->
    {:else if modal === 'stats'}
      <div class="mbox">
        <div class="mbox-hdr">
          <span class="mbox-title">DAILY STATS</span>
          <button class="mclose" on:click={() => modal = null}>✕</button>
        </div>
        <div class="stats-grid">
          <div class="stat-item"><div class="stat-label">Peak CPU</div><div class="stat-val" style="color:#3b82f6">{Math.round(Math.max(...cpuHist))}%</div></div>
          <div class="stat-item"><div class="stat-label">Peak RAM</div><div class="stat-val" style="color:#8b5cf6">{Math.round(Math.max(...ramHist))}%</div></div>
          <div class="stat-item"><div class="stat-label">Avg CPU</div><div class="stat-val">{Math.round(cpuHist.reduce((a,b)=>a+b,0)/cpuHist.length)}%</div></div>
          <div class="stat-item"><div class="stat-label">Avg RAM</div><div class="stat-val">{Math.round(ramHist.reduce((a,b)=>a+b,0)/ramHist.length)}%</div></div>
          <div class="stat-item"><div class="stat-label">Download</div><div class="stat-val" style="color:#10b981">{totalToday.toFixed(0)} MB</div></div>
          <div class="stat-item"><div class="stat-label">Uptime</div><div class="stat-val">{fmtUptime(uptimeSecs)}</div></div>
        </div>
        <button class="close-btn" on:click={() => modal = null}>Close</button>
      </div>

    <!-- ── NOTES ── -->
    {:else if modal === 'notes-modal'}

    <!-- ── ACTIONS ── -->
    {:else if modal === 'actions'}
      <div class="mbox">
        <div class="mbox-hdr">
          <span class="mbox-title">QUICK ACTIONS</span>
          <button class="mclose" on:click={() => modal = null}>✕</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button class="action-btn" on:click={() => doAction('restart')}>🔄 Restart System</button>
          <button class="action-btn" on:click={() => doAction('shutdown')}>⚫ Shutdown</button>
          <button class="action-btn" on:click={() => doAction('sleep')}>😴 Sleep Mode</button>
          <button class="action-btn" on:click={() => doAction('taskmgr')}>📋 Task Manager</button>
        </div>
        <button class="close-btn" style="background:#fee2e2;color:#ef4444" on:click={() => modal = null}>✕ Close</button>
      </div>
    {/if}

  </div>
{/if}

<style>
  /* ── Shell ── */
  .shell {
    width: 100%;
    min-width: 360px;
    min-height: unset;
    background: #f5f5f7;
    padding: 16px;
    display: flex; flex-direction: column; gap: 8px;
    font-family: -apple-system, 'Segoe UI', sans-serif;
    color: #1a1a1a;
  }

  /* ── Cards ── */
  .card {
    background: #fff;
    border-radius: 14px;
    border: 1px solid rgba(0,0,0,.07);
    padding: 14px;
    text-align: left;
    transition: transform .12s, box-shadow .12s;
  }
  .card:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,.07); }
  .card:active { transform: scale(.99); }

  /* ── Header ── */
  .hdr { display: flex; justify-content: space-between; align-items: flex-start; background: #fff; border-radius: 14px; border: 1px solid rgba(0,0,0,.07); padding: 14px 16px; }
  .hdr-sub  { font-size: 9px; font-weight: 700; letter-spacing: .16em; color: #bbb; }
  .hdr-title { font-size: 20px; font-weight: 800; color: #1a1a1a; letter-spacing: .02em; }
  .hdr-ver   { font-size: 12px; font-weight: 400; color: #ccc; }
  .hdr-right { text-align: right; }
  .hdr-clock { font-size: 14px; font-weight: 700; color: #1a1a1a; font-variant-numeric: tabular-nums; }
  .hdr-meta  { font-size: 10px; color: #aaa; margin-top: 2px; }

  .demo-badge { background: #fef9c3; border: 1px solid #fde047; border-radius: 8px; padding: 5px 10px; font-size: 10px; font-weight: 700; color: #854d0e; text-align: center; }

  /* ── Grids ── */
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }

  /* ── Metric cards ── */
  .metric-card { position: relative; }
  .metric-label { font-size: 9px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 4px; }
  .metric-num { font-size: 38px; font-weight: 800; color: #1a1a1a; line-height: 1; letter-spacing: -.02em; }
  .metric-num-sm { font-size: 22px; font-weight: 800; color: #1a1a1a; line-height: 1; letter-spacing: -.01em; margin: 4px 0; }
  .metric-unit { font-size: 16px; color: #ccc; font-weight: 400; }
  .metric-sub { font-size: 10px; color: #aaa; margin-top: 3px; }
  .tap-hint { position: absolute; top: 12px; right: 12px; font-size: 11px; font-weight: 700; color: #ddd; }
  .sparkline { display: flex; align-items: flex-end; gap: 2px; height: 24px; margin-top: 8px; }
  .spark-bar { flex: 1; border-radius: 2px 2px 0 0; transition: height .3s; }

  /* ── Disk bar ── */
  .disk-bar-wrap { height: 3px; background: #f0f0f0; border-radius: 99px; overflow: hidden; margin-top: 10px; }
  .disk-bar-fill { height: 100%; border-radius: 99px; transition: width .4s; }

  /* ── Spotify mini ── */
  .spotify-mini { position: relative; }
  .sp-track { font-size: 14px; font-weight: 700; color: #1a1a1a; margin: 4px 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .viz-mini { display: flex; align-items: flex-end; gap: 2px; height: 20px; margin-top: 8px; }
  .vm-bar {
    flex: 1; border-radius: 2px 2px 0 0; height: 10px;
    animation: vmAnim 0.6s ease-in-out infinite alternate;
  }
  @keyframes vmAnim {
    from { height: 3px; opacity: .3; }
    to   { height: 18px; opacity: .8; }
  }

  /* ── Processes ── */
  .procs-card { padding: 14px; }
  .sec-label { font-size: 9px; font-weight: 700; letter-spacing: .12em; color: #aaa; margin-bottom: 10px; }
  .proc-row { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; }
  .proc-name { font-size: 11px; color: #555; width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
  .proc-track { flex: 1; height: 3px; background: #f0f0f0; border-radius: 99px; overflow: hidden; }
  .proc-fill { height: 100%; border-radius: 99px; transition: width .4s; }
  .proc-pct { font-size: 10px; color: #aaa; width: 36px; text-align: right; flex-shrink: 0; font-variant-numeric: tabular-nums; }

  /* ── Buttons ── */
  .btn-action { background: #fff; border: 1px solid rgba(0,0,0,.08); border-radius: 12px; padding: 11px; font-size: 10px; font-weight: 700; color: #666; letter-spacing: .06em; transition: .12s; }
  .btn-action:hover { background: #f5f5f5; }
  .btn-dark { background: #1a1a1a; border-color: #1a1a1a; color: #fff; }
  .btn-dark:hover { background: #333; }

  /* ── Overlay ── */
  .overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,.25); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; font-family: -apple-system, 'Segoe UI', sans-serif; }
  .mbox { background: #fff; border-radius: 20px; padding: 22px; width: 340px; box-shadow: 0 24px 64px rgba(0,0,0,.15); font-family: -apple-system, 'Segoe UI', sans-serif; color: #1a1a1a; }
  .mbox-wide { width: min(560px, 95vw); max-height: 90vh; overflow-y: auto; }
  .mbox-hdr { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .mbox-title { font-size: 10px; font-weight: 700; letter-spacing: .14em; color: #aaa; }
  .mclose { width: 26px; height: 26px; background: #f5f5f5; border: none; border-radius: 50%; font-size: 12px; color: #888; transition: .12s; }
  .mclose:hover { background: #eee; color: #333; }

  /* ── Chart ── */
  .chart-val { font-size: 36px; font-weight: 800; letter-spacing: -.02em; margin-bottom: 16px; }
  .chart-bars { display: flex; align-items: flex-end; height: 120px; gap: 2px; }
  .chart-axis { display: flex; justify-content: space-between; margin-top: 6px; font-size: 10px; color: #ccc; }
  .close-btn { margin-top: 14px; width: 100%; padding: 10px; border: none; background: #f5f5f7; border-radius: 10px; font-size: 12px; font-weight: 600; color: #666; transition: .12s; }
  .close-btn:hover { background: #eee; }

  /* ── Settings ── */
  .settings-row { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid #f5f5f5; }
  .settings-label { font-size: 12px; color: #555; }
  .settings-val { font-size: 12px; font-weight: 600; color: #1a1a1a; }

  /* ── Stats ── */
  .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .stat-item { background: #f9f9f9; border-radius: 10px; padding: 12px; }
  .stat-label { font-size: 10px; color: #aaa; font-weight: 600; letter-spacing: .08em; margin-bottom: 4px; }
  .stat-val { font-size: 22px; font-weight: 800; color: #1a1a1a; }

  /* ── Actions ── */
  .action-btn { background: #f9f9f9; border: 1px solid rgba(0,0,0,.06); border-radius: 10px; padding: 12px 14px; font-size: 12px; font-weight: 600; color: #333; text-align: left; transition: .12s; }
  .action-btn:hover { background: #f0f0f0; }

  /* ── Spotify panel ── */
  .sp-body { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; min-height: 0; }
  .sp-left { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
  .sp-np-card { background: #f9f9f9; border-radius: 12px; padding: 13px; border: 1px solid rgba(0,0,0,.05); }
  .sp-np-label { font-size: 9px; font-weight: 700; letter-spacing: .14em; color: #1DB954; margin-bottom: 8px; }
  .sp-cover { width: 38px; height: 38px; border-radius: 9px; background: linear-gradient(135deg,#1DB954,#158a3e); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff; }
  .sp-np-track { font-size: 14px; font-weight: 700; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sp-np-artist { font-size: 11px; color: #999; }
  .sp-prog-track { height: 3px; background: #eee; border-radius: 99px; overflow: hidden; margin-top: 10px; }
  .sp-prog-fill { height: 100%; background: #1DB954; border-radius: 99px; width: 35%; }
  .sp-times { display: flex; justify-content: space-between; margin-top: 5px; font-size: 10px; color: #ccc; }
  .sp-viz-card { background: #f9f9f9; border-radius: 12px; padding: 13px; border: 1px solid rgba(0,0,0,.05); }
  .sp-viz-label { font-size: 9px; font-weight: 700; letter-spacing: .14em; color: #aaa; margin-bottom: 8px; }
  .sp-viz-bars { display: flex; align-items: flex-end; justify-content: center; gap: 3px; height: 60px; }
  .sp-vbar { width: 7px; background: #1DB954; border-radius: 3px 3px 0 0; transition: height .1s ease; }
  .sp-svc-card { background: #f9f9f9; border-radius: 12px; padding: 13px; border: 1px solid rgba(0,0,0,.05); }
  .sp-svc-label { font-size: 9px; font-weight: 700; letter-spacing: .14em; color: #aaa; margin-bottom: 8px; }
  .sp-svc-item { display: flex; align-items: center; gap: 9px; padding: 8px 10px; border-radius: 9px; border: 1.5px solid transparent; background: #fff; margin-bottom: 5px; cursor: pointer; transition: .12s; }
  .sp-svc-item:last-child { margin-bottom: 0; }
  .sp-svc-active { background: #f0fdf4; border-color: rgba(29,185,84,.2); }
  .sp-svc-icon { width: 26px; height: 26px; border-radius: 6px; background: #f0fdf4; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .sp-svc-name { font-size: 11px; font-weight: 600; color: #1a1a1a; flex: 1; }
  .sp-svc-status { font-size: 9px; font-weight: 700; }
  .sp-right { display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
  .sp-hist-label { font-size: 9px; font-weight: 700; letter-spacing: .14em; color: #aaa; margin-bottom: 10px; }
  .sp-hist-list { display: flex; flex-direction: column; gap: 5px; overflow-y: auto; max-height: 420px; }
  .sp-track-item { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 9px; border: 1px solid rgba(0,0,0,.05); background: #fafafa; transition: .12s; }
  .sp-track-item:hover { background: #f3f3f3; }
  .sp-track-active { background: #f0fdf4; border-color: rgba(29,185,84,.2); }
  .sp-track-num { font-size: 9px; color: #ddd; width: 12px; text-align: right; flex-shrink: 0; }
  .sp-track-dot { width: 28px; height: 28px; border-radius: 7px; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
  .sp-track-dot-active { background: linear-gradient(135deg,#1DB954,#158a3e); color: #fff; }
  .sp-track-info { flex: 1; min-width: 0; }
  .sp-track-name { font-size: 11px; font-weight: 600; color: #1a1a1a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sp-track-artist { font-size: 9px; color: #aaa; }
  .sp-track-time { font-size: 9px; color: #ccc; flex-shrink: 0; }
  .sp-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: #bbb; font-size: 12px; text-align: center; }

  /* ── Window controls ── */
  .win-controls { display: flex; gap: 5px; margin-top: 8px; justify-content: flex-end; }
  .win-btn { width: 22px; height: 22px; border-radius: 50%; border: none; background: #f0f0f0; color: #888; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; transition: .12s; padding: 0; line-height: 1; }
  .win-btn:hover { background: #e0e0e0; color: #333; }
  .win-close:hover { background: #fee2e2; color: #ef4444; }

  /* ── Dark theme ── */
  .shell.dark { background: #111113; color: #e8e8ea; }
  .shell.dark .card { background: #1c1c1e; border-color: rgba(255,255,255,.08); }
  .shell.dark .hdr  { background: #1c1c1e; border-color: rgba(255,255,255,.08); }
  .shell.dark .hdr-title { color: #e8e8ea; }
  .shell.dark .hdr-clock  { color: #e8e8ea; }
  .shell.dark .procs-card { background: #1c1c1e; border-color: rgba(255,255,255,.08); }
  .shell.dark .metric-num { color: #e8e8ea; }
  .shell.dark .metric-num-sm { color: #e8e8ea; }
  .shell.dark .proc-name  { color: #aaa; }
  .shell.dark .proc-track { background: rgba(255,255,255,.08); }
  .shell.dark .btn-action { background: #1c1c1e; border-color: rgba(255,255,255,.1); color: #aaa; }
  .shell.dark .btn-action:hover { background: #2c2c2e; }
  .shell.dark .btn-dark   { background: #e8e8ea; color: #111; }
  .shell.dark .btn-dark:hover { background: #fff; }
  .shell.dark .sp-track   { color: #e8e8ea; }
  .shell.dark .win-btn    { background: rgba(255,255,255,.1); color: #888; }
  .shell.dark .win-btn:hover { background: rgba(255,255,255,.2); color: #e8e8ea; }
  .shell.dark .demo-badge { background: #2c2510; border-color: #854d0e; }
  .shell.dark .disk-bar-wrap { background: rgba(255,255,255,.08); }
  .shell.dark .sparkline .spark-bar { opacity: 0.8; }

  /* ── Settings toggles ── */
  .toggle-wrap { display: flex; gap: 4px; }
  .toggle-btn  { padding: 4px 12px; border-radius: 8px; border: 1px solid rgba(0,0,0,.1); background: #f5f5f5; font-size: 11px; font-weight: 600; color: #888; transition: .12s; }
  .toggle-btn.toggle-active { background: #1a1a1a; color: #fff; border-color: #1a1a1a; }
  .shell.dark .toggle-btn { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.1); color: #888; }
  .shell.dark .toggle-btn.toggle-active { background: #e8e8ea; color: #111; border-color: #e8e8ea; }

  .shell.dark ~ .overlay .mbox { background: #1c1c1e; color: #e8e8ea; border: 1px solid rgba(255,255,255,.1); }
  .shell.dark ~ .overlay .mbox-title { color: #666; }
  .shell.dark ~ .overlay .mclose { background: rgba(255,255,255,.1); color: #888; }
  .shell.dark ~ .overlay .settings-row { border-color: rgba(255,255,255,.06); }
  .shell.dark ~ .overlay .settings-label { color: #aaa; }
  .shell.dark ~ .overlay .settings-val { color: #e8e8ea; }
  .shell.dark ~ .overlay .close-btn { background: rgba(255,255,255,.08); color: #aaa; }
  .shell.dark ~ .overlay .close-btn:hover { background: rgba(255,255,255,.14); }
  .shell.dark ~ .overlay .stat-item { background: rgba(255,255,255,.06); }
  .shell.dark ~ .overlay .stat-label { color: #666; }
  .shell.dark ~ .overlay .stat-val { color: #e8e8ea; }
  .shell.dark ~ .overlay .action-btn { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1); color: #ccc; }
  .shell.dark ~ .overlay .action-btn:hover { background: rgba(255,255,255,.12); }
  .shell.dark ~ .overlay .sp-np-card,
  .shell.dark ~ .overlay .sp-viz-card,
  .shell.dark ~ .overlay .sp-svc-card { background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.08); }
  .shell.dark ~ .overlay .sp-np-track { color: #e8e8ea; }
  .shell.dark ~ .overlay .sp-track-item { background: rgba(255,255,255,.04); border-color: rgba(255,255,255,.06); }
  .shell.dark ~ .overlay .sp-track-item:hover { background: rgba(255,255,255,.08); }
  .shell.dark ~ .overlay .sp-track-name { color: #e8e8ea; }
  .shell.dark ~ .overlay .sp-svc-item { background: rgba(255,255,255,.06); }
  .shell.dark ~ .overlay .mbox { background: #1c1c1e; }
  .shell.dark ~ .overlay .chart-axis span { color: #555; }

  /* ── Header title row ── */
  .hdr-title-row { display: flex; align-items: center; gap: 8px; }

  /* ── Perf badge ── */
  .perf-badge {
    display: flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 99px;
    font-size: 10px; font-weight: 700; letter-spacing: .08em;
    animation: badgeSlide .3s cubic-bezier(.34,1.56,.64,1) both;
  }
  @keyframes badgeSlide {
    from { opacity: 0; transform: translateX(-12px) scale(.85); }
    to   { opacity: 1; transform: translateX(0) scale(1); }
  }
  .perf-eco    { background: #f0fdf4; color: #16a34a; }
  .perf-normal { background: #fffbeb; color: #d97706; }
  .perf-turbo  { background: #fef2f2; color: #dc2626; animation: badgeSlide .3s cubic-bezier(.34,1.56,.64,1) both, turboPulse 1.5s ease-in-out infinite; }
  .perf-icon   { font-size: 12px; }
  .perf-label  { font-size: 9px; }

  @keyframes turboPulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(220,38,38,.0); }
    50%      { box-shadow: 0 0 0 3px rgba(220,38,38,.15); }
  }

  .shell.dark .perf-eco    { background: rgba(22,163,74,.15);  color: #4ade80; }
  .shell.dark .perf-normal { background: rgba(217,119,6,.15);  color: #fbbf24; }
  .shell.dark .perf-turbo  { background: rgba(220,38,38,.15);  color: #f87171; }

  /* ── Perf info box in settings ── */
  .perf-info-box {
    font-size: 10px; color: #999; background: #f9f9f9;
    border-radius: 8px; padding: 7px 12px; margin-top: -6px;
    border: 1px solid rgba(0,0,0,.05);
  }
  .shell.dark ~ .overlay .perf-info-box { background: rgba(255,255,255,.05); color: #666; border-color: rgba(255,255,255,.08); }

  /* Perf toggle buttons slightly wider */
  .perf-toggle { min-width: 60px; }


  /* ── System Info ── */
  .sysinfo-card { padding: 14px; }
  .sysinfo-row  { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid rgba(0,0,0,.04); }
  .sysinfo-row:last-child { border-bottom: none; }
  .sysinfo-key  { font-size: 9px; font-weight: 700; letter-spacing: .1em; color: #aaa; flex-shrink: 0; }
  .sysinfo-val  { font-size: 10px; font-weight: 600; color: #333; text-align: right; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 110px; }
  .shell.dark .sysinfo-row  { border-color: rgba(255,255,255,.05); }
  .shell.dark .sysinfo-val  { color: #ccc; }

  /* ── Notes card ── */
  .notes-card   { text-align: left; padding: 14px; display: flex; flex-direction: column; gap: 6px; }
  .notes-header { display: flex; align-items: center; justify-content: space-between; }
  .notes-count  { background: #f0f0f0; color: #888; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 99px; }
  .notes-empty  { font-size: 11px; color: #ccc; flex: 1; display: flex; align-items: center; }
  .notes-preview { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .note-preview-item { display: flex; align-items: center; gap: 6px; }
  .note-preview-dot  { width: 4px; height: 4px; border-radius: 50%; background: #3b82f6; flex-shrink: 0; }
  .note-preview-text { font-size: 10px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .notes-more   { font-size: 9px; color: #bbb; padding-left: 10px; }
  .notes-add-hint { font-size: 9px; color: #ccc; margin-top: auto; }
  .shell.dark .notes-count      { background: rgba(255,255,255,.1); color: #666; }
  .shell.dark .note-preview-text { color: #999; }

  /* ── Notes modal ── */
  .notes-mbox   { width: 360px; max-height: 80vh; display: flex; flex-direction: column; }
  .note-input-wrap { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
  .note-textarea {
    width: 100%; padding: 10px 12px; border: 1px solid rgba(0,0,0,.1);
    border-radius: 10px; font-size: 12px; font-family: inherit; resize: none;
    background: #f9f9f9; color: #1a1a1a; outline: none; transition: border .15s;
  }
  .note-textarea:focus { border-color: #3b82f6; background: #fff; }
  .note-input-actions { display: flex; gap: 6px; justify-content: flex-end; }
  .note-hint    { font-size: 10px; color: #ccc; text-align: right; }
  .note-save-btn  { background: #1a1a1a; color: #fff; border: none; border-radius: 8px; padding: 7px 14px; font-size: 11px; font-weight: 700; cursor: pointer; transition: .12s; }
  .note-save-btn:hover { background: #333; }
  .note-cancel-btn { background: #f5f5f5; color: #888; border: none; border-radius: 8px; padding: 7px 14px; font-size: 11px; font-weight: 600; cursor: pointer; }
  .notes-list   { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 340px; }
  .notes-list-empty { font-size: 12px; color: #ccc; text-align: center; padding: 24px; }
  .note-item    { background: #f9f9f9; border: 1px solid rgba(0,0,0,.06); border-radius: 10px; padding: 10px 12px; transition: .12s; }
  .note-item:hover { background: #f3f3f3; }
  .note-editing { border-color: #3b82f6; background: #eff6ff; }
  .note-item-text   { font-size: 12px; color: #1a1a1a; white-space: pre-wrap; word-break: break-word; margin-bottom: 6px; }
  .note-item-footer { display: flex; justify-content: space-between; align-items: center; }
  .note-item-ts     { font-size: 9px; color: #bbb; }
  .note-item-actions { display: flex; gap: 6px; }
  .note-edit-btn, .note-del-btn { font-size: 10px; font-weight: 600; border: none; border-radius: 6px; padding: 3px 8px; cursor: pointer; transition: .12s; }
  .note-edit-btn { background: #eff6ff; color: #3b82f6; }
  .note-edit-btn:hover { background: #dbeafe; }
  .note-del-btn  { background: #fef2f2; color: #ef4444; }
  .note-del-btn:hover { background: #fee2e2; }

  /* ── Changelog ── */
  .changelog-list { display: flex; flex-direction: column; gap: 16px; max-height: 420px; overflow-y: auto; margin-bottom: 12px; }
  .cl-version { display: flex; flex-direction: column; gap: 5px; }
  .cl-ver-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; padding-bottom: 6px; border-bottom: 1px solid rgba(0,0,0,.06); }
  .cl-ver-tag  { font-size: 13px; font-weight: 800; color: #1a1a1a; }
  .cl-ver-date { font-size: 10px; color: #aaa; }
  .cl-item     { font-size: 11px; padding: 3px 0 3px 16px; position: relative; color: #555; }
  .cl-item::before { content: ''; position: absolute; left: 5px; top: 8px; width: 5px; height: 5px; border-radius: 50%; }
  .cl-add::before  { background: #10b981; }
  .cl-fix::before  { background: #3b82f6; }
  .cl-imp::before  { background: #f59e0b; }
  .cl-rem::before  { background: #ef4444; }
  .shell.dark ~ .overlay .cl-ver-tag  { color: #e8e8ea; }
  .shell.dark ~ .overlay .cl-ver-header { border-color: rgba(255,255,255,.08); }
  .shell.dark ~ .overlay .cl-item    { color: #888; }
</style>
