export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = () =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const shouldUseSupabasePlans = () =>
  isSupabaseConfigured() && process.env.EXPO_PUBLIC_PLAN_BACKEND === 'supabase';
