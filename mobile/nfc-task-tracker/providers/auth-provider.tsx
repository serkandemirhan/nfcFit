import { restoreOfflineProfile } from '@/lib/offline-session-core';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { offlineStore } from '@/lib/offline-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { AppUser } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export type AuthenticatedUser = AppUser & { role?: 'user'; supabaseUserId?: string };

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
  const authEpoch=useRef(0);
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadProfile = useCallback(async (name?: string | null, authId?: string) => {
    const { data, error: profileError } = await supabase
      .rpc('get_or_create_profile', { p_name: name ?? null })
      .maybeSingle();
    if (profileError) throw profileError;
    if (!data) throw new Error('Kullanıcı profili bulunamadı.');
    return { ...data, supabaseUserId: authId, role: 'user' as const } as AuthenticatedUser;
  }, []);

  useEffect(() => {
    let active=true;let generation=0;let cached:AuthenticatedUser|null=null;
    const restoreEpoch=authEpoch.current;
    const restore=(async()=>{
      cached=await restoreOfflineProfile(AsyncStorage,id=>offlineStore.getDoc<AuthenticatedUser>(id,'profile'));
      if(active&&cached&&restoreEpoch===authEpoch.current){setUser(cached);setLoading(false);}
    })().catch(()=>undefined);
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event,session)=>{
      const revision=++generation;const epoch=authEpoch.current;
      if(event==='SIGNED_OUT'){
        queryClient.clear();setUser(null);setLoading(false);void AsyncStorage.removeItem('nfcfit:last-user');return;
      }
      if(!session){void restore.finally(()=>{if(active)setLoading(false);});return;}
      if(event==='INITIAL_SESSION'||event==='SIGNED_IN')setTimeout(()=>{
        void (async()=>{
          await restore;
          if(await AsyncStorage.getItem('nfcfit:explicit-logout')==='true')return;
          try{
            const profile=await loadProfile(session.user.user_metadata?.name,session.user.id);
            if(!active||revision!==generation||epoch!==authEpoch.current||await AsyncStorage.getItem('nfcfit:explicit-logout')==='true')return;
            await offlineStore.putDoc(profile.id,'profile',profile);
            await AsyncStorage.setItem('nfcfit:last-user',profile.id);
            await AsyncStorage.setItem(`nfcfit:auth-owner:${profile.id}`,session.user.id);
            if(active&&epoch===authEpoch.current)setUser(profile);
          }catch(profileError){
            if(active&&revision===generation&&epoch===authEpoch.current){
              if(cached?.supabaseUserId===session.user.id)setUser(cached);
              else{setUser(null);setError(profileError instanceof Error?profileError.message:'Kullanıcı profili yüklenemedi.');}
            }
          }finally{if(active&&revision===generation)setLoading(false);}
        })();
      },0);
    });
    return()=>{active=false;generation++;subscription.unsubscribe();};
  },[loadProfile,queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    authEpoch.current++;
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
      const profile=await loadProfile(data.user.user_metadata?.name,data.user.id);
      await offlineStore.putDoc(profile.id,'profile',profile);
      await AsyncStorage.removeItem('nfcfit:explicit-logout');
      await AsyncStorage.setItem('nfcfit:last-user',profile.id);
      await AsyncStorage.setItem(`nfcfit:auth-owner:${profile.id}`,data.user.id);
      queryClient.clear();setUser(profile);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Giriş başarısız.';
      setError(message);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [loadProfile,queryClient]);

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
        const profile=await loadProfile(data.user.user_metadata?.name,data.user.id);
        await offlineStore.putDoc(profile.id,'profile',profile);
        await AsyncStorage.removeItem('nfcfit:explicit-logout');
        await AsyncStorage.setItem('nfcfit:last-user',profile.id);
      await AsyncStorage.setItem(`nfcfit:auth-owner:${profile.id}`,data.user.id);
        queryClient.clear();setUser(profile);
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
  }, [loadProfile,queryClient]);

  const logout = useCallback(async () => {
    authEpoch.current++;
    await AsyncStorage.setItem('nfcfit:explicit-logout','true');
    await AsyncStorage.removeItem('nfcfit:last-user');
    queryClient.clear();setUser(null);setError(null);setNotice(null);
    await supabase.auth.signOut({scope:'local'}).catch(()=>undefined);
  },[queryClient]);

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
