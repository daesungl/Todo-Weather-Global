import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  launchCount:    '@review_launch_count',
  completeCount:  '@review_complete_count',
  lastAsked:      '@review_last_asked',
};

const MIN_LAUNCHES   = 5;
const MIN_COMPLETES  = 3;
const COOLDOWN_DAYS  = 30;

const getInt = async (key) => parseInt((await AsyncStorage.getItem(key)) || '0', 10);

export const incrementLaunchCount = async () => {
  const n = await getInt(KEYS.launchCount);
  await AsyncStorage.setItem(KEYS.launchCount, String(n + 1));
};

// 태스크 완료 후 호출 — 조건 충족 시 리뷰 요청
export const onTaskCompleted = async () => {
  try {
    const n = await getInt(KEYS.completeCount);
    await AsyncStorage.setItem(KEYS.completeCount, String(n + 1));

    if (!(await StoreReview.isAvailableAsync())) return;

    const launches  = await getInt(KEYS.launchCount);
    const completes = n + 1;
    const lastAsked = parseInt((await AsyncStorage.getItem(KEYS.lastAsked)) || '0', 10);
    const daysSince = (Date.now() - lastAsked) / (1000 * 60 * 60 * 24);

    if (launches < MIN_LAUNCHES)  return;
    if (completes < MIN_COMPLETES) return;
    if (lastAsked && daysSince < COOLDOWN_DAYS) return;

    await AsyncStorage.setItem(KEYS.lastAsked, String(Date.now()));
    await StoreReview.requestReview();
  } catch {}
};
