import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabaseConfig';
import { listPlans, deletePlan, leavePlan } from './supabase/PlanApiService';

const accountCacheKeys = (uid) => [
  '@tasks_v1',
  '@save_wBookmark',
  '@todo_weather_flows',
  `@todo_weather_flows_${uid}`,
  `@todo_weather_shared_flows_${uid}`,
  `@flows_global_schema_migrated_${uid}`,
  `@tasks_migrated_${uid}`,
  `@regions_migrated_${uid}`,
];

const clearLocalAccountCaches = async (uid) => {
  try {
    await AsyncStorage.multiRemove(accountCacheKeys(uid));
  } catch (error) {
    console.warn('[AccountDeletion] Failed to clear local caches:', error);
  }
};

export const isRecentLoginRequired = (error) =>
  error?.code === 'auth/requires-recent-login'
  || String(error?.message || '').includes('requires-recent-login');

export const deleteCurrentUserAccount = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) throw new Error('No authenticated user');

  const uid = session.user.id;

  // 플랜 삭제 (owner) 또는 탈퇴 (member)
  try {
    const plans = await listPlans();
    await Promise.allSettled(
      plans.map(plan =>
        plan.role === 'owner' ? deletePlan(plan.id) : leavePlan(plan.id)
      )
    );
  } catch (e) {
    console.warn('[AccountDeletion] Failed to delete/leave plans:', e);
  }

  // 프로필 삭제
  try {
    await supabase.from('profiles').delete().eq('uid', uid);
  } catch (e) {
    console.warn('[AccountDeletion] Failed to delete profile:', e);
  }

  // 로컬 캐시 삭제
  await clearLocalAccountCaches(uid);

  // 로그아웃 (Supabase auth user 삭제는 admin API 필요 — 추후 Edge Function으로 처리)
  await supabase.auth.signOut();
};
