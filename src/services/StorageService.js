import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = '@weather_cache_';
const DEFAULT_EXPIRY = 60 * 60 * 1000; // 기상청/에어코리아 데이터 갱신 주기(1시간)에 맞춘 최적 캐시 주기

/**
 * 데이터를 캐시에 저장합니다.
 */
export const saveCache = async (key, data) => {
  try {
    const cacheData = {
      timestamp: Date.now(),
      data: data
    };
    await AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(cacheData));
  } catch (error) {
    console.error('[Storage] Save Error:', error);
  }
};

/**
 * 캐시된 데이터를 불러옵니다. 만료되었으면 null을 반환합니다.
 */
export const getCache = async (key, expiry = DEFAULT_EXPIRY) => {
  try {
    const rawData = await AsyncStorage.getItem(`${CACHE_PREFIX}${key}`);
    if (!rawData) return null;

    const cache = JSON.parse(rawData);
    const now = Date.now();

    // 만료 시간 체크
    if (now - cache.timestamp > expiry) {
      console.log(`[Storage] Cache expired for: ${key}`);
      return null;
    }

    console.log(`[Storage] HIT! Using cached data for: ${key}`);
    return cache.data;
  } catch (error) {
    console.error('[Storage] Get Error:', error);
    return null;
  }
};

/**
 * 특정 키의 캐시를 삭제합니다.
 */
export const removeCache = async (key) => {
  try {
    await AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`);
  } catch (error) {
    console.error('[Storage] Remove Error:', error);
  }
};

const StorageService = {
  saveCache,
  getCache,
  removeCache
};

export default StorageService;
