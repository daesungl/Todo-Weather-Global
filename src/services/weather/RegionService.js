import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@save_wBookmark';

/**
 * 관심 지역 리스트를 불러옵니다.
 * 데이터 구조: [{ id, name, address, lat, lon }, ...]
 */
export const getBookmarkedRegions = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(STORAGE_KEY);
    if (jsonValue == null) return [];
    const regions = JSON.parse(jsonValue);
    // 기존 저장 데이터의 국가코드 접두어 제거 ([KR], [US] 등)
    return regions.map(r => ({ ...r, name: r.name.replace(/^\[[A-Z]{2}\]\s*/, '') }));
  } catch (e) {
    console.error('Failed to load bookmarks', e);
    return [];
  }
};

/**
 * 관심 지역 리스트를 저장합니다.
 */
export const saveBookmarkedRegions = async (regions) => {
  try {
    const jsonValue = JSON.stringify(regions);
    await AsyncStorage.setItem(STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save bookmarks', e);
  }
};

/**
 * 새로운 관심 지역을 추가합니다.
 */
export const addRegion = async (name, address, lat, lon, pageIndex = 0) => {
  const regions = await getBookmarkedRegions();
  const newRegion = {
    id: Date.now().toString(),
    name,
    address,
    lat,
    lon,
    pageIndex,
  };
  const updated = [...regions, newRegion];
  await saveBookmarkedRegions(updated);
  return updated;
};

/**
 * 무료 한도 초과분을 비활성화합니다. 기존 순서 기준, 뒤쪽(최신)부터 잠금.
 */
export const applyRegionFreeLimit = async (limit) => {
  try {
    const regions = await getBookmarkedRegions();
    const updated = regions.map((r, i) => ({ ...r, inactive: i >= limit }));
    await saveBookmarkedRegions(updated);
    return updated;
  } catch (e) {
    console.error('Failed to apply region limit', e);
    return [];
  }
};

/**
 * 비활성화된 지역을 모두 복원합니다.
 */
export const restoreAllRegions = async () => {
  try {
    const regions = await getBookmarkedRegions();
    const updated = regions.map(r => ({ ...r, inactive: false }));
    await saveBookmarkedRegions(updated);
    return updated;
  } catch (e) {
    console.error('Failed to restore regions', e);
    return [];
  }
};

/**
 * 특정 관심 지역을 삭제합니다.
 */
export const removeRegion = async (id) => {
  const regions = await getBookmarkedRegions();
  const updated = regions.filter(r => r.id !== id);
  await saveBookmarkedRegions(updated);
  return updated;
};
