import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { AppUser } from '@/lib/api';
import { supabase } from '@/lib/supabase';

type AdminUser = {
  id: 'admin';
  name: string;
  avatarurl?: string | null;
  role: 'admin';
};

export type AuthenticatedUser = (AppUser & { role?: 'user' }) | AdminUser;

type AuthContextValue = {
  user: AuthenticatedUser | null;
  loading: boolean;
  isSubmitting: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  quickLogin: (type: 'admin' | 'first-user') => Promise<void>;
  logout: () => Promise<void>;
};

const STORAGE_KEY = 'nfc-task-tracker.auth.user';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const adminUser: AdminUser = {
  id: 'admin',
  name: 'Admin',
  avatarurl: 'https://i.imgur.com/k73bB6w.png',
  role: 'admin',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setUser(JSON.parse(stored));
        }
      } finally {
        setLoading(false);
      }
    };
    void bootstrap();
  }, []);

  const persistUser = useCallback(async (value: AuthenticatedUser | null) => {
    if (value) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();

    if (!trimmedUsername || !trimmedPassword) {
      setError('Kullanıcı adı ve şifre gereklidir.');
      throw new Error('Missing credentials');
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (trimmedUsername.toLowerCase() === 'admin' && trimmedPassword === '123456') {
        setUser(adminUser);
        await persistUser(adminUser);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('username', trimmedUsername)
        .maybeSingle();

      if (fetchError || !data) {
        throw new Error('Kullanıcı bulunamadı.');
      }

      if (trimmedPassword !== '123456') {
        throw new Error('Şifre hatalı.');
      }

      const normalized: AuthenticatedUser = { ...data, role: 'user' };
      setUser(normalized);
      await persistUser(normalized);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Giriş başarısız.';
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [persistUser]);

  const quickLogin = useCallback(async (type: 'admin' | 'first-user') => {
    if (type === 'admin') {
      setUser(adminUser);
      await persistUser(adminUser);
      return;
    }

    const { data } = await supabase.from('users').select('*').limit(1).maybeSingle();

    if (data) {
      const normalized: AuthenticatedUser = { ...data, role: 'user' };
      setUser(normalized);
      await persistUser(normalized);
    } else {
      setError('Test kullanıcısı bulunamadı.');
    }
  }, [persistUser]);

  const logout = useCallback(async () => {
    setUser(null);
    await persistUser(null);
  }, [persistUser]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isSubmitting, error, login, logout, quickLogin }),
    [error, isSubmitting, loading, login, logout, quickLogin, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return ctx;
}
