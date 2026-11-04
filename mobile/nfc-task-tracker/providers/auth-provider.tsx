import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { AppUser } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export type AuthenticatedUser = AppUser & { role?: 'user' };

type AuthContextValue = {
  user: AuthenticatedUser | null;
  loading: boolean;
  isSubmitting: boolean;
  error: string | null;
  notice: string | null;
  login: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProfile = useCallback(async (name?: string | null) => {
    const { data, error: profileError } = await supabase
      .rpc('get_or_create_profile', { p_name: name ?? null })
      .maybeSingle();
    if (profileError) throw profileError;
    if (!data) throw new Error('Kullanıcı profili bulunamadı.');
    return { ...data, role: 'user' as const } as AuthenticatedUser;
  }, []);

  useEffect(() => {
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session || event === 'SIGNED_OUT') {
        queryClient.clear();
        setUser(null);
        setLoading(false);
        return;
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        setTimeout(() => {
          void loadProfile(session.user.user_metadata?.name)
            .then(profile => {
              if (active) {
                queryClient.clear();
                setUser(profile);
              }
            })
            .catch((profileError: unknown) => {
              if (active) {
                setUser(null);
                setError(profileError instanceof Error ? profileError.message : 'Kullanıcı profili yüklenemedi.');
              }
            })
            .finally(() => {
              if (active) setLoading(false);
            });
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile, queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      setError('Email ve şifre gereklidir.');
      throw new Error('Missing credentials');
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (authError) throw authError;
      setUser(await loadProfile(data.user.user_metadata?.name));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Giriş başarısız.';
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [loadProfile]);

  const signUp = useCallback(async (email: string, password: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError('Email ve şifre gereklidir.');
      throw new Error('Missing credentials');
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { data: { name: trimmedEmail.split('@')[0] } },
      });
      if (authError) throw authError;

      if (data.session && data.user) {
        setUser(await loadProfile(data.user.user_metadata?.name));
      } else {
        setNotice('Kayıt başarılı. Giriş yapmadan önce e-posta adresini doğrula.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Kayıt başarısız.';
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [loadProfile]);

  const logout = useCallback(async () => {
    const { error: authError } = await supabase.auth.signOut();
    if (authError) throw authError;
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, isSubmitting, error, notice, login, signUp, logout }),
    [error, isSubmitting, loading, login, logout, notice, signUp, user]
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
