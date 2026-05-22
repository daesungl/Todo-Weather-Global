import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabaseConfig';
import { deleteAccount } from './supabase/PlanApiService';

const accountCacheKeys = (uid) => [
  '@tasks_v1',
  `@tasks_v1_${uid}`,
  '@tasks_pending_deletes_v1',
  `@tasks_pending_deletes_v1_${uid}`,
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

  // Auth 계정 삭제는 service role이 필요한 작업이라 Edge Function에서 데이터 정리와 함께 처리한다.
  await deleteAccount();

  // 로컬 캐시 삭제
  await clearLocalAccountCaches(uid);

  await supabase.auth.signOut();
};
