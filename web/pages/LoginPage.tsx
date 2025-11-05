import React, { FC, useState } from 'react';
import { useTranslation } from '../i18n/context';
import { User } from '../types';

type LoggedInUser = User | { id: 'admin'; name: 'Admin'; avatarUrl: string };

export const LoginPage: FC<{ onLoginSuccess: (user: LoggedInUser) => void, users: User[] }> = ({ onLoginSuccess, users }) => {
    const { t } = useTranslation();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (username === 'admin' && password === '123456') {
            onLoginSuccess({ id: 'admin', name: 'Admin', avatarUrl: 'https://i.imgur.com/k73bB6w.png' });
            return;
        }

        const foundUser = users.find(u => u.username === username);
        if (foundUser && password === '123456') { // NOTE: Insecure, for demo only
            onLoginSuccess(foundUser);
            return;
        }

        setError('Kullanıcı adı veya şifre hatalı.');
    };

    const handleQuickLogin = (userType: 'admin' | 'user') => {
        if (userType === 'admin') {
            onLoginSuccess({ id: 'admin', name: 'Admin', avatarUrl: 'https://i.imgur.com/k73bB6w.png' });
        } else {
            const testUser = users.find(u => u.username !== 'admin');
            if (testUser) {
                onLoginSuccess(testUser);
            } else {
                setError('Test kullanıcısı bulunamadı.');
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md">
                <form onSubmit={handleLogin} className="bg-gray-800 shadow-2xl rounded-lg px-8 pt-6 pb-8 mb-4">
                    <div className="mb-6 text-center">
                         <div className="inline-flex items-center justify-center space-x-3 mb-4">
                            <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                            <h1 className="text-white text-2xl font-bold">{t('app.title')}</h1>
                        </div>
                    </div>
                    <div className="mb-4">
                        <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="username">{t('login.username')}</label>
                        <input className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" id="username" type="text" placeholder={t('login.usernamePlaceholder')} autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-300 text-sm font-bold mb-2" htmlFor="password">{t('login.password')}</label>
                        <input className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" id="password" type="password" placeholder="******************" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    {error && <p className="text-red-500 text-xs italic mb-4 text-center">{error}</p>}
                    <div className="flex items-center justify-between"><button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors" type="submit">{t('login.submit')}</button></div>
                    <div className="relative flex pt-8 pb-4 items-center"><div className="flex-grow border-t border-gray-700"></div><span className="flex-shrink mx-4 text-gray-500 text-xs">{t('login.quickLogin')}</span><div className="flex-grow border-t border-gray-700"></div></div>
                     <div className="flex items-center justify-center space-x-2">
                         <button type="button" onClick={() => handleQuickLogin('user')} className="w-full bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors text-sm">{t('login.asUser')}</button>
                         <button type="button" onClick={() => handleQuickLogin('admin')} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold py-2 px-4 rounded-lg focus:outline-none focus:shadow-outline transition-colors text-sm">{t('login.asAdmin')}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};