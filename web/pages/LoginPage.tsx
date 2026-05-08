import React, { FC, useState } from 'react';
import { User } from '../types';
import { BrandMark, BrowserFrame } from '../components/web-ui';

type LoggedInUser = User | { id: 'admin'; name: 'Admin'; avatarUrl: string };

export const LoginPage: FC<{ onLoginSuccess: (user: LoggedInUser) => void; users: User[] }> = ({ onLoginSuccess, users }) => {
  const [email, setEmail] = useState('serkan@example.com');
  const [password, setPassword] = useState('1234');
  const [error, setError] = useState('');

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const user = users.find(item => item.email === email || item.username === email) ?? users[0];
    if (user && password.length > 0) {
      onLoginSuccess(user);
      return;
    }
    setError('Email veya sifre hatali.');
  };

  return (
    <div className="min-h-screen bg-[#020b14] px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 text-center">
          <h1 className="text-5xl font-black tracking-tight">
            NFCFit <span className="text-green-400">MVP</span> <span className="text-sky-400">Web UI</span>
          </h1>
          <p className="mt-3 text-sm text-slate-300">Fitness • Wellness • Health • NFC Powered • Habit Tracking</p>
        </div>

        <BrowserFrame>
          <div className="grid min-h-[520px] grid-cols-1 md:grid-cols-[1.1fr_0.9fr]">
            <div className="relative overflow-hidden border-b border-white/10 bg-[#061523] p-8 md:border-b-0 md:border-r">
              <div className="absolute inset-0 opacity-50" style={{ background: 'radial-gradient(circle at 35% 45%, rgba(34,197,94,0.24), transparent 28%), radial-gradient(circle at 15% 80%, rgba(14,165,233,0.18), transparent 26%)' }} />
              <div className="relative flex h-full flex-col items-center justify-center text-center">
                <BrandMark />
                <p className="mt-5 text-lg font-bold">Tap. Track. Improve.</p>
                <p className="mt-3 max-w-xs text-sm leading-6 text-slate-300">
                  Track your workouts, habits and wellness with a tap.
                </p>
                <div className="relative mt-10 grid h-36 w-36 place-items-center rounded-full border border-green-400/20 bg-green-400/10">
                  <div className="absolute h-28 w-28 rounded-full border border-green-400/30" />
                  <div className="grid h-20 w-20 place-items-center rounded-full bg-green-500 text-3xl font-black shadow-xl shadow-green-500/30">N</div>
                </div>
                <div className="mt-10 grid w-full max-w-lg grid-cols-2 gap-3 text-left">
                  {['NFC Powered', 'Habit Tracking', 'Fitness Goals', 'Wellness Logs'].map(item => (
                    <div key={item} className="rounded-xl border border-white/10 bg-white/[0.045] p-3">
                      <p className="text-sm font-bold text-white">{item}</p>
                      <p className="mt-1 text-xs text-slate-400">Simple daily tracking</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <form onSubmit={handleLogin} className="flex flex-col justify-center p-8">
              <div className="mx-auto w-full max-w-sm">
                <h2 className="text-2xl font-black">Welcome back</h2>
                <p className="mt-1 text-sm text-slate-400">Log in to your NFCFit account</p>

                <label className="mt-8 block text-xs font-semibold text-slate-300">Email</label>
                <input
                  value={email}
                  onChange={event => setEmail(event.target.value)}
                  type="email"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none focus:border-green-400"
                  placeholder="you@example.com"
                />

                <label className="mt-5 block text-xs font-semibold text-slate-300">Password</label>
                <input
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  type="password"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none focus:border-green-400"
                  placeholder="Enter your password"
                />

                <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                  <label className="flex items-center gap-2"><input type="checkbox" className="accent-green-500" /> Remember me</label>
                  <button type="button" className="text-sky-300">Forgot password?</button>
                </div>

                {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

                <button className="mt-6 w-full rounded-xl bg-green-500 py-3 text-sm font-black text-[#04120a] transition hover:bg-green-400">
                  Log In
                </button>
              </div>
            </form>
          </div>
        </BrowserFrame>
      </div>
    </div>
  );
};
