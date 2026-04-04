import { colorForPct, cn } from '@/lib/utils';

interface ArtistTC {
  cardBg: string; cardBorder: string; textPrimary: string; textMuted: string; sparkline: string; accent: string;
}
interface MetricCardProps {
  label:     string;
  value:     string;
  sub?:      string;
  color:     string;
  history:   number[];
  onClick?:  () => void;
  children?: React.ReactNode;
  tc?:       ArtistTC | null;
}

export function MetricCard({ label, value, sub, color, history, onClick, children, tc }: MetricCardProps) {
  const pct      = parseFloat(value);
  const danger   = colorForPct(pct);
  const labelClr = tc ? tc.accent : color;
  const barClr   = tc ? tc.sparkline : (danger || color);
  const bigClr   = tc ? tc.textPrimary : (danger || undefined);

  const cardStyle: React.CSSProperties = tc
    ? { background: tc.cardBg, borderColor: tc.cardBorder, backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)' }
    : {};

  return (
    <div onClick={onClick} style={cardStyle}
      className={cn('rounded-2xl border p-3.5 transition-all duration-150 relative flex flex-col gap-1.5',
        !tc && 'bg-white dark:bg-[#1c1c1e] border-black/[0.06] dark:border-white/[0.07]',
        onClick && 'cursor-pointer',
        onClick && !tc && 'hover:bg-black/[0.02] dark:hover:bg-white/[0.03]',
        onClick && tc && 'hover:opacity-90',
      )}>
      <div className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color: labelClr, textShadow: tc ? '0 1px 4px rgba(0,0,0,0.8)' : undefined }}>{label}</div>
      <div className="text-[38px] font-extrabold leading-none tracking-tight"
        style={{ color: bigClr || (tc ? tc.textPrimary : undefined),
                 textShadow: tc ? '0 1px 8px rgba(0,0,0,0.9), 0 0 20px rgba(0,0,0,0.7)' : undefined }}>
        <span className={!tc ? 'text-[#1a1a1a] dark:text-[#e8e8ea]' : ''}>{value}</span>
      </div>
      {sub && <div className="text-[10px]" style={{ color: tc ? tc.textMuted : undefined }}><span className={!tc ? 'text-black/30 dark:text-white/30' : ''}>{sub}</span></div>}
      {onClick && <div className="absolute top-3 right-3 text-[10px] font-bold" style={{ color: tc ? 'rgba(255,255,255,0.2)' : undefined }}><span className={!tc ? 'text-black/20 dark:text-white/20' : ''}>↗</span></div>}
      <div className="flex items-end gap-[2px] h-6 mt-1">
        {history.slice(-20).map((v, i) => {
          const max = Math.max(...history.slice(-20), 1);
          const h = Math.max(2, (v / max) * 24);
          const opacity = 0.3 + (v / max) * 0.7;
          return <div key={i} className="flex-1 rounded-[2px_2px_0_0] transition-all duration-300" style={{ height: h, background: barClr, opacity }} />;
        })}
      </div>
      {children}
    </div>
  );
}
