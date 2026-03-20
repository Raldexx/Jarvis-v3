import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmtSpeed(kbs: number): string {
  if (kbs >= 1024) return `${(kbs / 1024).toFixed(1)} MB/s`;
  return `${kbs.toFixed(0)} KB/s`;
}

export function fmtTemp(t: number | null): string {
  return t != null ? `${Math.round(t)}°C` : 'N/A';
}

export function fmtUptime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  return `${h}h ${m}m`;
}

export function colorForPct(pct: number): string {
  if (pct > 85) return '#ef4444';
  if (pct > 65) return '#f59e0b';
  return '';
}
