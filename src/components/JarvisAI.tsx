import { useState, useEffect, useRef, useCallback } from 'react';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

// ── Inline ThemeConfig ─────────────────────────────────────────────────────
interface ThemeConfig {
  bg: string; accent: string; accentSoft: string;
  cardBg: string; cardBorder: string;
  textPrimary: string; textMuted: string;
  sparkline: string; nowPlayingColor: string;
  banner: string; bannerBg: string; bannerBorder: string; bannerText: string;
  photo: string; photo2?: string;
}

interface JarvisAIProps {
  open: boolean;
  onClose: () => void;
  tc: ThemeConfig | null;
}

// ── App Launch Registry ────────────────────────────────────────────────────
const APP_MAP: Record<string, string> = {
  discord:  'discord://',
  spotify:  'spotify://',
  obsidian: 'obsidian://',
  notion:   'notion://',
  steam:    'steam://',
  vscode:   'vscode://',
  chrome:   'https://google.com',
  youtube:  'https://youtube.com',
  gmail:    'https://mail.google.com',
  github:   'https://github.com',
  twitch:   'https://twitch.tv',
  netflix:  'https://netflix.com',
  reddit:   'https://reddit.com',
  twitter:  'https://twitter.com',
  x:        'https://twitter.com',
  linkedin: 'https://linkedin.com',
  figma:    'https://figma.com',
};

function launchApp(name: string): string {
  const key = name.toLowerCase().trim();
  const url = APP_MAP[key];
  if (!url) {
    window.open(`https://www.google.com/search?q=${encodeURIComponent(name)}`, '_blank');
    return `${name} için arama yapıyorum.`;
  }
  window.open(url, '_blank');
  return `${name} açılıyor.`;
}

// ── Protocol Commands ──────────────────────────────────────────────────────
const PROTOCOL_MAP: Record<string, { apps: string[]; reply: string }> = {
  'başlangıç protokolü': { apps: ['discord://', 'spotify://'],                          reply: 'Başlangıç protokolü aktif. Discord ve Spotify başlatılıyor, efendim.' },
  'başlangıç':           { apps: ['discord://', 'spotify://'],                          reply: 'Sistemler başlatılıyor.' },
  'iş protokolü':        { apps: ['https://mail.google.com','https://notion.so','https://github.com'], reply: 'İş protokolü aktif. Gmail, Notion ve GitHub hazırlanıyor.' },
  'gece protokolü':      { apps: ['spotify://'],                                        reply: 'Gece modu aktif. Spotify açılıyor, iyi geceler.' },
  'oyun protokolü':      { apps: ['discord://', 'steam://'],                            reply: 'Oyun modu. Discord ve Steam başlatılıyor.' },
};

function handleProtocol(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [phrase, cfg] of Object.entries(PROTOCOL_MAP)) {
    if (lower.includes(phrase)) {
      cfg.apps.forEach((url, i) => setTimeout(() => window.open(url, '_blank'), i * 700));
      return cfg.reply;
    }
  }
  return null;
}

function detectAppLaunch(text: string): string | null {
  const lower = text.toLowerCase();
  const patterns = [
    /(?:aç|başlat|başlatır mısın|açar mısın|open|launch|start)\s+([\w]+)/i,
    /([\w]+)\s+(?:aç|başlat|open)/i,
  ];
  for (const pat of patterns) {
    const m = pat.exec(lower);
    if (m) {
      const app = (m[1] || '').trim();
      if (app.length > 1) return launchApp(app);
    }
  }
  for (const key of Object.keys(APP_MAP)) {
    if (lower.includes(key)) return launchApp(key);
  }
  return null;
}

// ── Semantic Memory ────────────────────────────────────────────────────────
interface MemEntry { id: string; text: string; ts: number; category: 'fact'|'preference'|'command'|'general'; }

function useMemory() {
  const [mem, setMem] = useState<MemEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('jarvis_memory') || '[]'); } catch { return []; }
  });
  const save = (m: MemEntry[]) => { setMem(m); localStorage.setItem('jarvis_memory', JSON.stringify(m)); };
  const add = useCallback((text: string, cat: MemEntry['category'] = 'general') => {
    setMem(prev => {
      const updated = [{ id: Date.now().toString(), text, ts: Date.now(), category: cat }, ...prev].slice(0, 300);
      localStorage.setItem('jarvis_memory', JSON.stringify(updated));
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
  const clear = () => save([]);
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
    const W = c.width, H = c.height, cx = W/2, cy = H/2;
    const R = 82, BARS = 72;
    const accent = tc?.accent || '#60a5fa';

    const isActive    = state === 'listening' || state === 'speaking';
    const isThinking  = state === 'thinking';
    const isConnecting= state === 'connecting';

    const draw = () => {
      ctx.clearRect(0,0,W,H);

      if (isThinking) {
        ctx.save(); ctx.translate(cx,cy); ctx.rotate(phase.current*2);
        for (let i=0;i<8;i++){
          const a=(i/8)*Math.PI*2;
          ctx.beginPath(); ctx.arc(Math.cos(a)*R,Math.sin(a)*R,4,0,Math.PI*2);
          ctx.fillStyle=accent+Math.round((0.15+i/8*0.6)*255).toString(16).padStart(2,'0'); ctx.fill();
        }
        ctx.restore(); phase.current+=0.03;
        raf.current=requestAnimationFrame(draw); return;
      }

      if (isConnecting) {
        for (let i=0;i<12;i++){
          const a=(i/12)*Math.PI*2+phase.current;
          const p=0.2+0.7*((Math.sin(phase.current*4+i)+1)/2);
          ctx.beginPath(); ctx.arc(cx+Math.cos(a)*R,cy+Math.sin(a)*R,3,0,Math.PI*2);
          ctx.fillStyle=accent+Math.round(p*200).toString(16).padStart(2,'0'); ctx.fill();
        }
        phase.current+=0.025; raf.current=requestAnimationFrame(draw); return;
      }

      if (isActive) {
        const g=ctx.createRadialGradient(cx,cy,R-10,cx,cy,R+40+volume*45);
        g.addColorStop(0,accent+Math.round((0.06+volume*0.18)*255).toString(16).padStart(2,'0'));
        g.addColorStop(1,'transparent');
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R+50,0,Math.PI*2); ctx.fill();
      }

      for (let i=0;i<BARS;i++){
        const angle=(i/BARS)*Math.PI*2-Math.PI/2;
        let barH: number;
        if (isActive){
          const f1=Math.sin(phase.current*4+i*0.35)*volume*30;
          const f2=Math.sin(phase.current*7+i*0.7)*volume*15;
          const f3=Math.sin(phase.current*11+i*1.1)*volume*8;
          barH=Math.max(3,6+f1+f2+f3);
        } else {
          barH=3+Math.sin(phase.current*0.8+i*0.25)*1.5;
        }
        const alpha=isActive?0.4+(barH/50)*0.6:0.18;
        ctx.strokeStyle=accent+Math.round(alpha*255).toString(16).padStart(2,'0');
        ctx.lineWidth=2.5; ctx.lineCap='round';
        ctx.beginPath();
        ctx.moveTo(cx+Math.cos(angle)*R,   cy+Math.sin(angle)*R);
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

// ── Conversation ──────────────────────────────────────────────────────────
interface Msg { role:'user'|'assistant'; text:string; ts:number; }

// ── Main Component ────────────────────────────────────────────────────────
export function JarvisAI({ open, onClose, tc }: JarvisAIProps) {
  const [apiKey, setApiKey]         = useState(()=>localStorage.getItem('jarvis_openai_key')||'');
  const [showKey, setShowKey]       = useState(false);
  const [tab, setTab]               = useState<'voice'|'memory'|'meet'>('voice');
  const [connState, setConnState]   = useState<VizState>('idle');
  const [volume, setVolume]         = useState(0);
  const [msgs, setMsgs]             = useState<Msg[]>([]);
  const [liveText, setLiveText]     = useState('');
  const [sessionActive, setSessionActive] = useState(false);
  const [meetUrl, setMeetUrl]       = useState('');
  const [meetNote, setMeetNote]     = useState('');

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

  useEffect(()=>{ if(apiKey) localStorage.setItem('jarvis_openai_key',apiKey); },[apiKey]);

  const buildSystemPrompt = useCallback((query='')=>{
    const entries = relevant(query);
    const memCtx = entries.length>0
      ? `\n\nKullanıcı hakkında bildiğim:\n${entries.map(e=>`• ${e.text}`).join('\n')}`
      : '';
    return `Sen JARVIS'sın — zeki, kısa ve kişisel sesli AI asistansın. Türkçe veya İngilizce konuş. Yanıtların kısa (1-3 cümle), doğal ve samimi olsun. Gereksiz selamlama yapma.${memCtx}`;
  },[relevant]);

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
            voice:'alloy',
            input_audio_format:'pcm16',
            output_audio_format:'pcm16',
            input_audio_transcription:{model:'whisper-1'},
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

        const protocolReply = handleProtocol(userText);
        const appReply = !protocolReply ? detectAppLaunch(userText) : null;

        if(protocolReply||appReply){
          const reply=protocolReply||appReply||'';
          setMsgs(prev=>[...prev,{role:'user',text:userText,ts:Date.now()},{role:'assistant',text:reply,ts:Date.now()+1}]);
          dcRef.current?.send(JSON.stringify({type:'conversation.item.create',item:{type:'message',role:'assistant',content:[{type:'text',text:reply}]}}));
          dcRef.current?.send(JSON.stringify({type:'response.create'}));
        } else {
          setMsgs(prev=>[...prev,{role:'user',text:userText,ts:Date.now()}]);
          const lower=userText.toLowerCase();
          if(lower.match(/ben |benim |i am |i'm /)) addMemory(userText,'fact');
          else if(lower.match(/seviyorum|istemiyorum|like |hate /)) addMemory(userText,'preference');
        }
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
  },[buildSystemPrompt,addMemory]);

  const connect = useCallback(async()=>{
    if(!apiKey){setShowKey(true);return;}
    if(sessionActive) return;
    setConnState('connecting');
    try {
      // 1. Ephemeral token
      const tokenRes = await fetch('https://api.openai.com/v1/realtime/sessions',{
        method:'POST',
        headers:{'Authorization':`Bearer ${apiKey}`,'Content-Type':'application/json'},
        body: JSON.stringify({model:'gpt-4o-realtime-preview-2024-12-17',voice:'alloy'}),
      });
      if(!tokenRes.ok){
        const e=await tokenRes.json();
        throw new Error(e.error?.message||`HTTP ${tokenRes.status}`);
      }
      const data=await tokenRes.json();
      const ephKey=data.client_secret?.value;
      if(!ephKey) throw new Error('Ephemeral key alınamadı');

      // 2. WebRTC
      const pc=new RTCPeerConnection();
      pcRef.current=pc;

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
  },[apiKey,sessionActive,startVolMeter,handleEvent]);

  const disconnect = useCallback(()=>{
    dcRef.current?.close(); pcRef.current?.close();
    streamRef.current?.getTracks().forEach(t=>t.stop());
    if(audioRef.current) audioRef.current.srcObject=null;
    stopVolMeter();
    dcRef.current=null; pcRef.current=null; streamRef.current=null; audioRef.current=null;
    setConnState('idle'); setSessionActive(false); setLiveText('');
  },[stopVolMeter]);

  useEffect(()=>{ if(!open) disconnect(); },[open,disconnect]);

  const accent=tc?.accent||'#60a5fa';

  const STATE_LABEL: Record<VizState,string>={
    idle:       'Başlamak için mikrofona bas',
    connecting: 'Bağlanıyor...',
    listening:  '🎙 Seni dinliyorum...',
    speaking:   '🔊 Konuşuyor...',
    thinking:   '🧠 Düşünüyor...',
  };

  const tabSt=(active:boolean):React.CSSProperties=>tc
    ?(active?{background:tc.accent,color:'#000'}:{background:'rgba(255,255,255,0.07)',color:tc.textMuted})
    :{};

  const inputCls=cn('w-full px-2.5 py-1.5 rounded-lg border text-[11px] focus:outline-none',
    tc?'bg-white/5 border-white/10 text-white placeholder-white/30'
      :'bg-white border-black/10 text-gray-800 placeholder-gray-400');

  return (
    <Modal open={open} onClose={()=>{disconnect();onClose();}} title="JARVIS AI" wide tc={tc}>

      {/* API key */}
      {(!apiKey||showKey)&&(
        <div className="mb-3 p-3 rounded-xl border"
          style={tc?{background:'rgba(255,255,255,0.06)',borderColor:'rgba(255,255,255,0.12)'}:{background:'rgba(0,0,0,0.04)',borderColor:'rgba(0,0,0,0.08)'}}>
          <div className="text-[10px] font-bold mb-1.5" style={{color:accent}}>OpenAI API Anahtarı</div>
          <div className="flex gap-2">
            <input type="password" placeholder="sk-..." value={apiKey} onChange={e=>setApiKey(e.target.value)} className={inputCls}/>
            <button onClick={()=>setShowKey(false)} style={{background:accent,color:'#000'}} className="px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap">Kaydet</button>
          </div>
          <div className="text-[9px] mt-1.5" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.35)'}}>Realtime API: gpt-4o-realtime-preview</div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-3 p-1 rounded-xl" style={tc?{background:'rgba(255,255,255,0.06)'}:{background:'rgba(0,0,0,0.04)'}}>
        {(['voice','memory','meet'] as const).map(t2=>(
          <button key={t2} onClick={()=>setTab(t2)} style={tabSt(tab===t2)}
            className={cn('flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all',
              !tc&&(tab===t2?'bg-[#1a1a1a] text-white dark:bg-[#e8e8ea] dark:text-[#1a1a1a]':'text-black/40 dark:text-white/40'))}>
            {t2==='voice'?'🎙 Sesli Sohbet':t2==='memory'?'🧠 Hafıza':'📝 Meet'}
          </button>
        ))}
        <button onClick={()=>setShowKey(v=>!v)} style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:{}}
          className={cn('px-2.5 py-1.5 rounded-lg text-[10px] font-bold',!tc&&'text-black/30 dark:text-white/30')}>⚙</button>
      </div>

      {/* ── VOICE ── */}
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

          {liveText&&(
            <div className="w-full px-3 py-2 rounded-xl text-[11px] italic text-center"
              style={tc?{background:'rgba(255,255,255,0.06)',color:tc.textMuted}:{background:'rgba(0,0,0,0.04)',color:'#666'}}>
              {liveText}
            </div>
          )}

          {/* Quick protocols */}
          <div className="w-full">
            <div className="text-[9px] font-bold mb-1.5 tracking-[0.1em]" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.3)'}}>HIZLI PROTOKOLLER</div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                {label:'🚀 Başlangıç',cmd:'başlangıç protokolü'},
                {label:'💼 İş',       cmd:'iş protokolü'},
                {label:'🎮 Oyun',     cmd:'oyun protokolü'},
                {label:'🎮 Discord',  cmd:'discord aç'},
                {label:'🎵 Spotify',  cmd:'spotify aç'},
                {label:'▶ YouTube',  cmd:'youtube aç'},
              ].map(({label,cmd})=>(
                <button key={cmd}
                  onClick={()=>{
                    const pr=handleProtocol(cmd);
                    const ap=!pr?detectAppLaunch(cmd):null;
                    const reply=pr||ap||cmd;
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
            <div className="w-full flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
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

      {/* ── MEMORY ── */}
      {tab==='memory'&&(
        <div className="flex flex-col gap-3">
          <div className="text-[11px]" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.4)'}}>
            JARVIS konuşmalardan öğrendiği bilgileri burada saklar. <span style={{color:accent}}>{mem.length} kayıt</span>
          </div>
          {mem.length===0
            ?<div className="text-center py-10 text-[12px]" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.25)'}}>Henüz bellek yok. Sesli sohbet et, JARVIS öğrenecek.</div>
            :<div className="flex flex-col gap-1.5 max-h-[300px] overflow-y-auto">
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
          <div className="text-[10px] p-3 rounded-xl" style={tc?{background:'rgba(255,255,255,0.05)',color:tc.textMuted}:{background:'rgba(0,0,0,0.03)',color:'rgba(0,0,0,0.4)'}}>
            💡 "Ben...", "Seviyorum...", "İstemiyorum..." gibi ifadeleri JARVIS otomatik hafızasına alır.
          </div>
        </div>
      )}

      {/* ── MEET ── */}
      {tab==='meet'&&(
        <div className="flex flex-col gap-3">
          <div className="text-[11px]" style={{color:tc?tc.textMuted:'rgba(0,0,0,0.4)'}}>Google Meet'e katıl, notlarını Obsidian formatında kaydet.</div>
          <div>
            <div className="text-[9px] font-bold mb-1" style={{color:accent}}>MEET BAĞLANTISI</div>
            <div className="flex gap-2">
              <input value={meetUrl} onChange={e=>setMeetUrl(e.target.value)}
                placeholder="https://meet.google.com/xxx-xxxx-xxx" className={inputCls}/>
              <button disabled={!meetUrl} onClick={()=>{
                window.open(meetUrl,'_blank');
                const note=`# Toplantı Notları\n\nURL: ${meetUrl}\nTarih: ${new Date().toLocaleString('tr-TR')}\nKatılımcılar: \n\n## Gündem\n\n## Notlar\n\n## Eylem Maddeleri\n- [ ] \n`;
                setMeetNote(note);
                localStorage.setItem('jarvis_meet_'+Date.now(),JSON.stringify({url:meetUrl,note,ts:Date.now()}));
              }} style={{background:accent,color:'#000'}}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap disabled:opacity-40">▶ Katıl</button>
            </div>
          </div>

          {meetNote&&<>
            <div className="text-[9px] font-bold" style={{color:accent}}>TOPLANTI NOTLARI (Obsidian Markdown)</div>
            <textarea value={meetNote} onChange={e=>setMeetNote(e.target.value)} rows={7}
              className={cn(inputCls,'font-mono resize-none')} style={{lineHeight:1.5}}/>
            <div className="flex gap-2">
              <button onClick={()=>navigator.clipboard.writeText(meetNote)}
                style={tc?{background:'rgba(255,255,255,0.08)',color:tc.textMuted}:{}}
                className={cn('flex-1 py-1.5 rounded-lg text-[10px] font-semibold',!tc&&'bg-black/[0.04] text-black/40')}>📋 Kopyala</button>
              <button onClick={()=>{
                const blob=new Blob([meetNote],{type:'text/markdown'});
                const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
                a.download=`toplanti-${new Date().toISOString().split('T')[0]}.md`; a.click();
              }} style={{background:accent,color:'#000'}} className="flex-1 py-1.5 rounded-lg text-[10px] font-bold">💾 .md İndir</button>
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
                } finally { setConnState('idle'); }
              }} style={tc?{background:'rgba(255,255,255,0.08)',color:tc.textMuted}:{}}
                className={cn('flex-1 py-1.5 rounded-lg text-[10px] font-semibold',!tc&&'bg-black/[0.04] text-black/40')}>🤖 AI Özet</button>
            </div>
          </>}

          <div className="text-[10px] p-3 rounded-xl"
            style={tc?{background:'rgba(255,255,255,0.05)',color:tc.textMuted}:{background:'rgba(0,0,0,0.03)',color:'rgba(0,0,0,0.4)'}}>
            💡 <strong>Obsidian:</strong> .md dosyasını vault'una ekle. "AI Özet" ile önemli noktaları JARVIS hafızasına ekleyebilirsin.
          </div>
        </div>
      )}

      <button onClick={()=>{disconnect();onClose();}}
        style={tc?{background:'rgba(255,255,255,0.07)',color:tc.textMuted}:{}}
        className={cn('mt-3 w-full py-2 rounded-xl text-[12px] font-semibold transition-colors',
          !tc&&'bg-black/[0.04] dark:bg-white/[0.06] text-black/40 dark:text-white/40')}>
        Kapat
      </button>
    </Modal>
  );
}
