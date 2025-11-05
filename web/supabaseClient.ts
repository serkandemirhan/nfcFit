import { createClient } from '@supabase/supabase-js';

// BURADAKİ BİLGİLERİ KENDİ SUPABASE PROJENİZDEN ALDIĞINIZ BİLGİLERLE DEĞİŞTİRİN
const supabaseUrl = 'https://your-project-id.supabase.co';
const supabaseAnonKey = 'your-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);