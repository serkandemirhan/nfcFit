import React, { FC, useMemo, useState } from 'react';
import { ExerciseType, Task, User, UserExercise } from '../types';
import { MetricCard, MiniLineChart, Panel, ProgressBar, formatNumber, formatUnit } from '../components/web-ui';

type Period = 'day' | 'week' | 'month';

const startOfDay = (date = new Date()) => {
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

const activityDate = (task: Task) => task.lastCompletedAt ?? task.createdAt;

export const FitnessPage: FC<{
  tasks: Task[];
  users: User[];
  exerciseTypes: ExerciseType[];
  userExercises: UserExercise[];
}> = ({ tasks, users, exerciseTypes }) => {
  const [period, setPeriod] = useState<Period>('week');
  const now = new Date();
  const start = getPeriodStart(period, now);
  const logs = tasks.filter(task => {
    const date = activityDate(task);
    return date >= start && date <= now;
  });

  const calories = logs.reduce((sum, task) => sum + Number(task.calorie_estimate ?? 0), 0);
  const activeMinutes = Math.round(logs.reduce((sum, task) => {
    const quantity = Number(task.quantity ?? 0);
    if (task.unit === 'minutes') return sum + quantity;
    if (task.unit === 'seconds') return sum + quantity / 60;
    return sum;
  }, 0));

  const exerciseById = useMemo(() => new Map(exerciseTypes.map(type => [type.id, type])), [exerciseTypes]);
  const topRows = useMemo(() => {
    const totals = new Map<string, { name: string; unit?: string | null; quantity: number }>();
    logs.forEach(task => {
      const key = task.exercise_type_id ?? task.title;
      const exercise = task.exercise_type_id ? exerciseById.get(task.exercise_type_id) : undefined;
      const current = totals.get(key) ?? { name: exercise?.name ?? task.title, unit: exercise?.unit ?? task.unit, quantity: 0 };
      current.quantity += Number(task.quantity ?? 0);
      totals.set(key, current);
    });
    return [...totals.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  }, [exerciseById, logs]);

  const categoryRows = useMemo(() => {
    const totals = new Map<string, number>();
    logs.forEach(task => {
      const category = task.exercise_type_id ? exerciseById.get(task.exercise_type_id)?.category : undefined;
      const key = category ?? 'other';
      totals.set(key, (totals.get(key) ?? 0) + Number(task.calorie_estimate ?? 0));
    });
    return [...totals.entries()].sort((a, b) => b[1] - a[1]);
  }, [exerciseById, logs]);

  const buckets = useMemo(() => {
    if (period === 'day') {
      return Array.from({ length: 6 }, (_, index) => {
        const bucketStart = new Date(start);
        bucketStart.setHours(index * 4);
        const bucketEnd = new Date(bucketStart);
        bucketEnd.setHours(bucketEnd.getHours() + 4);
        return {
          label: `${String(index * 4).padStart(2, '0')}:00`,
          count: logs.filter(task => activityDate(task) >= bucketStart && activityDate(task) < bucketEnd).length,
        };
      });
    }

    if (period === 'week') {
      return Array.from({ length: 7 }, (_, index) => {
        const bucketStart = new Date(start);
        bucketStart.setDate(bucketStart.getDate() + index);
        const bucketEnd = new Date(bucketStart);
        bucketEnd.setDate(bucketEnd.getDate() + 1);
        return {
          label: new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(bucketStart),
          count: logs.filter(task => activityDate(task) >= bucketStart && activityDate(task) < bucketEnd).length,
        };
      });
    }

    return Array.from({ length: 5 }, (_, index) => {
      const bucketStart = new Date(start);
      bucketStart.setDate(1 + index * 7);
      const bucketEnd = new Date(bucketStart);
      bucketEnd.setDate(bucketEnd.getDate() + 7);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return {
        label: `${bucketStart.getDate()}-${Math.min(bucketStart.getDate() + 6, monthEnd)}`,
        count: logs.filter(task => activityDate(task) >= bucketStart && activityDate(task) < bucketEnd).length,
      };
    });
  }, [logs, now, period, start]);

  const hasCalories = categoryRows.some(([, value]) => value > 0);
  const periodLabel = period === 'day' ? 'today' : period === 'week' ? 'this week' : 'this month';

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">Fitness Analytics</h1>
          <p className="mt-1 text-sm text-slate-400">Your recorded activity {periodLabel}</p>
        </div>
        <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.04] p-1" role="group" aria-label="Activity period">
          {(['day', 'week', 'month'] as const).map(item => (
            <button
              key={item}
              type="button"
              onClick={() => setPeriod(item)}
              aria-pressed={period === item}
              className={`rounded-lg px-5 py-2 text-xs font-bold ${period === item ? 'bg-green-500 text-[#04120a]' : 'text-slate-300 hover:bg-white/5'}`}>
              {item === 'day' ? 'Day' : item === 'week' ? 'Week' : 'Month'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <MetricCard label="Calories Burned" value={formatNumber(calories)} sub={periodLabel} accent="green" />
        <MetricCard label="Active Minutes" value={formatNumber(activeMinutes)} sub={periodLabel} accent="blue" />
        <MetricCard label="Workouts" value={logs.length} sub={periodLabel} accent="orange" />
        <MetricCard label="Exercise Types" value={new Set(logs.map(task => task.exercise_type_id).filter(Boolean)).size} sub={periodLabel} accent="purple" />
      </div>

      {logs.length === 0 ? (
        <Panel className="p-8 text-center">
          <h2 className="font-black text-white">No workouts in this period</h2>
          <p className="mt-2 text-sm text-slate-400">Your fitness charts and summaries will update when activity is recorded.</p>
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel className="p-5">
              <h2 className="font-black text-white">Calories by Category</h2>
              {hasCalories ? (
                <div className="mt-5 space-y-4">
                  {categoryRows.filter(([, value]) => value > 0).map(([category, value]) => (
                    <div key={category}>
                      <div className="mb-2 flex justify-between text-sm">
                        <span className="capitalize text-slate-300">{category}</span>
                        <span className="font-bold text-white">{formatNumber(value)} kcal</span>
                      </div>
                      <ProgressBar value={(value / calories) * 100} color="green" />
                    </div>
                  ))}
                </div>
              ) : <p className="mt-4 text-sm text-slate-400">No calorie estimates are available for this period.</p>}
            </Panel>

            <Panel className="p-5">
              <h2 className="font-black text-white">Workout Trend</h2>
              <div className="mt-4 h-48">
                <MiniLineChart values={buckets.map(bucket => bucket.count)} color="#22c55e" />
              </div>
              <div className={`mt-3 grid gap-2 text-center text-xs text-slate-400 ${period === 'week' ? 'grid-cols-7' : period === 'month' ? 'grid-cols-5' : 'grid-cols-6'}`}>
                {buckets.map(bucket => <span key={bucket.label}>{bucket.label}</span>)}
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
                    <div key={row.id} className="grid grid-cols-[130px_1fr_auto] items-center gap-3 text-sm">
                      <span className="truncate font-semibold text-white">{row.name}</span>
                      <ProgressBar value={(row.quantity / max) * 100} color="green" />
                      <span className="text-right text-slate-300">{formatNumber(row.quantity)} {formatUnit(row.unit)}</span>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel className="p-5">
              <h2 className="font-black text-white">Sessions by Period</h2>
              <div className="mt-5 flex h-44 items-end gap-3">
                {buckets.map(bucket => (
                  <div key={bucket.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                    <div className="w-full rounded-t-lg bg-green-400" style={{ height: `${Math.max(bucket.count > 0 ? 8 : 2, (bucket.count / Math.max(...buckets.map(item => item.count), 1)) * 100)}%` }} />
                    <span className="text-xs text-slate-400">{bucket.label}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
};
