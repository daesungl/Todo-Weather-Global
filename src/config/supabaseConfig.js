import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import {
  SUPABASE_CONFIG_ANON_KEY,
  SUPABASE_CONFIG_URL,
} from '../constants/SupabaseEnv';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_CONFIG_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_CONFIG_ANON_KEY || '';

export const isSupabaseConfigured = () =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

// Supabase가 설정되어 있으면 항상 Supabase 경로 사용 (Firebase 이전 완료)
export const shouldUseSupabasePlans = isSupabaseConfigured;

export const supabase = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Tells Supabase Auth to continuously refresh the session automatically if
// the app is in the foreground. When this is added, you will continue to receive
// `onAuthStateChange` events with the `TOKEN_REFRESHED` or `SIGNED_OUT` event
// if the user's session is terminated. This should only be registered once.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase?.auth.startAutoRefresh();
  } else {
    supabase?.auth.stopAutoRefresh();
  }
});
