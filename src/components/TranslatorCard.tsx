import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ThemeConfig {
  accent: string;
  cardBg: string;
  cardBorder: string;
  textPrimary: string;
  textMuted: string;
}

interface TranslatorCardProps {
  tc: ThemeConfig | null;
  apiKey: string;
}

const LANGUAGES = [
  { code: 'tr', label: 'TR', full: 'Türkçe' },
  { code: 'en', label: 'EN', full: 'İngilizce' },
  { code: 'es', label: 'ES', full: 'İspanyolca' },
  { code: 'de', label: 'DE', full: 'Almanca' },
  { code: 'fr', label: 'FR', full: 'Fransızca' },
  { code: 'ja', label: 'JA', full: 'Japonca' },
  { code: 'ar', label: 'AR', full: 'Arapça' },
  { code: 'ru', label: 'RU', full: 'Rusça' },
];

export function TranslatorCard({ tc, apiKey }: TranslatorCardProps) {
  const [input, setInput]           = useState('');
  const [output, setOutput]         = useState('');
  const [fromLang, setFromLang]     = useState('tr');
  const [toLang, setToLang]         = useState('en');
  const [loading, setLoading]       = useState(false);
  const [showAllLangs, setShowAllLangs] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localKey = localStorage.getItem('jarvis_openai_key') || apiKey;

  const translate = useCallback(async (text: string) => {
    if (!text.trim() || !localKey) {
      if (!localKey) setOutput('⚠ API anahtarı girilmedi');
      return;
    }
    setLoading(true);
    try {
      const fromFull = LANGUAGES.find(l => l.code === fromLang)?.full || fromLang;
      const toFull   = LANGUAGES.find(l => l.code === toLang)?.full || toLang;
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 300,
          messages: [
            {
              role: 'system',
              content: `Sen profesyonel bir çevirmensin. "${fromFull}"den "${toFull}"e çeviri yap. Sadece çeviriyi döndür, açıklama ekleme. Ton ve üslubu koru.`
            },
            { role: 'user', content: text }
          ],
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setOutput(data.choices?.[0]?.message?.content || '');
    } catch (e) {
      setOutput(`Hata: ${e instanceof Error ? e.message : 'Bilinmeyen'}`);
    }
    setLoading(false);
  }, [fromLang, toLang, localKey]);

  const handleInput = (val: string) => {
    setInput(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length > 2) {
      debounceRef.current = setTimeout(() => translate(val), 900);
    } else {
      setOutput('');
    }
  };

  const swap = () => {
    setFromLang(toLang);
    setToLang(fromLang);
    setInput(output);
    setOutput(input);
  };

  const cardStyle: React.CSSProperties = tc
    ? { background: tc.cardBg, borderColor: tc.cardBorder, backdropFilter: 'blur(2px)' }
    : {};

  const accent = tc?.accent || '#3b82f6';
  const muted  = tc?.textMuted || 'rgba(0,0,0,0.35)';

  const quickLangs = LANGUAGES.slice(0, 4);

  return (
    <div style={cardStyle}
      className={cn('rounded-2xl border p-3.5 flex flex-col gap-2',
        !tc && 'bg-white dark:bg-[#1c1c1e] border-black/[0.06] dark:border-white/[0.07]')}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-[9px] font-bold tracking-[0.14em]"
          style={{ color: tc ? accent : undefined, textShadow: tc ? '0 1px 5px rgba(0,0,0,0.9)' : undefined }}>
          <span className={!tc ? 'text-black/30 dark:text-white/30' : ''}>AI ÇEVİRİ</span>
        </div>
        {loading && (
          <div className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: accent, borderTopColor: 'transparent' }} />
        )}
      </div>

      {/* Lang selector row */}
      <div className="flex items-center gap-1">
        {/* From */}
        <div className="flex gap-0.5 flex-1 flex-wrap">
          {(showAllLangs ? LANGUAGES : quickLangs).filter(l => l.code !== toLang).map(l => (
            <button key={l.code} onClick={() => setFromLang(l.code)}
              style={fromLang === l.code ? { background: accent, color: '#000' } : tc ? { background: 'rgba(255,255,255,0.07)', color: muted } : {}}
              className={cn('px-2 py-0.5 rounded-md text-[8px] font-bold transition-all',
                !tc && (fromLang === l.code ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]' : 'bg-black/[0.04] dark:bg-white/[0.06] text-black/30 dark:text-white/30'))}>
              {l.label}
            </button>
          ))}
        </div>

        {/* Swap */}
        <button onClick={swap}
          style={tc ? { color: muted } : {}}
          className={cn('px-1.5 py-1 rounded-lg text-[12px] transition-all hover:opacity-70 flex-shrink-0',
            !tc && 'text-black/25 dark:text-white/25 hover:text-black/50')}>
          ⇄
        </button>

        {/* To */}
        <div className="flex gap-0.5 flex-1 flex-wrap justify-end">
          {(showAllLangs ? LANGUAGES : quickLangs).filter(l => l.code !== fromLang).map(l => (
            <button key={l.code} onClick={() => setToLang(l.code)}
              style={toLang === l.code ? { background: accent, color: '#000' } : tc ? { background: 'rgba(255,255,255,0.07)', color: muted } : {}}
              className={cn('px-2 py-0.5 rounded-md text-[8px] font-bold transition-all',
                !tc && (toLang === l.code ? 'bg-[#1a1a1a] dark:bg-[#e8e8ea] text-white dark:text-[#1a1a1a]' : 'bg-black/[0.04] dark:bg-white/[0.06] text-black/30 dark:text-white/30'))}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* More langs */}
      <button onClick={() => setShowAllLangs(v => !v)}
        style={tc ? { color: muted } : {}}
        className={cn('text-[8px] font-semibold self-center', !tc && 'text-black/20 dark:text-white/20 hover:text-black/40')}>
        {showAllLangs ? '▲ Az dil göster' : '▼ Daha fazla dil'}
      </button>

      {/* Input */}
      <textarea
        value={input}
        onChange={e => handleInput(e.target.value)}
        placeholder="Çevrilecek metin..."
        rows={2}
        className={cn('w-full px-2.5 py-2 rounded-xl border text-[11px] resize-none focus:outline-none transition-colors',
          tc ? 'bg-white/5 border-white/10 text-white placeholder-white/30 focus:border-white/30'
             : 'bg-black/[0.02] dark:bg-white/[0.04] border-black/[0.08] dark:border-white/[0.1] text-[#1a1a1a] dark:text-[#e8e8ea] focus:border-blue-300')}
      />

      {/* Output */}
      {(output || loading) && (
        <div
          onClick={() => output && navigator.clipboard.writeText(output)}
          className="px-2.5 py-2 rounded-xl border text-[11px] min-h-[40px] cursor-pointer transition-all hover:opacity-80 select-all"
          style={tc
            ? { background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.10)', color: tc.textPrimary, borderLeft: `3px solid ${accent}` }
            : { background: 'rgba(0,0,0,0.02)', borderColor: 'rgba(0,0,0,0.06)', color: '#222', borderLeft: '3px solid #3b82f6' }}
          title="Kopyalamak için tıkla">
          {loading ? <span style={{ color: muted }}>Çeviriliyor...</span> : output}
        </div>
      )}

      <div className="text-[8px] text-center" style={{ color: muted }}>
        {localKey ? '✓ OpenAI · Otomatik çeviri' : '⚠ JARVIS AI\'ya API anahtarı gir'}
      </div>
    </div>
  );
}
