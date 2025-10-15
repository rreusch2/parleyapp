import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const extra = (Constants?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra) || {};
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || (extra as any).supabaseUrl || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || (extra as any).supabaseAnonKey || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing. Make sure they are set in your .env file with EXPO_PUBLIC_ prefix.");
}

try {
  if (supabaseUrl && supabaseAnonKey) {
    const host = new URL(supabaseUrl).host;
    console.log(`[Supabase] Initialized (host: ${host})`);
  }
} catch {}

const isBrowser = typeof window !== 'undefined';
const memoryStorage = {
  getItem: async (_key: string) => null as string | null,
  setItem: async (_key: string, _value: string) => {},
  removeItem: async (_key: string) => {},
};
const webStorage = isBrowser
  ? {
      getItem: async (key: string) => window.localStorage.getItem(key),
      setItem: async (key: string, value: string) => {
        window.localStorage.setItem(key, value);
      },
      removeItem: async (key: string) => {
        window.localStorage.removeItem(key);
      },
    }
  : memoryStorage;
const isNative = Platform.OS === 'ios' || Platform.OS === 'android';
const storageAdapter = isNative ? AsyncStorage : webStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storageAdapter,
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