import { Card } from '@/components/ui/Card';
import { colorForPct } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  label:    string;
  value:    string;
  sub?:     string;
  color:    string;
  history:  number[];
  onClick?: () => void;
  children?: React.ReactNode;
}

export function MetricCard({ label, value, sub, color, history, onClick, children }: MetricCardProps) {
  const pct = parseFloat(value);
  const danger = colorForPct(pct);

  return (
    <Card
      clickable={!!onClick}
      hover
      onClick={onClick}
      className="relative flex flex-col gap-1.5"
    >
      {/* Label */}
      <div className="text-[9px] font-bold tracking-[0.12em] uppercase" style={{ color }}>
        {label}
      </div>

      {/* Big number */}
      <div
        className="text-[38px] font-extrabold leading-none tracking-tight text-[#1a1a1a] dark:text-[#e8e8ea]"
        style={{ color: danger || undefined }}
      >
        {value}
      </div>

      {sub && <div className="text-[10px] text-black/30 dark:text-white/30">{sub}</div>}

      {/* Tap hint */}
      {onClick && (
        <div className="absolute top-3 right-3 text-[10px] font-bold text-black/20 dark:text-white/20">
          ↗
        </div>
      )}

      {/* Sparkline */}
      <div className="flex items-end gap-[2px] h-6 mt-1">
        {history.slice(-20).map((v, i) => {
          const max = Math.max(...history.slice(-20), 1);
          const h = Math.max(2, (v / max) * 24);
          const opacity = 0.3 + (v / max) * 0.7;
          return (
            <div
              key={i}
              className="flex-1 rounded-[2px_2px_0_0] transition-all duration-300"
              style={{ height: h, background: danger || color, opacity }}
            />
          );
        })}
      </div>

      {children}
    </Card>
  );
}
