import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const extra = (Constants?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra) || {};
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || (extra as any).supabaseUrl || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || (extra as any).supabaseAnonKey || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing. Make sure they are set in your .env file with EXPO_PUBLIC_ prefix.");
  // You might want to throw an error here or handle it differently,
  // but for now, we'll log an error and proceed, which will likely fail later.
}

try {
  if (supabaseUrl && supabaseAnonKey) {
    const host = new URL(supabaseUrl).host;
    console.log(`[Supabase] Initialized (host: ${host})`);
  }
} catch {
  // noop
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const supabaseConfig = {
  isConfigured: Boolean(supabaseUrl && supabaseAnonKey),
};

export default supabase;

// You might also want to export the types if you use them frequently
// export type { Session, User } from '@supabase/supabase-js';