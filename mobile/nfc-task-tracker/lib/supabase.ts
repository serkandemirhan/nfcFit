import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';

import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('Missing Supabase env vars; check EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY');
}

const storage = Platform.OS === 'web' ? undefined : (AsyncStorage as any);

export const supabase = createClient(url ?? '', key ?? '', {
  auth: {
    ...(storage ? { storage } : {}),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
