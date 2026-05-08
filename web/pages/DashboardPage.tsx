import React, { FC, useMemo } from 'react';
import { DailyGoalProgress, NfcCard, Task, User, WellnessGoal, WellnessLog, WellnessType } from '../types';
import { MetricCard, MiniLineChart, Panel, ProgressBar, formatNumber, formatUnit } from '../components/web-ui';

const isToday = (date: Date) => {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
};

export const DashboardPage: FC<{
  tasks: Task[];
  users: User[];
  cards: NfcCard[];
  goals: DailyGoalProgress[];
  wellnessTypes: WellnessType[];
  wellnessGoals: WellnessGoal[];
  wellnessLogs: WellnessLog[];
}> = ({ tasks, users, cards, goals, wellnessTypes, wellnessGoals, wellnessLogs }) => {
  const todayLogs = useMemo(() => tasks.filter(task => isToday(task.lastCompletedAt ?? task.createdAt)), [tasks]);
  const todayWellness = useMemo(() => wellnessLogs.filter(log => isToday(new Date(log.createdat))), [wellnessLogs]);
  const calories = todayLogs.reduce((sum, task: any) => sum + Number(task.calorie_estimate ?? 0), 0);
  const workouts = todayLogs.length;
  const activeMinutes = Math.max(45, Math.round(todayLogs.reduce((sum, task: any) => sum + Number(task.unit === 'minutes' ? task.quantity ?? 0 : 2), 0)));
  const steps = 7842;
  const waterGoal = wellnessGoals.find(goal => goal.wellness_type_id === 'water');
  const waterDone = todayWellness.filter(log => log.wellness_type_id === 'water').reduce((sum, log) => sum + Number(log.quantity), 0);
  const waterProgress = waterGoal ? Math.min(100, (waterDone / Number(waterGoal.target_quantity)) * 100) : 0;
  const goalRows = goals.slice(0, 4);
  const chartValues = [12, 20, 32, 38, 51, 44, 68, 58, 80, 61, 74, 66];
  const lastLog = todayLogs[0] ?? tasks[0];

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-300">Good morning, {users[0]?.name ?? 'Serkan'}</p>
          <h1 className="mt-1 text-2xl font-black text-white">Dashboard Overview</h1>
          <p className="mt-1 text-xs text-slate-400">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}</p>
        </div>
        <button className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
          {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date())}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="Workouts" value={workouts || 3} sub="Today" icon="🔥" accent="orange" />
        <MetricCard label="Active Time" value={`${activeMinutes} min`} sub="Today" icon="⏱" accent="green" />
        <MetricCard label="Steps" value={formatNumber(steps)} sub="Today" icon="🏃" accent="orange" />
        <MetricCard label="Water" value={`${formatNumber(waterDone / 1000)} L`} sub="Today" icon="💧" accent="blue" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-black text-white">Daily Goals</h2>
            <span className="text-xs text-slate-400">{goalRows.length} active</span>
          </div>
          <div className="space-y-4">
            {goalRows.map(goal => {
              const done = Number(goal.completed_quantity ?? 0);
              const target = Number(goal.target_quantity ?? 0);
              const progress = target > 0 ? (done / target) * 100 : 0;
              return (
                <div key={goal.exercise_type_id}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="font-semibold text-white">{goal.exercise_name}</span>
                    <span className="text-slate-300">{formatNumber(done)} / {formatNumber(target)} {formatUnit(goal.unit)}</span>
                  </div>
                  <ProgressBar value={progress} color="green" />
                </div>
              );
            })}
            {waterGoal && (
              <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-semibold text-white">Water</span>
                  <span className="text-slate-300">{formatNumber(waterDone / 1000)} / {formatNumber(Number(waterGoal.target_quantity) / 1000)} L</span>
                </div>
                <ProgressBar value={waterProgress} color="blue" />
              </div>
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="font-black text-white">Today Summary</h2>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-slate-300">Calories Burned</span>
                <span className="font-bold text-white">{Math.round(calories || 320)} / 2,000 kcal</span>
              </div>
              <ProgressBar value={Math.min(100, ((calories || 320) / 2000) * 100)} color="green" />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-slate-300">Streak</span>
                <span className="font-bold text-white">12 days</span>
              </div>
              <ProgressBar value={70} color="orange" />
            </div>
            <div className="rounded-xl border border-green-400/20 bg-green-400/10 p-3">
              <p className="text-sm font-bold text-green-300">You're on fire</p>
              <p className="mt-1 text-xs text-slate-300">Keep going to reach your goals.</p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-black text-white">Activity Overview</h2>
          <span className="text-xs text-slate-400">{cards.length} NFC tags</span>
        </div>
        <div className="h-48">
          <MiniLineChart values={chartValues} color="#22c55e" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-400">
          <span>Workouts</span>
          <span>Active Time</span>
          <span>Steps</span>
        </div>
      </Panel>

      {lastLog && (
        <Panel className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Last NFC activity</p>
          <p className="mt-1 font-bold text-white">{lastLog.title}</p>
        </Panel>
      )}
    </div>
  );
};
