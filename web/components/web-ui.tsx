import React from 'react';

export function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`${small ? 'h-5 w-5' : 'h-8 w-8'} rounded-xl bg-green-500/20 border border-green-400/30 grid place-items-center text-green-300`}>
        <span className={small ? 'text-xs' : 'text-base'}>N</span>
      </div>
      <span className={`${small ? 'text-sm' : 'text-xl'} font-black tracking-tight text-white`}>
        NFC<span className="text-green-400">Fit</span>
      </span>
    </div>
  );
}

export function BrowserFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-[18px] border border-white/20 bg-[#071521]/88 shadow-2xl shadow-black/40 ${className}`}>
      <div className="flex h-7 items-center gap-1.5 border-b border-white/10 px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
      </div>
      {children}
    </section>
  );
}

export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.045] shadow-lg shadow-black/10 ${className}`}>
      {children}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  icon,
  accent = 'green',
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: 'green' | 'blue' | 'purple' | 'orange';
}) {
  const colors = {
    green: 'text-green-300 bg-green-400/10 border-green-400/20',
    blue: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
    purple: 'text-violet-300 bg-violet-400/10 border-violet-400/20',
    orange: 'text-orange-300 bg-orange-400/10 border-orange-400/20',
  };
  return (
    <Panel className="p-4">
      <div className="flex items-center gap-3">
        {icon && <div className={`grid h-10 w-10 place-items-center rounded-xl border ${colors[accent]}`}>{icon}</div>}
        <div className="min-w-0">
          <p className="text-xs text-slate-400">{label}</p>
          <p className="mt-1 truncate text-2xl font-black text-white">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-400">{sub}</p>}
        </div>
      </div>
    </Panel>
  );
}

export function ProgressBar({ value, color = 'green' }: { value: number; color?: 'green' | 'blue' | 'purple' | 'orange' }) {
  const colors = {
    green: 'bg-green-400',
    blue: 'bg-sky-400',
    purple: 'bg-violet-400',
    orange: 'bg-orange-400',
  };
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${colors[color]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Donut({
  value,
  label,
  color = '#22c55e',
  children,
}: {
  value: number;
  label: string;
  color?: string;
  children?: React.ReactNode;
}) {
  const safe = Math.max(0, Math.min(100, value));
  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div
        className="grid h-32 w-32 place-items-center rounded-full"
        style={{ background: `conic-gradient(${color} ${safe}%, rgba(255,255,255,0.08) 0)` }}>
        <div className="grid h-24 w-24 place-items-center rounded-full bg-[#071521] text-center">
          {children ?? <div><p className="text-2xl font-black text-white">{Math.round(safe)}%</p><p className="text-xs text-slate-400">{label}</p></div>}
        </div>
      </div>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

export function MiniLineChart({ values, color = '#22c55e' }: { values: number[]; color?: string }) {
  const width = 420;
  const height = 120;
  const max = Math.max(...values, 1);
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
    const y = height - (value / max) * (height - 16) - 8;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full overflow-visible">
      <polyline points={points} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {values.map((value, index) => {
        const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
        const y = height - (value / max) * (height - 16) - 8;
        return <circle key={index} cx={x} cy={y} r="4" fill={color} />;
      })}
    </svg>
  );
}

export function formatUnit(unit?: string | null) {
  if (unit === 'seconds') return 'sec';
  if (unit === 'minutes') return 'min';
  if (unit === 'meters') return 'm';
  if (unit === 'ml') return 'ml';
  if (unit === 'cups') return 'cups';
  if (unit === 'count') return 'taken';
  return 'reps';
}

export function formatNumber(value: number) {
  return Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 1 });
}
