import React, { FC, useMemo, useState } from 'react';
import { WellnessGoal, WellnessLog, WellnessType } from '../types';
import { Donut, Panel, ProgressBar, formatNumber, formatUnit } from '../components/web-ui';

type Period = 'day' | 'week' | 'month';

const startOfDay = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

const getPeriodStart = (period: Period, now: Date) => {
  const start = startOfDay(now);
  if (period === 'week') {
    const weekday = start.getDay() || 7;
    start.setDate(start.getDate() - weekday + 1);
  }
  if (period === 'month') start.setDate(1);
  return start;
};

const iconFor = (id: string) => {
  if (id === 'water') return 'W';
  if (id === 'coffee') return 'C';
  if (id === 'meditation') return 'M';
  if (id === 'walk_break') return 'B';
  if (id === 'vitamins') return 'V';
  return '+';
};

export const WellnessPage: FC<{
  wellnessTypes: WellnessType[];
  wellnessGoals: WellnessGoal[];
  wellnessLogs: WellnessLog[];
}> = ({ wellnessTypes, wellnessGoals, wellnessLogs }) => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const now = new Date();
  const start = getPeriodStart(period, now);
  const daysInPeriod = period === 'day' ? 1 : Math.max(1, Math.floor((startOfDay(now).getTime() - start.getTime()) / 86400000) + 1);
  const periodLogs = useMemo(() => wellnessLogs.filter(log => {
    const date = new Date(log.createdat);
    return date >= start && date <= now;
  }), [now, start, wellnessLogs]);
  const rows = wellnessGoals.filter(goal => goal.active !== false).map(goal => {
    const type = wellnessTypes.find(item => item.id === goal.wellness_type_id);
    const completed = periodLogs.filter(log => log.wellness_type_id === goal.wellness_type_id).reduce((sum, log) => sum + Number(log.quantity), 0);
    const target = Number(goal.target_quantity) * daysInPeriod;
    return { goal, type, completed, target, progress: target > 0 ? Math.min(100, (completed / target) * 100) : 0 };
  });
  const completedHabits = rows.filter(row => row.target > 0 && row.completed >= row.target).length;
  const water = rows.find(row => row.goal.wellness_type_id === 'water');
  const waterLogs = periodLogs.filter(log => log.wellness_type_id === 'water');
  const waterTotal = waterLogs.reduce((sum, log) => sum + Number(log.quantity), 0);
  const score = rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + row.progress, 0) / rows.length) : 0;
  const loggedDays = new Set(periodLogs.map(log => new Date(log.createdat).toDateString())).size;
  const periodLabel = period === 'day' ? 'today' : period === 'week' ? 'this week' : 'this month';

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">Wellness Tracking</h1>
          <p className="mt-1 text-sm text-slate-400">Your recorded wellness {periodLabel}</p>
        </div>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1" role="group" aria-label="Wellness period">
          {(['day', 'week', 'month'] as const).map(item => (
            <button key={item} type="button" onClick={() => setPeriod(item)} aria-pressed={period === item} className={`rounded-lg px-5 py-2 text-xs font-bold ${period === item ? 'bg-green-500 text-[#04120a]' : 'text-slate-300 hover:bg-white/5'}`}>
              {item === 'day' ? 'Day' : item === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel className="p-5">
          <h2 className="font-black text-white">Wellness Score</h2>
          <div className="mt-5 flex justify-center">
            <Donut value={score} label="Score" color="#38bdf8" />
          </div>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm text-slate-400">Goals Met</p>
          <p className="mt-4 text-4xl font-black text-white">{completedHabits} / {rows.length}</p>
          <div className="mt-5">
            <ProgressBar value={rows.length ? (completedHabits / rows.length) * 100 : 0} color="green" />
          </div>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm text-slate-400">Days with logs</p>
          <p className="mt-4 text-4xl font-black text-white">{loggedDays} / {daysInPeriod}</p>
          <p className="mt-2 text-sm text-slate-300">{periodLabel}</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-5">
          <h2 className="font-black text-white">Wellness Goals</h2>
          {rows.length ? <div className="mt-5 space-y-4">
            {rows.map(row => (
              <div key={row.goal.wellness_type_id} className="grid grid-cols-[34px_1fr_auto_24px] items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-400/10 text-sky-300">{iconFor(row.goal.wellness_type_id)}</div>
                <div>
                  <p className="font-semibold text-white">{row.type?.name ?? row.goal.wellness_type_id}</p>
                  <ProgressBar value={row.progress} color={row.goal.wellness_type_id === 'water' ? 'blue' : 'purple'} />
                </div>
                <p className="text-right text-sm text-slate-300">
                  {formatNumber(row.completed)} / {formatNumber(row.target)} {formatUnit(row.goal.unit)}
                </p>
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${row.progress >= 100 ? 'bg-green-500 text-[#04120a]' : 'bg-white/10 text-slate-300'}`}>
                  {row.progress >= 100 ? '✓' : '•'}
                </span>
              </div>
            ))}
          </div> : <p className="mt-4 text-sm text-slate-400">No wellness goals yet. Add a goal to start tracking progress.</p>}
        </Panel>

        <Panel className="p-5">
          <h2 className="font-black text-white">Water Intake</h2>
          <div className="mt-5 flex justify-center">
            <Donut value={water?.progress ?? 0} label="Water" color="#38bdf8">
              <div>
                <p className="text-2xl font-black text-white">{formatNumber(water ? Number(water.completed) / 1000 : waterTotal / 1000)} L</p>
                <p className="text-xs text-slate-400">
                  {water ? `of ${formatNumber(Number(water.target) / 1000)} L` : 'No target set'}
                </p>
              </div>
            </Donut>
          </div>
          <div className="mt-6 rounded-xl border border-green-400/20 bg-green-400/10 p-4">
            <p className="font-bold text-green-300">Wellness activity</p>
            <p className="mt-1 text-sm text-slate-300">
              {waterLogs.length ? `${waterLogs.length} water log${waterLogs.length === 1 ? '' : 's'} recorded ${periodLabel}.` : `Water logs will appear here when recorded ${periodLabel}.`}
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
};
