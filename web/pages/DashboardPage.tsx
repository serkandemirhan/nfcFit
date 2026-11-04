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
  const todayLogs = useMemo(
    () => tasks.filter(task => isToday(task.lastCompletedAt ?? task.createdAt)),
    [tasks]
  );
  const todayWellness = useMemo(() => wellnessLogs.filter(log => isToday(new Date(log.createdat))), [wellnessLogs]);
  const calories = todayLogs.reduce((sum, task: any) => sum + Number(task.calorie_estimate ?? 0), 0);
  const workouts = todayLogs.length;
  const activeMinutes = Math.round(todayLogs.reduce((sum, task) => {
    const quantity = Number(task.quantity ?? 0);
    if (task.unit === 'minutes') return sum + quantity;
    if (task.unit === 'seconds') return sum + quantity / 60;
    return sum;
  }, 0));
  const waterGoal = wellnessGoals.find(goal => goal.wellness_type_id === 'water');
  const waterDone = todayWellness.filter(log => log.wellness_type_id === 'water').reduce((sum, log) => sum + Number(log.quantity), 0);
  const waterTarget = Number(waterGoal?.target_quantity ?? 0);
  const waterProgress = waterTarget > 0 ? Math.min(100, (waterDone / waterTarget) * 100) : 0;
  const activeGoalCount = goals.length + (waterGoal ? 1 : 0);
  const goalRows = goals;
  const chartValues = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const fitnessCount = tasks.filter(task => {
        const loggedAt = task.lastCompletedAt ?? task.createdAt;
        return loggedAt >= date && loggedAt < nextDay;
      }).length;
      const wellnessCount = wellnessLogs.filter(log => {
        const loggedAt = new Date(log.createdat);
        return loggedAt >= date && loggedAt < nextDay;
      }).length;
      return fitnessCount + wellnessCount;
    });
  }, [tasks, wellnessLogs]);
  const lastActivity = useMemo(() => {
    const fitnessActivity = tasks.map(task => ({
      id: task.id,
      title: task.title,
      date: task.lastCompletedAt ?? task.createdAt,
      source: task.source,
    }));
    const wellnessActivity = wellnessLogs.map(log => ({
      id: log.id,
      title: wellnessTypes.find(type => type.id === log.wellness_type_id)?.name ?? log.wellness_name ?? 'Wellness',
      date: new Date(log.createdat),
      source: log.source,
    }));
    return [...fitnessActivity, ...wellnessActivity].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  }, [tasks, wellnessLogs, wellnessTypes]);
  const todayCompletedGoals = goals.filter(goal => Number(goal.target_quantity) > 0 &&
    Number(goal.completed_quantity ?? 0) >= Number(goal.target_quantity)).length +
    (waterTarget > 0 && waterDone >= waterTarget ? 1 : 0);
  const hasActivity = chartValues.some(value => value > 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-300">Good morning{users[0]?.name ? `, ${users[0].name}` : ''}</p>
          <h1 className="mt-1 text-2xl font-black text-white">Dashboard Overview</h1>
          <p className="mt-1 text-xs text-slate-400">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date())}</p>
        </div>
        <span className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-slate-300">
          {cards.filter(card => card.active !== false).length} active NFC tags
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="Workouts" value={workouts} sub="Today" icon="🔥" accent="orange" />
        <MetricCard label="Active Time" value={`${activeMinutes} min`} sub="Today" icon="⏱" accent="green" />
        <MetricCard label="Calories" value={`${formatNumber(calories)} kcal`} sub="Today" icon="⚡" accent="orange" />
        <MetricCard label="Water" value={`${formatNumber(waterDone / 1000)} L`} sub="Today" icon="💧" accent="blue" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Panel className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-black text-white">Daily Goals</h2>
            <span className="text-xs text-slate-400">{activeGoalCount} active</span>
          </div>
          {goalRows.length ? <div className="space-y-4">
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
          </div> : <p className="text-sm text-slate-400">No daily goals yet. Add goals to track progress here.</p>}
        </Panel>

        <Panel className="p-5">
          <h2 className="font-black text-white">Today Summary</h2>
          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-slate-300">Calories logged</span>
                <span className="font-bold text-white">{formatNumber(calories)} kcal</span>
              </div>
              <ProgressBar value={calories > 0 ? 100 : 0} color="green" />
            </div>
            <div>
              <div className="mb-2 flex justify-between text-sm">
                <span className="text-slate-300">Goals completed</span>
                <span className="font-bold text-white">{todayCompletedGoals} / {activeGoalCount}</span>
              </div>
              <ProgressBar value={activeGoalCount ? (todayCompletedGoals / activeGoalCount) * 100 : 0} color="orange" />
            </div>
            <div className="rounded-xl border border-sky-400/20 bg-sky-400/10 p-3">
              <p className="text-sm font-bold text-sky-300">{workouts ? 'Nice work today' : 'Ready when you are'}</p>
              <p className="mt-1 text-xs text-slate-300">
                {workouts ? `${workouts} workout${workouts === 1 ? '' : 's'} logged today.` : 'Your activity will appear here after your first log.'}
              </p>
            </div>
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-black text-white">Activity Overview</h2>
          <span className="text-xs text-slate-400">Last 7 days</span>
        </div>
        {hasActivity ? <>
          <div className="h-48">
            <MiniLineChart values={chartValues} color="#22c55e" />
          </div>
          <div className="mt-3 grid grid-cols-7 gap-2 text-center text-xs text-slate-400">
            {Array.from({ length: 7 }, (_, index) => {
              const date = new Date();
              date.setDate(date.getDate() - (6 - index));
              return <span key={index}>{new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(date)}</span>;
            })}
          </div>
        </> : <p className="text-sm text-slate-400">No activity recorded in the last 7 days.</p>}
      </Panel>

      {lastActivity && (
        <Panel className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">Last activity</p>
          <p className="mt-1 font-bold text-white">{lastActivity.title}</p>
          <p className="mt-1 text-xs text-slate-400">
            {lastActivity.source === 'nfc' ? 'NFC log' : lastActivity.source === 'health_import' ? 'Health import' : 'Manual log'}
            {' · '}{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(lastActivity.date)}
          </p>
        </Panel>
      )}
    </div>
  );
};
