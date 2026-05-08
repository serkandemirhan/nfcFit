import React, { FC } from 'react';
import { Task, User, WellnessLog } from '../types';
import { Panel, ProgressBar, formatNumber } from '../components/web-ui';

export const MembersPage: FC<{ users: User[]; tasks: Task[]; wellnessLogs: WellnessLog[] }> = ({ users, tasks, wellnessLogs }) => {
  const user = users[0];
  const water = wellnessLogs.filter(log => log.wellness_type_id === 'water').reduce((sum, log) => sum + Number(log.quantity), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-black text-white">Members</h1>
          <p className="mt-1 text-sm text-slate-400">Track member activity and engagement</p>
        </div>
        <button className="rounded-xl bg-green-500 px-4 py-2 text-sm font-black text-[#04120a]">+ Add Member</button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Panel className="overflow-hidden">
          <div className="grid grid-cols-[1fr_110px_120px_120px_120px] gap-3 border-b border-white/10 px-5 py-4 text-xs uppercase tracking-wide text-slate-400">
            <span>Member</span>
            <span>Status</span>
            <span>Last Activity</span>
            <span>Workouts Today</span>
            <span>Water Today</span>
          </div>
          {[user].map(member => (
            <div key={member.id} className="grid grid-cols-[1fr_110px_120px_120px_120px] items-center gap-3 px-5 py-4 text-sm">
              <div className="flex items-center gap-3">
                <img src={member.avatarurl ?? member.avatarUrl} alt={member.name} className="h-9 w-9 rounded-full" />
                <div>
                  <p className="font-bold text-white">{member.name}</p>
                  <p className="text-xs text-slate-400">{member.email}</p>
                </div>
              </div>
              <span className="w-fit rounded-md bg-green-400/15 px-2 py-1 text-xs font-bold text-green-300">Active</span>
              <span className="text-slate-300">2 min ago</span>
              <span className="text-slate-300">{tasks.length || 3}</span>
              <span className="text-slate-300">{formatNumber(water / 1000 || 1.8)} L</span>
            </div>
          ))}
        </Panel>

        <Panel className="p-5">
          <div className="flex items-center gap-3">
            <img src={user?.avatarurl ?? user?.avatarUrl} alt={user?.name} className="h-12 w-12 rounded-full" />
            <div>
              <h2 className="font-black text-white">{user?.name}</h2>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
          </div>
          <div className="mt-6 space-y-4">
            <Metric label="Workouts" value={`${tasks.length || 3} / 5`} progress={60} />
            <Metric label="Active Time" value="45 / 60 min" progress={75} />
            <Metric label="Steps" value="7,842 / 10,000" progress={78} />
            <Metric label="Water" value={`${formatNumber(water / 1000 || 1.8)} / 3 L`} progress={60} />
          </div>
        </Panel>
      </div>
    </div>
  );
};

function Metric({ label, value, progress }: { label: string; value: string; progress: number }) {
  return (
    <div>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-bold text-white">{value}</span>
      </div>
      <ProgressBar value={progress} color="green" />
    </div>
  );
}
