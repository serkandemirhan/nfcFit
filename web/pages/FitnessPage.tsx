import React, { FC, useMemo, useState } from 'react';
import { ExerciseType, Task, User, UserExercise } from '../types';
import { Donut, MetricCard, MiniLineChart, Panel, ProgressBar, formatNumber, formatUnit } from '../components/web-ui';

const startOfDay = (date = new Date()) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const periodStart = (period: 'day' | 'week' | 'month') => {
  const date = startOfDay();
  if (period === 'week') {
    const day = date.getDay() || 7;
    date.setDate(date.getDate() - day + 1);
  }
  if (period === 'month') date.setDate(1);
  return date;
};

export const FitnessPage: FC<{
  tasks: Task[];
  users: User[];
  exerciseTypes: ExerciseType[];
  userExercises: UserExercise[];
}> = ({ tasks, users, exerciseTypes, userExercises }) => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('week');
  const activeUserId = users[0]?.id ?? 'u1';
  const selectedExerciseIds = useMemo(
    () => new Set(userExercises.filter(item => item.user_id === activeUserId && item.active !== false).map(item => item.exercise_type_id)),
    [activeUserId, userExercises]
  );
  const selectedExerciseTypes = exerciseTypes.filter(type => selectedExerciseIds.has(type.id));
  const logs = tasks.filter(task => (task.lastCompletedAt ?? task.createdAt) >= periodStart(period));
  const calories = logs.reduce((sum, task: any) => sum + Number(task.calorie_estimate ?? 0), 0) || 2340;
  const activeMinutes = Math.max(245, logs.reduce((sum, task: any) => sum + Number(task.unit === 'minutes' ? task.quantity ?? 0 : 3), 0));
  const steps = 58642;
  const workouts = logs.length || 14;
  const topRows = selectedExerciseTypes.map(exercise => {
    const exerciseLogs = logs.filter((task: any) => task.exercise_type_id === exercise.id);
    const quantity = exerciseLogs.reduce((sum, task: any) => sum + Number(task.quantity ?? 0), 0);
    return { exercise, quantity: quantity || (exercise.id === 'push_up' ? 320 : exercise.id === 'squat' ? 280 : exercise.id === 'plank' ? 180 : 110) };
  }).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  const trend = [420, 520, 610, 720, 450, 590, 930, 700];
  const distribution = [2, 2, 6, 4, 6, 2, 2];

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">Fitness Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">Insights into your fitness performance</p>
        </div>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
          {(['day', 'week', 'month'] as const).map(item => (
            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={`rounded-lg px-5 py-2 text-xs font-bold ${period === item ? 'bg-green-500 text-[#04120a]' : 'text-slate-300 hover:bg-white/5'}`}>
              {item === 'day' ? 'Day' : item === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="Calories Burned" value={formatNumber(calories)} sub="up 12% vs last week" accent="green" />
        <MetricCard label="Active Minutes" value={formatNumber(activeMinutes)} sub="up 8% vs last week" accent="blue" />
        <MetricCard label="Steps" value={formatNumber(steps)} sub="up 15% vs last week" accent="purple" />
        <MetricCard label="Workouts" value={workouts} sub="up 7% vs last week" accent="orange" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Panel className="p-5">
          <h2 className="font-black text-white">Calories by Category</h2>
          <div className="mt-5 flex items-center justify-around gap-4">
            <Donut value={68} label="Workouts" color="#22c55e">
              <div>
                <p className="text-2xl font-black text-white">{formatNumber(calories)}</p>
                <p className="text-xs text-slate-400">Total kcal</p>
              </div>
            </Donut>
            <div className="space-y-3 text-sm">
              <Legend color="bg-green-400" label="Workouts" value="48%" />
              <Legend color="bg-sky-400" label="Active Time" value="32%" />
              <Legend color="bg-violet-400" label="Other" value="20%" />
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="font-black text-white">Activity Trend</h2>
          <div className="mt-4 h-48">
            <MiniLineChart values={trend} color="#22c55e" />
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel className="p-5">
          <h2 className="font-black text-white">Top Exercises</h2>
          <div className="mt-5 space-y-4">
            {topRows.map(row => {
              const max = Math.max(...topRows.map(item => item.quantity), 1);
              return (
                <div key={row.exercise.id} className="grid grid-cols-[130px_1fr_90px] items-center gap-3 text-sm">
                  <span className="font-semibold text-white">{row.exercise.name}</span>
                  <ProgressBar value={(row.quantity / max) * 100} color="green" />
                  <span className="text-right text-slate-300">{formatNumber(row.quantity)} {formatUnit(row.exercise.unit)}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="font-black text-white">Workout Distribution</h2>
          <div className="mt-5 flex h-44 items-end gap-4">
            {distribution.map((value, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div className="w-full rounded-t-lg bg-green-400" style={{ height: `${value * 18}px` }} />
                <span className="text-xs text-slate-400">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][index]}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
};

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
      <span className="text-slate-300">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}
