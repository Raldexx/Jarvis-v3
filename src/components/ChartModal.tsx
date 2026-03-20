import { Modal } from '@/components/ui/Modal';
import { fmtSpeed, fmtTemp } from '@/lib/utils';
import type { SystemStats, SystemInfo, NetworkStats } from '@/store/system';

interface ChartModalProps {
  open:    boolean;
  onClose: () => void;
  chartKey: 'cpu' | 'ram' | 'gpu' | 'net' | 'disk' | null;
  sys:     SystemStats;
  net:     NetworkStats & { dlSpeed: number; ulSpeed: number };
  sysInfo: SystemInfo;
  cpuHist: number[];
  ramHist: number[];
  gpuHist: number[];
  netHist: number[];
}

const CHART_META = {
  cpu:  { title: 'CPU Usage',  color: '#3b82f6' },
  ram:  { title: 'RAM Usage',  color: '#8b5cf6' },
  gpu:  { title: 'GPU Usage',  color: '#f59e0b' },
  net:  { title: 'Network ↓',  color: '#10b981' },
  disk: { title: 'Disk Usage', color: '#6b7280' },
};

export function ChartModal({ open, onClose, chartKey, sys, net, sysInfo, cpuHist, ramHist, gpuHist, netHist }: ChartModalProps) {
  if (!chartKey) return null;

  const meta = CHART_META[chartKey];
  const histMap = { cpu: cpuHist, ram: ramHist, gpu: gpuHist, net: netHist, disk: Array(60).fill(sys.disk_percent) };
  const history = histMap[chartKey];
  const max = Math.max(...history, 1);

  const currentVal = {
    cpu:  `${Math.round(sys.cpu_percent)}%`,
    ram:  `${Math.round(sys.ram_percent)}%`,
    gpu:  `${Math.round(0)}%`,
    net:  fmtSpeed(net.dlSpeed),
    disk: `${Math.round(sys.disk_percent)}%`,
  }[chartKey];

  return (
    <Modal open={open} onClose={onClose} title={meta.title}>
      {/* Current value */}
      <div className="text-[36px] font-extrabold tracking-tight mb-4" style={{ color: meta.color }}>
        {currentVal}
      </div>

      {/* Chart bars */}
      <div className="flex items-end gap-[2px] h-[100px] mb-2">
        {history.map((v, i) => (
          <div
            key={i}
            className="flex-1 rounded-[3px_3px_0_0] transition-all duration-300"
            style={{
              height: Math.max(3, (v / max) * 100),
              background: meta.color,
              opacity: 0.25 + 0.75 * (v / max),
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-black/20 dark:text-white/20 mb-4">
        <span>60s ago</span><span>now</span>
      </div>

      {/* System info contextual */}
      {chartKey === 'cpu' && (
        <div className="bg-black/[0.03] dark:bg-white/[0.04] rounded-xl p-3 space-y-2">
          <div className="text-[9px] font-bold tracking-[0.12em] text-black/30 dark:text-white/30 mb-2">SYSTEM INFO</div>
          {[
            ['CPU',   sysInfo.cpu_name || '...'],
            ['Cores', sysInfo.cpu_cores || '...'],
            ['Temp',  fmtTemp(sys.cpu_temp)],
            ['OS',    `${sysInfo.os_name} ${sysInfo.os_version}`],
            ['Host',  sysInfo.hostname],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between">
              <span className="text-[10px] text-black/30 dark:text-white/30">{k}</span>
              <span className="text-[10px] font-semibold text-[#333] dark:text-[#ccc] max-w-[180px] truncate text-right">{String(v)}</span>
            </div>
          ))}
        </div>
      )}

      {chartKey === 'ram' && (
        <div className="bg-black/[0.03] dark:bg-white/[0.04] rounded-xl p-3 space-y-2">
          <div className="text-[9px] font-bold tracking-[0.12em] text-black/30 dark:text-white/30 mb-2">MEMORY</div>
          {[
            ['Total', `${sysInfo.ram_total_gb.toFixed(1)} GB`],
            ['Used',  `${sys.ram_used_gb.toFixed(1)} GB`],
            ['Free',  `${(sysInfo.ram_total_gb - sys.ram_used_gb).toFixed(1)} GB`],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between">
              <span className="text-[10px] text-black/30 dark:text-white/30">{k}</span>
              <span className="text-[10px] font-semibold text-[#333] dark:text-[#ccc]">{v}</span>
            </div>
          ))}
        </div>
      )}

      {chartKey === 'disk' && (
        <div className="bg-black/[0.03] dark:bg-white/[0.04] rounded-xl p-3 space-y-2">
          <div className="text-[9px] font-bold tracking-[0.12em] text-black/30 dark:text-white/30 mb-2">STORAGE</div>
          {[
            ['Used', `${Math.round(sys.disk_percent)}%`],
            ['Free', `${sys.disk_free_gb.toFixed(0)} GB`],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between">
              <span className="text-[10px] text-black/30 dark:text-white/30">{k}</span>
              <span className="text-[10px] font-semibold text-[#333] dark:text-[#ccc]">{v}</span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={onClose}
        className="mt-4 w-full py-2.5 rounded-xl bg-black/[0.04] dark:bg-white/[0.06] text-[12px] font-semibold text-black/40 dark:text-white/40 hover:bg-black/[0.07] dark:hover:bg-white/[0.1] transition-colors"
      >
        Close
      </button>
    </Modal>
  );
}
