import React, { FC, useState } from 'react';
import { User } from '../types';
import { Panel } from '../components/web-ui';

type AccountPageProps = {
  user: User;
  onLogout: () => Promise<void>;
};

export const ProfilePage: FC<AccountPageProps> = ({ user, onLogout }) => {
  const [error, setError] = useState('');
  const logout = async () => {
    setError('');
    try {
      await onLogout();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Could not log out.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Profile</h1>
        <p className="mt-1 text-sm text-slate-400">Account information associated with your NFCFit sign-in.</p>
      </div>
      <Panel className="max-w-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-green-500/20 text-xl font-black text-green-200">
            {user.name.trim().charAt(0).toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-black text-white">{user.name}</h2>
            <p className="truncate text-sm text-slate-400">{user.email ?? 'No email on file'}</p>
          </div>
        </div>
        <dl className="mt-6 grid gap-4 border-t border-white/10 pt-5 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Name</dt>
            <dd className="mt-1 font-semibold text-white">{user.name}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Email</dt>
            <dd className="mt-1 break-all font-semibold text-white">{user.email ?? 'Not provided'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Username</dt>
            <dd className="mt-1 font-semibold text-white">{user.username ?? 'Not set'}</dd>
          </div>
        </dl>
        {error && <p role="alert" className="mt-5 rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        <button type="button" onClick={logout} className="mt-6 rounded-xl bg-red-500 px-4 py-2 text-sm font-black text-white hover:bg-red-400">
          Log out
        </button>
      </Panel>
    </div>
  );
};

export const SettingsPage: FC<AccountPageProps> = ({ user, onLogout }) => {
  const [error, setError] = useState('');
  const logout = async () => {
    setError('');
    try {
      await onLogout();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : 'Could not log out.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">Manage the preferences available in this web app.</p>
      </div>
      <Panel className="max-w-2xl divide-y divide-white/10">
        <section className="p-5">
          <h2 className="font-black text-white">Display preferences</h2>
          <p className="mt-1 text-sm text-slate-400">Theme and notification preferences are not available in the web app yet.</p>
        </section>
        <section className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="font-black text-white">Account</h2>
            <p className="mt-1 break-all text-sm text-slate-400">{user.email ?? user.name}</p>
          </div>
          <button type="button" onClick={logout} className="rounded-xl border border-red-400/30 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-400/10">
            Log out
          </button>
          {error && <p role="alert" className="w-full rounded-lg border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
        </section>
      </Panel>
    </div>
  );
};
