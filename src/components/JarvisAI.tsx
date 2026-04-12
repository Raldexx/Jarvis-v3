import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import type { PerfMode, Language } from '@/store/system';

// ── ThemeConfig mirror ─────────────────────────────────────────────────────
interface ThemeConfig {
  bg: string; accent: string; accentSoft: string;
  cardBg: string; cardBorder: string;
  textPrimary: string; textMuted: string;
  sparkline: string; nowPlayingColor: string;
  banner: string; bannerBg: string; bannerBorder: string; bannerText: string;
  photo: string; photo2?: string;
}

interface FridayAIProps {
  open:      boolean;
  onClose:   () => void;
  tc:        ThemeConfig | null;
  perfMode:  PerfMode;
  language:  Language;
}

// ── Language → voice / whisper mapping ────────────────────────────────────
const LANG_VOICE: Record<Language, string> = {
  tr: 'shimmer',  // warm female voice for Turkish
  en: 'alloy',
  es: 'nova',
};
const LANG_WHISPER: Record<Language, string> = {
  tr: 'tr',
  en: 'en',
  es: 'es',
};
const LANG_SR: Record<Language, string> = {
  tr: 'tr-TR',
  en: 'en-US',
  es: 'es-ES',
};

// ── App launch — tries Tauri invoke first, falls back to URL ───────────────
async function tauriOpen(url: string): Promise<boolean> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    await invoke('open_url', { url });
    return true;
  } catch {
    try {
      const { open } = await import('@tauri-apps/plugin-opener');
      await open(url);
      return true;
    } catch {
      return false;
    }
  }
}

async function tauriKill(processName: string): Promise<string> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('kill_process', { name: processName });
  } catch {
    return `kill_process not available (add to Rust backend)`;
  }
}

async function tauriShell(cmd: string): Promise<string> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return await invoke<string>('run_command', { command: cmd });
  } catch {
    return `run_command not available`;
  }
}

// ── App registry ──────────────────────────────────────────────────────────
const APP_MAP: Record<string, { url: string; kill?: string }> = {
  discord:      { url: 'discord://',                  kill: 'Discord.exe' },
  spotify:      { url: 'spotify://',                  kill: 'Spotify.exe' },
  obsidian:     { url: 'obsidian://',                 kill: 'Obsidian.exe' },
  notion:       { url: 'notion://',                   kill: 'Notion.exe' },
  steam:        { url: 'steam://',                    kill: 'steam.exe' },
  vscode:       { url: 'vscode://',                   kill: 'Code.exe' },
  chrome:       { url: 'https://google.com' },
  youtube:      { url: 'https://youtube.com' },
  gmail:        { url: 'https://mail.google.com' },
  'google mail':{ url: 'https://mail.google.com' },
  drive:        { url: 'https://drive.google.com' },
  'google drive':{ url: 'https://drive.google.com' },
  calendar:     { url: 'https://calendar.google.com' },
  'google calendar':{ url: 'https://calendar.google.com' },
  meet:         { url: 'https://meet.google.com' },
  github:       { url: 'https://github.com' },
  twitch:       { url: 'https://twitch.tv' },
  netflix:      { url: 'https://netflix.com' },
  reddit:       { url: 'https://reddit.com' },
  twitter:      { url: 'https://twitter.com' },
  linkedin:     { url: 'https://linkedin.com' },
  figma:        { url: 'https://figma.com' },
  tarayıcı:     { url: 'https://google.com' },
  browser:      { url: 'https://google.com' },
};

async function launchApp(name: string): Promise<string> {
  const key = name.toLowerCase().trim();
  const app = APP_MAP[key];
  if (!app) {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(name)}`, '_blank');
    return `${name} için arama yapıyorum.`;
  }
  const ok = await tauriOpen(app.url);
  if (!ok) window.open(app.url, '_blank');
  return `${name} açılıyor.`;
}

async function closeApp(name: string): Promise<string> {
  const key = name.toLowerCase().trim();
  const app = APP_MAP[key];
  if (app?.kill) {
    const result = await tauriKill(app.kill);
    return `${name} kapatılıyor. ${result}`;
  }
  return `${name} için kapat komutu tanımlı değil.`;
}

// ── Protocol commands ──────────────────────────────────────────────────────
const PROTOCOLS: Record<string, { apps: string[]; reply: string }> = {
  'başlangıç protokolü': { apps: ['discord://', 'spotify://'],                                   reply: 'Başlangıç protokolü aktif. Discord ve Spotify başlatılıyor, efendim.' },
  'başlangıç':           { apps: ['discord://', 'spotify://'],                                   reply: 'Sistemler başlatılıyor.' },
  'iş protokolü':        { apps: ['https://mail.google.com','https://notion.so','https://github.com'], reply: 'İş protokolü aktif. Gmail, Notion ve GitHub hazırlanıyor.' },
  'gece protokolü':      { apps: ['spotify://'],                                                 reply: 'Gece modu aktif. Spotify açılıyor, iyi geceler.' },
  'oyun protokolü':      { apps: ['discord://', 'steam://'],                                     reply: 'Oyun modu. Discord ve Steam başlatılıyor.' },
  'startup protocol':    { apps: ['discord://', 'spotify://'],                                   reply: 'Startup protocol activated. Launching Discord and Spotify.' },
  'work protocol':       { apps: ['https://mail.google.com','https://notion.so','https://github.com'], reply: 'Work protocol active. Opening Gmail, Notion and GitHub.' },
};

async function handleProtocol(text: string): Promise<string | null> {
  const lower = text.toLowerCase();
  for (const [phrase, cfg] of Object.entries(PROTOCOLS)) {
    if (lower.includes(phrase)) {
      for (let i = 0; i < cfg.apps.length; i++) {
        setTimeout(async () => {
          const ok = await tauriOpen(cfg.apps[i]);
          if (!ok) window.open(cfg.apps[i], '_blank');
        }, i * 700);
      }
      return cfg.reply;
    }
  }
  return null;
}

async function detectAndExecute(text: string, language: Language): Promise<string | null> {
  const lower = text.toLowerCase();

  // Protocol check
  const pr = await handleProtocol(lower);
  if (pr) return pr;

  // Close / kapat
  const closePatterns = [/kapat\s+([\w\s]+)/i, /close\s+([\w]+)/i, /shut down\s+([\w]+)/i, /([\w]+)\s+kapat/i];
  for (const pat of closePatterns) {
    const m = pat.exec(lower);
    if (m) {
      const app = (m[1]||'').trim().split(' ')[0];
      if (app.length > 1 && APP_MAP[app]) return await closeApp(app);
    }
  }

  // Open / aç / başlat / launch / open
  const openPatterns = [
    /(?:aç|başlat|open|launch|start|run)\s+([\w\s]+)/i,
    /([\w]+)\s+(?:aç|başlat|open)/i,
  ];
  for (const pat of openPatterns) {
    const m = pat.exec(lower);
    if (m) {
      const raw = (m[1]||'').trim();
      const app = raw.split(/\s+/)[0].toLowerCase();
      if (app.length > 1) return await launchApp(app);
    }
  }

  // Direct name match
  for (const key of Object.keys(APP_MAP)) {
    if (lower.includes(key)) return await launchApp(key);
  }

  // System power commands
  if (lower.match(/bilgisayarı kapat|sistemi kapat|shutdown|shut down/)) {
    await tauriShell('shutdown /s /t 10');
    return language === 'tr' ? 'Sistem 10 saniye içinde kapanıyor.' : 'System shutting down in 10 seconds.';
  }
  if (lower.match(/yeniden başlat|restart|reboot/)) {
    await tauriShell('shutdown /r /t 10');
    return language === 'tr' ? 'Sistem 10 saniye içinde yeniden başlıyor.' : 'System restarting in 10 seconds.';
  }
  if (lower.match(/uyku|sleep mode|hibernat/)) {
    await tauriShell('rundll32.exe powrprof.dll,SetSuspendState 0,1,0');
    return language === 'tr' ? 'Uyku moduna geçiliyor.' : 'Entering sleep mode.';
  }

  // Google Drive search
  if (lower.match(/drive'da|drive da|google drive|dosya ara|find file/)) {
    const query = lower.replace(/.*(?:drive'?da?|google drive|dosya ara|find file)\s*/i, '').trim();
    if (query) window.open(`https://drive.google.com/drive/search?q=${encodeURIComponent(query)}`, '_blank');
    else window.open('https://drive.google.com', '_blank');
    return language === 'tr' ? `Google Drive'da aranıyor: ${query || 'ana sayfa açıldı'}` : `Searching Google Drive: ${query || 'opened'}`;
  }

  // Google Calendar
  if (lower.match(/takvim|calendar|etkinlik|event|randevu/)) {
    window.open('https://calendar.google.com', '_blank');
    return language === 'tr' ? 'Google Calendar açılıyor.' : 'Opening Google Calendar.';
  }

  return null;
}

// ── Semantic Memory ────────────────────────────────────────────────────────
interface MemEntry { id: string; text: string; ts: number; category: 'fact'|'preference'|'command'|'general'; }

function useMemory() {
  const [mem, setMem] = useState<MemEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('friday_memory') || '[]'); } catch { return []; }
  });
  const add = useCallback((text: string, cat: MemEntry['category'] = 'general') => {
    setMem(prev => {
      const updated = [{ id: Date.now().toString(), text, ts: Date.now(), category: cat }, ...prev].slice(0, 300);
      localStorage.setItem('friday_memory', JSON.stringify(updated));
      return updated;
    });
  }, []);
  const relevant = useCallback((query: string, limit = 5): MemEntry[] => {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    return mem
      .map(e => ({ e, score: words.reduce((a, w) => a + (e.text.toLowerCase().includes(w) ? 1 : 0), 0) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit).map(x => x.e);
  }, [mem]);
  const clear = () => {
    setMem([]);
    localStorage.removeItem('friday_memory');
  };
  return { mem, add, relevant, clear };
}

// ── Canvas Ring Visualizer ─────────────────────────────────────────────────
type VizState = 'idle'|'connecting'|'listening'|'speaking'|'thinking';

function RingVisualizer({ state, volume, tc }: { state: VizState; volume: number; tc: ThemeConfig|null }) {
  const ref   = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);
  const raf   = useRef(0);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ctx = c.getContext('2d')!;
    const W = c.width, H = c.height, cx = W/2, cy = H/2, R = 82, BARS = 72;
    const accent = tc?.accent || '#60a5fa';

    const draw = () => {
      ctx.clearRect(0,0,W,H);

      if (state === 'thinking') {
        ctx.save(); ctx.translate(cx,cy); ctx.rotate(phase.current*2);
        for (let i=0;i<8;i++){
          const a=(i/8)*Math.PI*2;
          ctx.beginPath(); ctx.arc(Math.cos(a)*R,Math.sin(a)*R,4,0,Math.PI*2);
          ctx.fillStyle=accent+Math.round((0.15+i/8*0.6)*255).toString(16).padStart(2,'0'); ctx.fill();
        }
        ctx.restore(); phase.current+=0.03;
        raf.current=requestAnimationFrame(draw); return;
      }

      if (state === 'connecting') {
        for (let i=0;i<12;i++){
          const a=(i/12)*Math.PI*2+phase.current;
          const p=0.2+0.7*((Math.sin(phase.current*4+i)+1)/2);
          ctx.beginPath(); ctx.arc(cx+Math.cos(a)*R,cy+Math.sin(a)*R,3,0,Math.PI*2);
          ctx.fillStyle=accent+Math.round(p*200).toString(16).padStart(2,'0'); ctx.fill();
        }
        phase.current+=0.025; raf.current=requestAnimationFrame(draw); return;
      }

      const isActive = state==='listening'||state==='speaking';

      if (isActive) {
        const g=ctx.createRadialGradient(cx,cy,R-10,cx,cy,R+40+volume*45);
        g.addColorStop(0,accent+Math.round((0.06+volume*0.18)*255).toString(16).padStart(2,'0'));
        g.addColorStop(1,'transparent');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R+55,0,Math.PI*2); ctx.fill();
      }

      for (let i=0;i<BARS;i++){
        const angle=(i/BARS)*Math.PI*2-Math.PI/2;
        const barH = isActive
          ? Math.max(3,6+Math.sin(phase.current*4+i*0.35)*volume*30+Math.sin(phase.current*7+i*0.7)*volume*15)
          : 3+Math.sin(phase.current*0.8+i*0.25)*1.5;
        const alpha = isActive ? 0.4+(barH/50)*0.6 : 0.18;
        ctx.strokeStyle=accent+Math.round(alpha*255).toString(16).padStart(2,'0');
        ctx.lineWidth=2.5; ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(angle)*R, cy+Math.sin(angle)*R);
        ctx.lineTo(cx+Math.cos(angle)*(R+barH), cy+Math.sin(angle)*(R+barH));
        ctx.stroke();
      }

      ctx.beginPath(); ctx.arc(cx,cy,R-2,0,Math.PI*2);
      ctx.strokeStyle=accent+(isActive?'55':'18'); ctx.lineWidth=1.5; ctx.stroke();

      const pSize=isActive?8+volume*20:5+Math.sin(phase.current*1.2)*2;
      const pg=ctx.createRadialGradient(cx,cy,0,cx,cy,pSize+6);
      pg.addColorStop(0,accent+'cc'); pg.addColorStop(1,accent+'00');
      ctx.fillStyle=pg; ctx.beginPath(); ctx.arc(cx,cy,pSize+6,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx,cy,pSize,0,Math.PI*2);
      ctx.fillStyle=accent+(isActive?'ee':'55'); ctx.fill();

      phase.current+=isActive?0.045:0.012;
      raf.current=requestAnimationFrame(draw);
    };
    raf.current=requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(raf.current);
  },[state,volume,tc]);

  return <canvas ref={ref} width={300} height={300} style={{display:'block',margin:'0 auto'}} />;
}

// ── Conversation msg ──────────────────────────────────────────────────────
interface Msg { role:'user'|'assistant'; text:string; ts:number; }

// ── Main Component ────────────────────────────────────────────────────────
export function FridayAI({ open, onClose, tc, perfMode, language }: FridayAIProps) {
  const [apiKey, setApiKey]         = useState(()=>localStorage.getItem('friday_openai_key')||'');
  const [showKey, setShowKey]       = useState(false);
  const [tab, setTab]               = useState<'voice'|'memory'|'meet'|'integrations'>('voice');
  const [connState, setConnState]   = useState<VizState>('idle');
  const [volume, setVolume]         = useState(0);
  const [msgs, setMsgs]             = useState<Msg[]>([]);
  const [liveText, setLiveText]     = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [meetUrl, setMeetUrl]       = useState('');
  const [meetNote, setMeetNote]     = useState('');
  const [driveQuery, setDriveQuery] = useState('');

  const pcRef       = useRef<RTCPeerConnection|null>(null);
  const dcRef       = useRef<RTCDataChannel|null>(null);
  const audioRef    = useRef<HTMLAudioElement|null>(null);
  const streamRef   = useRef<MediaStream|null>(null);
  const analyserRef = useRef<AnalyserNode|null>(null);
  const audioCtxRef = useRef<AudioContext|null>(null);
  const volRafRef   = useRef<number>(0);
  const liveRef     = useRef('');
  liveRef.current = liveText;

  const { mem, add: addMemory, relevant, clear: clearMemory } = useMemory();

  // Eco mode: block voice
  const isEco = perfMode === 'eco';

  useEffect(()=>{ if(apiKey) localStorage.setItem('friday_openai_key',apiKey); },[apiKey]);

  const buildSystemPrompt = useCallback((query='')=>{
    const entries = relevant(query);
    const memCtx = entries.length > 0
      ? `\n\nKullanıcı hakkında bildiğim:\n${entries.map(e=>`• ${e.text}`).join('\n')}`
      : '';
    const langInstr = language==='tr'
      ? 'Türkçe konuş. Yanıtların kısa ve doğal olsun.'
      : language==='es'
      ? 'Habla español. Respuestas cortas y naturales.'
      : 'Speak English. Keep responses short and natural.';
    return `Sen F.R.I.D.A.Y.'sın — zeki, kısa ve kişisel sesli AI asistansın. ${langInstr} Gereksiz selamlama yapma. Samimi ve biraz espirili ol.${memCtx}

Yeteneklerin:
- Uygulama açma/kapatma (Discord, Spotify, Steam, Obsidian, Chrome, YouTube, Gmail, Google Drive, Google Calendar, GitHub, Notion vb.)
- Protokol komutları: başlangıç protokolü, iş protokolü, oyun protokolü, gece protokolü
- Google Drive'da dosya arama, Google Calendar etkinlikleri
- Sistem komutları: kapat, yeniden başlat, uyku
- Sorulara kısa ve net yanıt verme`;
  },[relevant, language]);

  const startVolMeter = useCallback(async ()=>{
    try {
      audioCtxRef.current = new AudioContext();
      const src = audioCtxRef.current.createMediaStreamSource(streamRef.current!);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize=256;
      src.connect(analyserRef.current);
      const buf=new Uint8Array(analyserRef.current.frequencyBinCount);
      const tick=()=>{
        analyserRef.current?.getByteFrequencyData(buf);
        setVolume(buf.reduce((a,b)=>a+b,0)/buf.length/120);
        volRafRef.current=requestAnimationFrame(tick);
      };
      volRafRef.current=requestAnimationFrame(tick);
    } catch {}
  },[]);

  const stopVolMeter = useCallback(()=>{
    cancelAnimationFrame(volRafRef.current);
    audioCtxRef.current?.close().catch(()=>{});
    audioCtxRef.current=null; analyserRef.current=null; setVolume(0);
  },[]);

  const handleEvent = useCallback((evt: Record<string,unknown>)=>{
    switch(evt.type){
      case 'session.created':
        setConnState('listening'); setSessionActive(true);
        dcRef.current?.send(JSON.stringify({
          type:'session.update',
          session:{
            modalities:['text','audio'],
            instructions: buildSystemPrompt(),
            voice: LANG_VOICE[language],
            input_audio_format:'pcm16',
            output_audio_format:'pcm16',
            input_audio_transcription:{ model:'whisper-1', language: LANG_WHISPER[language] },
            turn_detection:{ type:'server_vad', threshold:0.5, prefix_padding_ms:300, silence_duration_ms:600 },
          }
        }));
        break;

      case 'input_audio_buffer.speech_started':
        setConnState('listening'); setLiveText('');
        break;

      case 'input_audio_buffer.speech_stopped':
        setConnState('thinking');
        break;

      case 'conversation.item.input_audio_transcription.completed': {
        const userText=(evt.transcript as string)||'';
        if(!userText.trim()) break;
        setLiveText('');
        setMsgs(prev=>[...prev,{role:'user',text:userText,ts:Date.now()}]);

        // Run execute in background, inject result if needed
        detectAndExecute(userText, language).then(actionReply => {
          if(actionReply){
            setMsgs(prev=>[...prev,{role:'assistant',text:actionReply,ts:Date.now()}]);
            dcRef.current?.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role:'assistant',content:[{type:'text',text:actionReply}]}}));
            dcRef.current?.send(JSON.stringify({type:'response.create'}));
          }
        });

        // Auto memory extraction
        const lower = userText.toLowerCase();
        if(lower.match(/ben |benim |i am |i'm /)) addMemory(userText,'fact');
        else if(lower.match(/seviyorum|istemiyorum|like |hate /)) addMemory(userText,'preference');
        break;
      }

      case 'response.audio_transcript.delta':
        setLiveText(prev=>prev+((evt.delta as string)||''));
        setConnState('speaking');
        break;

      case 'response.audio_transcript.done': {
        const final=(evt.transcript as string)||liveRef.current;
        if(final.trim()) setMsgs(prev=>[...prev,{role:'assistant',text:final,ts:Date.now()}]);
        setLiveText('');
        break;
      }

      case 'response.done':
        setConnState('listening');
        break;

      case 'error':
        console.error('RT error:',evt);
        setConnState('idle');
        break;
    }
  },[buildSystemPrompt, language, addMemory]);

  const connect = useCallback(async()=>{
    if(!apiKey){setShowKey(true);return;}
    if(sessionActive) return;
    setConnState('connecting');
    try {
      const tokenRes = await fetch('https://api.openai.com/v1/realtime/sessions',{
        method:'POST',
        headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
        body: JSON.stringify({ model:'gpt-4o-realtime-preview-2024-12-17', voice: LANG_VOICE[language] }),
      });
      if(!tokenRes.ok){ const e=await tokenRes.json(); throw new Error(e.error?.message||`HTTP ${tokenRes.status}`); }
      const data=await tokenRes.json();
      const ephKey=data.client_secret?.value;
      if(!ephKey) throw new Error('Ephemeral key alınamadı');

      const pc=new RTCPeerConnection(); pcRef.current=pc;
      const audio=new Audio(); audio.autoplay=true; audioRef.current=audio;
      pc.ontrack=e=>{ audio.srcObject=e.streams[0]; };

      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      streamRef.current=stream;
      stream.getTracks().forEach(t=>pc.addTrack(t,stream));
      await startVolMeter();

      const dc=pc.createDataChannel('oai-events'); dcRef.current=dc;
      dc.addEventListener('message',e=>{ try{ handleEvent(JSON.parse(e.data)); }catch{} });

      const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
      const sdpRes=await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17',{
        method:'POST',
        headers:{'Authorization':`Bearer ${ephKey}`,'Content-Type':'application/sdp'},
        body:offer.sdp,
      });
      if(!sdpRes.ok) throw new Error(`SDP ${sdpRes.status}`);
      await pc.setRemoteDescription({type:'answer',sdp:await sdpRes.text()});
      pc.onconnectionstatechange=()=>{
        if(pc.connectionState==='failed'||pc.connectionState==='disconnected') disconnect();
      };
    } catch(err){
      const msg=err instanceof Error?err.message:'Bağlantı hatası';
      setMsgs(prev=>[...prev,{role:'assistant',text:`❌ ${msg}`,ts:Date.now()}]);
      setConnState('idle'); setSessionActive(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[apiKey, language, sessionActive, startVolMeter, handleEvent]);

  const disconnect = useCallback(()=>{
    dcRef.current?.close(); pcRef.current?.close();
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if(audioRef.current) audioRef.current.srcObject=null;
    stopVolMeter();
    dcRef.current=null; pcRef.current=null; streamRef.current=null; audioRef.current=null;
    setConnState('idle'); setSessionActive(false); setLiveText('');
  },[stopVolMeter]);

  useEffect(()=>{ if(!open) disconnect(); },[open,disconnect]);

  // Disconnect + reconnect if language changes while connected
  useEffect(()=>{
    if(sessionActive){ disconnect(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[language]);

  const accent=tc?.accent||'#60a5fa';

  const STATE_LABEL: Record<VizState,string> = {
    idle:       language==='tr'?'Başlamak için mikrofona bas':language==='es'?'Presiona el micrófono':'Press mic to start',
    connecting: language==='tr'?'Bağlanıyor...':language==='es'?'Conectando...':'Connecting...',
    listening:  language==='tr'?'🎙 Seni dinliyorum...':language==='es'?'🎙 Escuchando...':'🎙 Listening...',
    speaking:   language==='tr'?'🔊 Konuşuyor...':language==='es'?'🔊 Hablando...':'🔊 Speaking...',
    thinking:   language==='tr'?'🧠 Düşünüyor...':language==='es'?'🧠 Pensando...':'🧠 Thinking...',
  };

  const tabSt=(active:boolean):React.CSSProperties=>tc
    ?(active?{background:tc.accent,color:'#000'}:{background:'rgba(255,255,255,0.07)',color:tc.textMuted}):{};

  const inputCls=cn('w-full px-2.5 py-1.5 rounded-lg border text-[11px] focus:outline-none',
    tc?'bg-white/5 border-white/10 text-white placeholder-white/30'
      :'bg-white border-black/10 text-gray-800 placeholder-gray-400');

  const quickCmds = [
    { label:'🚀 Başlangıç', cmd:'başlangıç protokolü' },
    { label:'💼 İş',        cmd:'iş protokolü' },
    { label:'🎮 Oyun',      cmd:'oyun protokolü' },
    { label:'🎮 Discord',   cmd:'discord aç' },
    { label:'🎵 Spotify',   cmd:'spotify aç' },
    { label:'📁 Drive',     cmd:'google drive aç' },
  ];

  return (
    <Modal open={open} onClose={()=>{disconnect();onClose();}} title="F.R.I.D.A.Y. AI" wide tc={tc}>

      {/* ── Eco mode blocker ── */}
      {isEco && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="text-3xl">🌿</div>
          <div className="text-[14px] font-bold" style={{color:tc?tc.textPrimary:'#333'}}>
            {language==='tr'?'Eco Modda Kapalı':language==='es'?'Desactivado en Eco':'Disabled in Eco Mode'}
          </div>
          <div className="text-[11px]" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.4)'}}>
            {language==='tr'
              ?'F.R.I.D.A.Y. sesli komut Eco modda çalışmaz. Performansı Normal veya Turbo\'ya geçir.'
              :language==='es'
              ?'F.R.I.D.A.Y. no funciona en modo Eco. Cambia a Normal o Turbo.'
              :'F.R.I.D.A.Y. voice is disabled in Eco mode. Switch to Normal or Turbo.'}
          </div>
        </div>
      )}

      {/* ── Main UI (hidden in eco) ── */}
      {!isEco && <>

        {/* API key */}
        {(!apiKey||showKey)&&(
          <div className="mb-3 p-3 rounded-xl border"
            style={tc?{background:'rgba(255,255,255,0.06)',borderColor:'rgba(255,255,255,0.12)'}:{background:'rgba(0,0,0,0.04)',borderColor:'rgba(0,0,0,0.08)'}}>
            <div className="text-[10px] font-bold mb-1.5" style={{color:accent}}>OpenAI API Anahtarı</div>
            <div className="flex gap-2">
              <input type="password" placeholder="sk-..." value={apiKey} onChange={e=>setApiKey(e.target.value)} className={inputCls}/>
              <button onClick={()=>setShowKey(false)} style={{background:accent,color:'#000'}} className="px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap">Kaydet</button>
            </div>
            <div className="text-[9px] mt-1.5" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.35)'}}>
              Realtime API · gpt-4o-realtime-preview · Voice: {LANG_VOICE[language]}
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-3 p-1 rounded-xl" style={tc?{background:'rgba(255,255,255,0.06)'}:{background:'rgba(0,0,0,0.04)'}}>
          {(['voice','memory','meet','integrations'] as const).map(t2=>(
            <button key={t2} onClick={()=>setTab(t2)} style={tabSt(tab===t2)}
              className={cn('flex-1 py-1.5 rounded-lg text-[9px] font-bold transition-all',
                !tc&&(tab===t2?'bg-[#1a1a1a] text-white dark:bg-[#e8e8ea] dark:text-[#1a1a1a]':'text-black/40 dark:text-white/40'))}>
              {t2==='voice'?'🎙 Ses':t2==='memory'?'🧠 Hafıza':t2==='meet'?'📝 Meet':'🔗 Entegrasyonlar'}
            </button>
          ))}
          <button onClick={()=>setShowKey(v=>!v)} style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:{}}
            className={cn('px-2 py-1.5 rounded-lg text-[10px] font-bold',!tc&&'text-black/30 dark:text-white/30')}>⚙</button>
        </div>

        {/* ── VOICE TAB ── */}
        {tab==='voice'&&(
          <div className="flex flex-col items-center gap-3">
            <div className="relative select-none">
              <RingVisualizer state={connState} volume={volume} tc={tc}/>
              <button onClick={sessionActive?disconnect:connect} className="absolute inset-0 flex items-center justify-center">
                <div className="w-[72px] h-[72px] rounded-full flex items-center justify-center transition-all duration-300"
                  style={{
                    background: sessionActive?accent:'rgba(255,255,255,0.09)',
                    boxShadow: sessionActive?`0 0 32px ${accent}60,0 0 64px ${accent}20`:'none',
                    border:`2.5px solid ${sessionActive?accent:'rgba(255,255,255,0.18)'}`,
                  }}>
                  <span className="text-[26px]" style={{filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'}}>
                    {sessionActive?'⏹':'🎙'}
                  </span>
                </div>
              </button>
            </div>

            <div className="text-[12px] font-semibold tracking-wide" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.4)'}}>
              {STATE_LABEL[connState]}
            </div>

            {/* Language indicator */}
            <div className="text-[9px] px-2 py-0.5 rounded-full" style={{background:accent+'25',color:accent}}>
              {language.toUpperCase()} · {LANG_VOICE[language]} voice · {LANG_WHISPER[language]} whisper
            </div>

            {liveText&&(
              <div className="w-full px-3 py-2 rounded-xl text-[11px] italic text-center"
                style={tc?{background:'rgba(255,255,255,0.06)',color:tc.textMuted}:{background:'rgba(0,0,0,0.04)',color:'#666'}}>
                {liveText}
              </div>
            )}

            {/* Quick commands */}
            <div className="w-full">
              <div className="text-[9px] font-bold mb-1.5 tracking-[0.1em]" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.3)'}}>
                {language==='tr'?'HIZLI KOMUTLAR':language==='es'?'COMANDOS RÁPIDOS':'QUICK COMMANDS'}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {quickCmds.map(({label,cmd})=>(
                  <button key={cmd}
                    onClick={async()=>{
                      const result = await detectAndExecute(cmd, language);
                      const reply = result || cmd;
                      setMsgs(prev=>[...prev,{role:'user',text:cmd,ts:Date.now()},{role:'assistant',text:reply,ts:Date.now()+1}]);
                      if(sessionActive&&dcRef.current?.readyState==='open'){
                        dcRef.current.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role:'user',content:[{type:'input_text',text:cmd}]}}));
                        dcRef.current.send(JSON.stringify({type:'response.create'}));
                      }
                    }}
                    style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted,borderColor:'rgba(255,255,255,0.10)'}:{}}
                    className={cn('py-1.5 rounded-lg text-[9px] font-bold border transition-all',
                      !tc&&'bg-black/[0.03] border-black/[0.06] text-black/40 hover:bg-black/[0.06] dark:bg-white/[0.04] dark:border-white/[0.06] dark:text-white/40')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* History */}
            {msgs.length>0&&(
              <div className="w-full flex flex-col gap-1.5 max-h-[160px] overflow-y-auto">
                {msgs.slice(-6).map((m,i)=>(
                  <div key={i}
                    className={cn('px-3 py-2 rounded-xl text-[10px] leading-relaxed',m.role==='user'?'text-right ml-8':'text-left mr-8')}
                    style={m.role==='user'
                      ?{background:accent+'22',color:tc?.textPrimary||'#222'}
                      :{background:'rgba(255,255,255,0.06)',color:tc?.textMuted||'#555',borderLeft:`2px solid ${accent}`}}>
                    {m.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── MEMORY TAB ── */}
        {tab==='memory'&&(
          <div className="flex flex-col gap-3">
            <div className="text-[11px]" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.4)'}}>
              F.R.I.D.A.Y. konuşmalardan öğrendiği bilgileri burada saklar. <span style={{color:accent}}>{mem.length} kayıt</span>
            </div>
            {mem.length===0
              ?<div className="text-center py-10 text-[12px]" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.25)'}}>
                Henüz bellek yok. Sesli sohbet et, F.R.I.D.A.Y. öğrenecek.
              </div>
              :<div className="flex flex-col gap-1.5 max-h-[280px] overflow-y-auto">
                {mem.map(e=>(
                  <div key={e.id} className="px-3 py-2 rounded-xl border text-[11px]"
                    style={tc?{background:tc.cardBg,borderColor:tc.cardBorder,color:tc.textPrimary}:{background:'rgba(0,0,0,0.03)',borderColor:'rgba(0,0,0,0.06)',color:'#333'}}>
                    <div className="flex justify-between items-start gap-2">
                      <span className="flex-1 leading-relaxed">{e.text}</span>
                      <span className="text-[8px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{background:accent+'30',color:accent}}>{e.category}</span>
                    </div>
                    <div className="text-[9px] mt-1" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.3)'}}>{new Date(e.ts).toLocaleString('tr-TR')}</div>
                  </div>
                ))}
              </div>
            }
            <div className="flex gap-2">
              <button onClick={()=>{ const t=window.prompt('Bellek ekle:'); if(t?.trim()) addMemory(t.trim(),'fact'); }}
                style={{background:accent,color:'#000'}} className="flex-1 py-2 rounded-xl text-[11px] font-bold">+ Ekle</button>
              <button onClick={()=>{ if(window.confirm('Tüm belleği sil?')) clearMemory(); }}
                className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-red-500/10 text-red-400">🗑 Temizle</button>
            </div>
          </div>
        )}

        {/* ── MEET TAB ── */}
        {tab==='meet'&&(
          <div className="flex flex-col gap-3">
            <div>
              <div className="text-[9px] font-bold mb-1" style={{color:accent}}>MEET BAĞLANTISI</div>
              <div className="flex gap-2">
                <input value={meetUrl} onChange={e=>setMeetUrl(e.target.value)}
                  placeholder="https://meet.google.com/xxx-xxxx-xxx" className={inputCls}/>
                <button disabled={!meetUrl} onClick={async()=>{
                  const ok = await tauriOpen(meetUrl);
                  if(!ok) window.open(meetUrl,'_blank');
                  const note=`# Toplantı Notları\n\nURL: ${meetUrl}\nTarih: ${new Date().toLocaleString('tr-TR')}\nKatılımcılar: \n\n## Gündem\n\n## Notlar\n\n## Eylem Maddeleri\n- [ ] \n`;
                  setMeetNote(note);
                  localStorage.setItem('friday_meet_'+Date.now(),JSON.stringify({url:meetUrl,note,ts:Date.now()}));
                }} style={{background:accent,color:'#000'}}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap disabled:opacity-40">▶ Katıl</button>
              </div>
            </div>
            {meetNote&&<>
              <div className="text-[9px] font-bold" style={{color:accent}}>TOPLANTI NOTLARI (Obsidian Markdown)</div>
              <textarea value={meetNote} onChange={e=>setMeetNote(e.target.value)} rows={6}
                className={cn(inputCls,'font-mono resize-none')} style={{lineHeight:1.5}}/>
              <div className="flex gap-1.5">
                <button onClick={()=>navigator.clipboard.writeText(meetNote)}
                  style={tc?{background:'rgba(255,255,255,0.08)',color:tc.textMuted}:{}}
                  className={cn('flex-1 py-1.5 rounded-lg text-[9px] font-semibold',!tc&&'bg-black/[0.04] text-black/40')}>📋 Kopyala</button>
                <button onClick={()=>{
                  const blob=new Blob([meetNote],{type:'text/markdown'});
                  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
                  a.download=`toplanti-${new Date().toISOString().split('T')[0]}.md`; a.click();
                }} style={{background:accent,color:'#000'}} className="flex-1 py-1.5 rounded-lg text-[9px] font-bold">💾 .md İndir</button>
                <button onClick={async()=>{
                  if(!apiKey||!meetNote) return;
                  setConnState('thinking');
                  try {
                    const res=await fetch('https://api.openai.com/v1/chat/completions',{
                      method:'POST',
                      headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
                      body:JSON.stringify({model:'gpt-4o-mini',max_tokens:400,
                        messages:[
                          {role:'system',content:'Toplantı notlarını özetle ve eylem maddelerini çıkar. Türkçe yanıtla. Markdown kullan.'},
                          {role:'user',content:meetNote}
                        ]})
                    });
                    const d=await res.json();
                    const summary=d.choices?.[0]?.message?.content||'';
                    setMeetNote(prev=>prev+'\n\n## AI Özet\n'+summary);
                    addMemory('Toplantı: '+meetUrl+' — '+summary.slice(0,100),'general');
                  } finally { setConnState('idle'); }
                }} style={tc?{background:'rgba(255,255,255,0.08)',color:tc.textMuted}:{}}
                  className={cn('flex-1 py-1.5 rounded-lg text-[9px] font-semibold',!tc&&'bg-black/[0.04] text-black/40')}>🤖 Özet</button>
              </div>
            </>}
          </div>
        )}

        {/* ── INTEGRATIONS TAB ── */}
        {tab==='integrations'&&(
          <div className="flex flex-col gap-3">
            <div className="text-[11px]" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.4)'}}>
              F.R.I.D.A.Y. aşağıdaki servislere bağlanabilir. Sesli komutla da çağırabilirsin.
            </div>

            {/* Google Drive search */}
            <div className="p-3 rounded-xl border" style={tc?{background:tc.cardBg,borderColor:tc.cardBorder}:{background:'rgba(0,0,0,0.02)',borderColor:'rgba(0,0,0,0.06)'}}>
              <div className="text-[10px] font-bold mb-2" style={{color:accent}}>📁 Google Drive</div>
              <div className="flex gap-2">
                <input value={driveQuery} onChange={e=>setDriveQuery(e.target.value)}
                  placeholder="Dosya ara..." className={cn(inputCls,'flex-1')}/>
                <button onClick={()=>{
                  const url=driveQuery
                    ?`https://drive.google.com/drive/search?q=${encodeURIComponent(driveQuery)}`
                    :'https://drive.google.com';
                  tauriOpen(url).then(ok=>{ if(!ok) window.open(url,'_blank'); });
                }} style={{background:accent,color:'#000'}} className="px-3 py-1.5 rounded-lg text-[10px] font-bold">Ara</button>
              </div>
              <div className="text-[8px] mt-1.5" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.3)'}}>
                Sesli: "Drive'da [dosya adı] ara" veya "Google Drive aç"
              </div>
            </div>

            {/* Google Calendar */}
            <div className="p-3 rounded-xl border" style={tc?{background:tc.cardBg,borderColor:tc.cardBorder}:{background:'rgba(0,0,0,0.02)',borderColor:'rgba(0,0,0,0.06)'}}>
              <div className="text-[10px] font-bold mb-2" style={{color:accent}}>📅 Google Calendar</div>
              <div className="flex gap-2">
                <button onClick={()=>{ tauriOpen('https://calendar.google.com').then(ok=>{ if(!ok) window.open('https://calendar.google.com','_blank'); }); }}
                  style={{background:accent,color:'#000'}} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold">Takvimi Aç</button>
                <button onClick={()=>{ window.open('https://calendar.google.com/calendar/r/eventedit','_blank'); }}
                  style={tc?{background:'rgba(255,255,255,0.08)',color:tc.textMuted}:{}}
                  className={cn('flex-1 py-1.5 rounded-lg text-[10px] font-semibold',!tc&&'bg-black/[0.04] text-black/40')}>+ Etkinlik Ekle</button>
              </div>
              <div className="text-[8px] mt-1.5" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.3)'}}>
                Sesli: "Takvimi aç" veya "Etkinlik ekle"
              </div>
            </div>

            {/* Obsidian */}
            <div className="p-3 rounded-xl border" style={tc?{background:tc.cardBg,borderColor:tc.cardBorder}:{background:'rgba(0,0,0,0.02)',borderColor:'rgba(0,0,0,0.06)'}}>
              <div className="text-[10px] font-bold mb-2" style={{color:accent}}>🗒 Obsidian</div>
              <div className="flex gap-2">
                <button onClick={()=>{ tauriOpen('obsidian://').then(ok=>{ if(!ok) window.open('obsidian://','_blank'); }); }}
                  style={{background:accent,color:'#000'}} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold">Aç</button>
                <button onClick={()=>{
                  const title=window.prompt('Not başlığı:');
                  if(title) tauriOpen(`obsidian://new?name=${encodeURIComponent(title)}`).then(ok=>{ if(!ok) window.open(`obsidian://new?name=${encodeURIComponent(title)}`,'_blank'); });
                }} style={tc?{background:'rgba(255,255,255,0.08)',color:tc.textMuted}:{}}
                  className={cn('flex-1 py-1.5 rounded-lg text-[10px] font-semibold',!tc&&'bg-black/[0.04] text-black/40')}>+ Yeni Not</button>
              </div>
              <div className="text-[8px] mt-1.5" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.3)'}}>
                ⚠ Obsidian'ın yüklü olması ve obsidian:// protokolünün aktif olması gerekir.
              </div>
            </div>

            {/* System control */}
            <div className="p-3 rounded-xl border" style={tc?{background:tc.cardBg,borderColor:tc.cardBorder}:{background:'rgba(0,0,0,0.02)',borderColor:'rgba(0,0,0,0.06)'}}>
              <div className="text-[10px] font-bold mb-2" style={{color:accent}}>⚙ Sistem Kontrolü</div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  {label:'💤 Uyku',  cmd:'shutdown /h',     confirm:false},
                  {label:'🔄 Yeniden Başlat',cmd:'shutdown /r /t 10',confirm:true},
                  {label:'⭕ Kapat', cmd:'shutdown /s /t 10',confirm:true},
                ].map(({label,cmd,confirm:needConfirm})=>(
                  <button key={label} onClick={async()=>{
                    if(needConfirm&&!window.confirm(label+' — emin misin?')) return;
                    const r=await tauriShell(cmd);
                    setMsgs(prev=>[...prev,{role:'assistant',text:label+': '+r,ts:Date.now()}]);
                  }} style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted,borderColor:'rgba(255,255,255,0.10)'}:{}}
                    className={cn('py-1.5 rounded-lg text-[9px] font-bold border',!tc&&'bg-black/[0.03] border-black/[0.06] text-black/40')}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="text-[8px] mt-1.5" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.3)'}}>
                Sesli: "Bilgisayarı kapat / yeniden başlat / uyku modu"<br/>
                ⚠ Tauri run_command komutu Rust backend'e eklenmelidir.
              </div>
            </div>
          </div>
        )}

      </>}

      <button onClick={()=>{disconnect();onClose();}}
        style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:{}}
        className={cn('mt-3 w-full py-2 rounded-xl text-[12px] font-semibold transition-colors',
          !tc&&'bg-black/[0.04] dark:bg-white/[0.06] text-black/40 dark:text-white/40')}>
        {language==='tr'?'Kapat':language==='es'?'Cerrar':'Close'}
      </button>
    </Modal>
  );
}
