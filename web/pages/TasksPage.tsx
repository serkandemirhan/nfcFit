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
  status: string;
};

export const TasksPage: FC<{
  tasks: Task[];
  wellnessLogs: WellnessLog[];
  wellnessTypes: WellnessType[];
}> = ({ tasks, wellnessLogs, wellnessTypes }) => {
  const [filter, setFilter] = useState<'all' | 'fitness' | 'wellness' | 'health'>('all');
  const [query, setQuery] = useState('');

  const rows = useMemo<ActivityRow[]>(() => {
    const fitnessRows = tasks.map((task: any) => ({
      id: task.id,
      activity: task.exercise_type_id ? task.title.replace(/^\d+(\.\d+)?\s+\w+\s+/, '') : task.title,
      category: 'Fitness' as const,
      value: Number(task.quantity ?? 0),
      unit: task.unit,
      time: task.lastCompletedAt ?? task.createdAt,
      status: task.source === 'health_import' ? 'Imported' : 'Synced',
    }));
    const wellnessRows = wellnessLogs.map(log => {
      const type = wellnessTypes.find(item => item.id === log.wellness_type_id);
      return {
        id: log.id,
        activity: type?.name ?? log.wellness_name ?? log.wellness_type_id,
        category: 'Wellness' as const,
        value: Number(log.quantity ?? 0),
        unit: log.unit,
        time: new Date(log.createdat),
        status: log.source === 'health_import' ? 'Imported' : 'Synced',
      };
    });
    return [...fitnessRows, ...wellnessRows].sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [tasks, wellnessLogs, wellnessTypes]);

  const filteredRows = rows.filter(row => {
    if (filter !== 'all' && row.category.toLowerCase() !== filter) return false;
    if (query && !row.activity.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">Activity History</h1>
          <p className="mt-1 text-sm text-slate-400">View and filter all activity logs</p>
        </div>
        <button className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-bold text-slate-300">Export</button>
      </div>

      <Panel className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
            {(['all', 'fitness', 'wellness', 'health'] as const).map(item => (
              <button key={item} onClick={() => setFilter(item)} className={`rounded-lg px-4 py-2 text-xs font-bold ${filter === item ? 'bg-green-500 text-[#04120a]' : 'text-slate-300 hover:bg-white/5'}`}>
                {item === 'all' ? 'All' : item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-2 text-sm text-white outline-none focus:border-green-400"
            placeholder="Search activities..."
          />
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-4">Activity</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Value</th>
              <th className="px-5 py-4">Unit</th>
              <th className="px-5 py-4">Time</th>
              <th className="px-5 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {filteredRows.map(row => (
              <tr key={row.id} className="hover:bg-white/[0.03]">
                <td className="px-5 py-3 font-semibold text-white">{row.activity}</td>
                <td className="px-5 py-3 text-slate-300">{row.category}</td>
                <td className="px-5 py-3 text-slate-300">{formatNumber(row.value)}</td>
                <td className="px-5 py-3 text-slate-300">{formatUnit(row.unit)}</td>
                <td className="px-5 py-3 text-slate-300">{new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(row.time)}</td>
                <td className="px-5 py-3"><span className="rounded-md bg-green-400/15 px-2 py-1 text-xs font-bold text-green-300">{row.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 && <div className="p-8 text-center text-slate-400">No activity logs yet.</div>}
      </Panel>
    </div>
  );
};
