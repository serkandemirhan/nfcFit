import React, { FC, useMemo, useState } from 'react';
import { Task, WellnessLog, WellnessType } from '../types';
import { Panel, formatNumber, formatUnit } from '../components/web-ui';

type ActivityRow = {
  id: string;
  activity: string;
  category: 'Fitness' | 'Wellness' | 'Health';
  value: number;
  unit?: string | null;
  time: Date;
  status: 'NFC' | 'Manual' | 'Imported';
};

export const TasksPage: FC<{
  tasks: Task[];
  wellnessLogs: WellnessLog[];
  wellnessTypes: WellnessType[];
}> = ({ tasks, wellnessLogs, wellnessTypes }) => {
  const [filter, setFilter] = useState<'all' | 'fitness' | 'wellness' | 'health'>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo<ActivityRow[]>(() => {
    const fitnessRows = tasks.map(task => ({
      id: `fitness:${task.id}`,
      activity: task.exercise_type_id ? task.title.replace(/^\d+(\.\d+)?\s+\w+\s+/, '') : task.title,
      category: task.source === 'health_import' ? 'Health' as const : 'Fitness' as const,
      value: Number(task.quantity ?? 0),
      unit: task.unit,
      time: new Date(task.lastCompletedAt ?? task.createdAt),
      status: task.source === 'health_import' ? 'Imported' as const : task.source === 'nfc' ? 'NFC' as const : 'Manual' as const,
    }));
    const wellnessRows = wellnessLogs.map(log => {
      const type = wellnessTypes.find(item => item.id === log.wellness_type_id);
      return {
        id: `wellness:${log.id}`,
        activity: type?.name ?? log.wellness_name ?? log.wellness_type_id,
        category: log.source === 'health_import' ? 'Health' as const : 'Wellness' as const,
        value: Number(log.quantity ?? 0),
        unit: log.unit,
        time: new Date(log.createdat),
        status: log.source === 'health_import' ? 'Imported' as const : log.source === 'nfc' ? 'NFC' as const : 'Manual' as const,
      };
    });
    return [...fitnessRows, ...wellnessRows].sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [tasks, wellnessLogs, wellnessTypes]);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredRows = rows.filter(row => {
    if (filter !== 'all' && row.category.toLowerCase() !== filter) return false;
    if (normalizedQuery && !`${row.activity} ${row.category} ${row.status}`.toLocaleLowerCase().includes(normalizedQuery)) return false;
    return true;
  });

  const exportCsv = () => {
    const escapeCsv = (value: string | number) => {
      const text = String(value);
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const header = ['Activity', 'Category', 'Value', 'Unit', 'Time', 'Status'];
    const data = filteredRows.map(row => [
      row.activity,
      row.category,
      row.value,
      row.unit ?? '',
      row.time.toISOString(),
      row.status,
    ]);
    const content = [header, ...data].map(line => line.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `nfcfit-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">Activity History</h1>
          <p className="mt-1 text-sm text-slate-400">View and filter all activity logs</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!filteredRows.length}
          className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-300 disabled:cursor-not-allowed disabled:opacity-50">
          Export CSV
        </button>
      </div>

      <Panel className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {(['all', 'fitness', 'wellness', 'health'] as const).map(item => (
              <button key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item} className={`rounded-lg px-4 py-2 text-xs font-bold ${filter === item ? 'bg-green-500 text-[#04120a]' : 'text-slate-300 hover:bg-white/5'}`}>
                {item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            aria-label="Search activities"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2 text-sm text-white outline-none focus:border-green-400"
            placeholder="Search activities..."
          />
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="hidden grid-cols-[2fr_0.8fr_0.7fr_0.6fr_1fr_0.7fr] gap-3 border-b border-white/10 px-5 py-4 text-xs uppercase tracking-wide text-slate-400 md:grid">
          <span>Activity</span>
          <span>Category</span>
          <span>Value</span>
          <span>Unit</span>
          <span>Time</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-white/10">
          {filteredRows.map(row => (
            <div key={row.id} className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4 text-sm md:grid-cols-[2fr_0.8fr_0.7fr_0.6fr_1fr_0.7fr]">
              <div className="col-span-2 min-w-0 md:col-span-1">
                <p className="truncate font-semibold text-white">{row.activity}</p>
                <p className="mt-1 text-xs text-slate-400 md:hidden">{row.category} · {row.status}</p>
              </div>
              <span className="hidden text-slate-300 md:block">{row.category}</span>
              <span className="text-slate-300"><span className="mr-2 text-xs text-slate-500 md:hidden">Value</span>{formatNumber(row.value)}</span>
              <span className="text-slate-300"><span className="mr-2 text-xs text-slate-500 md:hidden">Unit</span>{formatUnit(row.unit)}</span>
              <time className="text-slate-300">
                <span className="mr-2 text-xs text-slate-500 md:hidden">Time</span>
                {new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(row.time)}
              </time>
              <span className="hidden md:block"><span className={`rounded-md px-2 py-1 text-xs font-bold ${row.status === 'Imported' ? 'bg-sky-400/15 text-sky-300' : row.status === 'NFC' ? 'bg-green-400/15 text-green-300' : 'bg-white/10 text-slate-300'}`}>{row.status}</span></span>
            </div>
          ))}
        </div>
        {filteredRows.length === 0 && (
          <div className="p-8 text-center text-slate-400">
            {rows.length ? 'No activities match this filter.' : 'No activity logs yet. Your fitness and wellness entries will appear here.'}
          </div>
        )}
      </Panel>
    </div>
  );
};
