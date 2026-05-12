import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabaseConfig';

const STORAGE_KEY = '@save_wBookmark';

let _userId = null;
let _snapshotListeners = new Set();
let _subscription = null;
let _cachedRegions = null;

const toCamelCase = (dbObj) => {
  if (!dbObj) return null;
  return {
    id: dbObj.id,
    name: dbObj.name,
    address: dbObj.address,
    lat: dbObj.lat,
    lon: dbObj.lon,
    pageIndex: dbObj.page_index,
    order: dbObj.sort_order,
    inactive: dbObj.inactive,
    createdAt: dbObj.created_at,
    updatedAt: dbObj.updated_at,
    ownerId: dbObj.owner_uid,
  };
};

const toDbObj = (appObj) => {
  const dbObj = {};
  if (appObj.id !== undefined) dbObj.id = appObj.id;
  if (appObj.name !== undefined) dbObj.name = appObj.name;
  if (appObj.address !== undefined) dbObj.address = appObj.address;
  if (appObj.lat !== undefined) dbObj.lat = appObj.lat;
  if (appObj.lon !== undefined) dbObj.lon = appObj.lon;
  if (appObj.pageIndex !== undefined) dbObj.page_index = appObj.pageIndex;
  if (appObj.order !== undefined) dbObj.sort_order = appObj.order;
  if (appObj.inactive !== undefined) dbObj.inactive = appObj.inactive;
  if (appObj.ownerId !== undefined) dbObj.owner_uid = appObj.ownerId;
  return dbObj;
};

const _startSubscription = async (uid) => {
  if (_subscription) {
    supabase.removeChannel(_subscription);
    _subscription = null;
  }

  const fetchInitial = async () => {
    const { data, error } = await supabase
      .from('regions')
      .select('*')
      .eq('owner_uid', uid)
      .order('sort_order', { ascending: true });

    if (error) {
      console.warn('[RegionSync] fetch error:', error);
      return;
    }

    let regions = (data || []).map(toCamelCase);

    // Migrate AsyncStorage regions to Supabase on first sign-in with a uid
    if (regions.length === 0) {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json) {
          const local = JSON.parse(json);
          if (Array.isArray(local) && local.length > 0) {
            const dbArr = local.map((r, i) => toDbObj({ ...r, order: i, ownerId: uid }));
            const { error: upsertErr } = await supabase.from('regions').upsert(dbArr, { onConflict: 'id' });
            if (!upsertErr) {
              await AsyncStorage.removeItem(STORAGE_KEY);
              regions = local.map((r, i) => ({ ...r, order: i, ownerId: uid }));
            }
          }
        }
      } catch (e) {
        console.warn('[RegionSync] AsyncStorage migration error:', e);
      }
    }

    _cachedRegions = regions;
    _snapshotListeners.forEach((cb) => cb(regions));
  };

  await fetchInitial();

  _subscription = supabase
    .channel(`public:regions:owner_uid=eq.${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'regions', filter: `owner_uid=eq.${uid}` }, async (payload) => {
      await fetchInitial();
    })
    .subscribe();
};

export const initRegionSync = async (uid) => {
  if (_userId === uid && uid !== null) {
    // Same user (e.g. token refresh re-triggering setupUser) — keep cache intact
    return;
  }
  _userId = uid;
  _cachedRegions = null;

  if (uid) {
    _startSubscription(uid);
  } else {
    if (_subscription) {
      supabase.removeChannel(_subscription);
      _subscription = null;
    }
    _cachedRegions = null;
    _snapshotListeners.forEach((cb) => cb(null));
  }
};

export const subscribeToRegions = (callback) => {
  _snapshotListeners.add(callback);
  if (_cachedRegions !== null) callback(_cachedRegions);
  return () => _snapshotListeners.delete(callback);
};

export const getBookmarkedRegions = async () => {
  if (_userId) {
    if (_cachedRegions !== null) return _cachedRegions;
    try {
      const { data, error } = await supabase
        .from('regions')
        .select('*')
        .eq('owner_uid', _userId)
        .order('sort_order', { ascending: true });
      if (!error) {
        const regions = (data || []).map(toCamelCase);
        _cachedRegions = regions;
        return regions;
      }
    } catch (e) {
      console.warn('[RegionSync] getBookmarkedRegions error:', e);
    }
  }
  
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const regions = JSON.parse(json);
    return regions.map((r) => ({ ...r, name: r.name.replace(/^\[[A-Z]{2}\]\s*/, '') }));
  } catch (e) {
    return [];
  }
};

export const saveBookmarkedRegions = async (regions) => {
  const arr = Array.isArray(regions) ? regions : [];
  if (_userId) {
    try {
      const newIds = new Set(arr.map(r => r.id));
      const toDelete = (_cachedRegions || []).filter(r => !newIds.has(r.id)).map(r => r.id);

      // Optimistic cache update so useFocusEffect re-fetch sees new data immediately
      _cachedRegions = arr;
      _snapshotListeners.forEach(cb => cb(arr));

      const dbArr = arr.map((r, i) => toDbObj({ ...r, order: i, ownerId: _userId }));
      if (dbArr.length > 0) {
        const { error } = await supabase.from('regions').upsert(dbArr, { onConflict: 'id' });
        if (error) console.warn('[RegionSync] saveBookmarkedRegions upsert error:', error);
      }
      if (toDelete.length > 0) {
        await supabase.from('regions').delete().in('id', toDelete);
      }
      return;
    } catch (e) {
      console.warn('[RegionSync] saveBookmarkedRegions error:', e);
    }
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {}
};

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

export const removeRegion = async (id) => {
  const regions = await getBookmarkedRegions();
  const updated = regions.filter((r) => r.id !== id);
  await saveBookmarkedRegions(updated);
  return updated;
};

export const applyRegionFreeLimit = async (limit) => {
  const regions = await getBookmarkedRegions();
  const updated = regions.map((r, i) => ({ ...r, inactive: i >= limit }));
  await saveBookmarkedRegions(updated);
  return updated;
};

export const restoreAllRegions = async () => {
  const regions = await getBookmarkedRegions();
  const updated = regions.map((r) => ({ ...r, inactive: false }));
  await saveBookmarkedRegions(updated);
  return updated;
};
