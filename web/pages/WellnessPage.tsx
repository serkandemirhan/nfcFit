import React, { FC, useMemo, useState } from 'react';
import { WellnessGoal, WellnessLog, WellnessType } from '../types';
import { Donut, Panel, ProgressBar, formatNumber, formatUnit } from '../components/web-ui';

const isToday = (value: string) => {
  const date = new Date(value);
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
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
  const todayLogs = useMemo(() => wellnessLogs.filter(log => isToday(log.createdat)), [wellnessLogs]);
  const rows = wellnessGoals.filter(goal => goal.active !== false).map(goal => {
    const type = wellnessTypes.find(item => item.id === goal.wellness_type_id);
    const completed = todayLogs.filter(log => log.wellness_type_id === goal.wellness_type_id).reduce((sum, log) => sum + Number(log.quantity), 0);
    return { goal, type, completed, progress: Math.min(100, (completed / Number(goal.target_quantity || 1)) * 100) };
  });
  const completedHabits = rows.filter(row => row.completed >= Number(row.goal.target_quantity)).length;
  const water = rows.find(row => row.goal.wellness_type_id === 'water');
  const score = rows.length > 0 ? Math.round(rows.reduce((sum, row) => sum + Math.min(100, row.progress), 0) / rows.length) : 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">Wellness Tracking</h1>
          <p className="mt-1 text-sm text-slate-400">Build healthy habits every day</p>
        </div>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
          {(['day', 'week', 'month'] as const).map(item => (
            <button key={item} onClick={() => setPeriod(item)} className={`rounded-lg px-5 py-2 text-xs font-bold ${period === item ? 'bg-green-500 text-[#04120a]' : 'text-slate-300 hover:bg-white/5'}`}>
              {item === 'day' ? 'Day' : item === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Panel className="p-5">
          <h2 className="font-black text-white">Wellness Score</h2>
          <div className="mt-5 flex justify-center">
            <Donut value={score || 82} label="Score" color="#38bdf8" />
          </div>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm text-slate-400">Habits Completed</p>
          <p className="mt-4 text-4xl font-black text-white">{completedHabits} / {rows.length || 5}</p>
          <div className="mt-5">
            <ProgressBar value={rows.length ? (completedHabits / rows.length) * 100 : 80} color="green" />
          </div>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm text-slate-400">Streak</p>
          <p className="mt-4 text-4xl font-black text-white">12</p>
          <p className="mt-2 text-sm text-slate-300">Keep it up.</p>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-5">
          <h2 className="font-black text-white">Today's Habits</h2>
          <div className="mt-5 space-y-4">
            {rows.map(row => (
              <div key={row.goal.wellness_type_id} className="grid grid-cols-[34px_1fr_130px_32px] items-center gap-3">
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-sky-400/10 text-sky-300">{iconFor(row.goal.wellness_type_id)}</div>
                <div>
                  <p className="font-semibold text-white">{row.type?.name ?? row.goal.wellness_type_id}</p>
                  <ProgressBar value={row.progress} color={row.goal.wellness_type_id === 'water' ? 'blue' : 'purple'} />
                </div>
                <p className="text-right text-sm text-slate-300">
                  {formatNumber(row.completed)} / {formatNumber(Number(row.goal.target_quantity))} {formatUnit(row.goal.unit)}
                </p>
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs ${row.progress >= 100 ? 'bg-green-500 text-[#04120a]' : 'bg-white/10 text-slate-300'}`}>
                  {row.progress >= 100 ? '✓' : '•'}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="font-black text-white">Water Intake</h2>
          <div className="mt-5 flex justify-center">
            <Donut value={water?.progress ?? 60} label="Water" color="#38bdf8">
              <div>
                <p className="text-2xl font-black text-white">{formatNumber(Number(water?.completed ?? 1800) / 1000)} L</p>
                <p className="text-xs text-slate-400">of {formatNumber(Number(water?.goal.target_quantity ?? 3000) / 1000)} L</p>
              </div>
            </Donut>
          </div>
          <div className="mt-6 rounded-xl border border-green-400/20 bg-green-400/10 p-4">
            <p className="font-bold text-green-300">Wellness Tips</p>
            <p className="mt-1 text-sm text-slate-300">Stay hydrated. You are making good progress today.</p>
          </div>
        </Panel>
      </div>
    </div>
  );
};
