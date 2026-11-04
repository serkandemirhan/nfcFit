import React, { FC, useMemo } from 'react';
import { Task, User, WellnessLog } from '../types';
import { MetricCard, Panel, UserAvatar, formatNumber } from '../components/web-ui';

const startOfDay = (date: Date) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
};

export const MembersPage: FC<{ users: User[]; tasks: Task[]; wellnessLogs: WellnessLog[] }> = ({ users, tasks, wellnessLogs }) => {
  const user = users[0];
  const now = new Date();
  const dayStart = startOfDay(now);
  const todayTasks = tasks.filter(task => {
    const date = task.lastCompletedAt ?? task.createdAt;
    return (!user || task.userId === user.id) && date >= dayStart && date <= now;
  });
  const todayWellness = wellnessLogs.filter(log => {
    const date = new Date(log.createdat);
    return (!user || log.user_id === user.id) && date >= dayStart && date <= now;
  });
  const activeMinutes = Math.round(todayTasks.reduce((sum, task) => {
    const quantity = Number(task.quantity ?? 0);
    if (task.unit === 'minutes') return sum + quantity;
    if (task.unit === 'seconds') return sum + quantity / 60;
    return sum;
  }, 0));
  const waterLogs = todayWellness.filter(log => log.wellness_type_id === 'water');
  const water = waterLogs.reduce((sum, log) => sum + Number(log.quantity), 0);
  const waterUnit = waterLogs[0]?.unit;
  const lastActivity = useMemo(() => {
    const fitness = todayTasks.map(task => ({
      id: task.id,
      title: task.title,
      date: task.lastCompletedAt ?? task.createdAt,
    }));
    const wellness = todayWellness.map(log => ({
      id: log.id,
      title: log.wellness_name ?? 'Wellness log',
      date: new Date(log.createdat),
    }));
    return [...fitness, ...wellness].sort((a, b) => b.date.getTime() - a.date.getTime())[0];
  }, [todayTasks, todayWellness]);

  if (!user) {
    return (
      <Panel className="p-8 text-center">
        <h1 className="text-xl font-black text-white">No member profile</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in to view account activity.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Members</h1>
        <p className="mt-1 text-sm text-slate-400">Activity for the signed-in account</p>
      </div>

      <Panel className="p-5">
        <div className="flex items-center gap-4">
          <UserAvatar user={user} className="h-14 w-14 text-lg" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-slate-400">Signed-in account</p>
            <h2 className="mt-1 truncate text-xl font-black text-white">{user.name}</h2>
            <p className="mt-1 truncate text-sm text-slate-400">{user.email ?? 'No email on file'}</p>
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Workouts" value={todayTasks.length} sub="Today" accent="orange" />
        <MetricCard label="Active Time" value={`${formatNumber(activeMinutes)} min`} sub="Today" accent="green" />
        <MetricCard label="Wellness Logs" value={todayWellness.length} sub="Today" accent="blue" />
        <MetricCard
          label="Water"
          value={!waterLogs.length ? 'No logs' : waterUnit === 'ml' ? `${formatNumber(water / 1000)} L` : `${formatNumber(water)} ${waterUnit}`}
          sub="Today"
          accent="purple"
        />
      </div>

      <Panel className="p-5">
        <h2 className="font-black text-white">Latest activity today</h2>
        {lastActivity ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-white">{lastActivity.title}</p>
            <time className="text-sm text-slate-400">
              {new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit' }).format(lastActivity.date)}
            </time>
          </div>
        ) : <p className="mt-3 text-sm text-slate-400">No activity recorded today.</p>}
      </Panel>
    </div>
  );
};
