import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { AppUser } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export type AuthenticatedUser = AppUser & { role?: 'user' };

type AuthContextValue = {
  user: AuthenticatedUser | null;
  loading: boolean;
  isSubmitting: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  quickLogin: (type?: 'first-user') => Promise<void>;
  logout: () => Promise<void>;
};

const SINGLE_USER_ID = 'u1';

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const fallbackUser: AuthenticatedUser = {
  id: SINGLE_USER_ID,
  name: 'Serkan',
  username: 'serkan',
  email: 'serkan@example.com',
  avatarurl: 'https://i.pravatar.cc/150?u=serkan',
  role: 'user',
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(false);
    };
    void bootstrap();
  }, []);

  const persistUser = useCallback(async (value: AuthenticatedUser | null) => {
    if (value) await AsyncStorage.setItem('nfcfit.single-user', JSON.stringify(value));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Email ve şifre gereklidir.');
      throw new Error('Missing credentials');
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('email', trimmedEmail)
        .maybeSingle();

      if (fetchError || !data) {
        throw new Error('Kullanıcı bulunamadı.');
      }

      if (trimmedPassword !== (data.passwordhash ?? '1234')) {
        throw new Error('Şifre hatalı.');
      }

      const normalized: AuthenticatedUser = { ...(data ?? fallbackUser), role: 'user' };
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

  const quickLogin = useCallback(async () => {
    const { data } = await supabase.from('users').select('*').eq('id', SINGLE_USER_ID).maybeSingle();
    const normalized: AuthenticatedUser = { ...(data ?? fallbackUser), role: 'user' };
    setUser(normalized);
    await persistUser(normalized);
  }, [persistUser]);

  const logout = useCallback(async () => {
    setUser(null);
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
