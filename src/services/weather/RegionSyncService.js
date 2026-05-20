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
  dbObj.page_index = Number.isFinite(Number(appObj.pageIndex)) ? Number(appObj.pageIndex) : 0;
  dbObj.sort_order = Number.isFinite(Number(appObj.order)) ? Number(appObj.order) : 0;
  dbObj.inactive = appObj.inactive === true;
  if (appObj.ownerId !== undefined) dbObj.owner_uid = appObj.ownerId;
  return dbObj;
};

const normalizeRegion = (region, index = 0, ownerId = _userId) => ({
  ...region,
  id: String(region?.id || `${Date.now()}_${index}`),
  name: String(region?.name || '').trim(),
  address: region?.address || '',
  lat: region?.lat ?? null,
  lon: region?.lon ?? null,
  pageIndex: Number.isFinite(Number(region?.pageIndex)) ? Number(region.pageIndex) : Math.floor(index / 3),
  order: Number.isFinite(Number(region?.order)) ? Number(region.order) : index,
  inactive: region?.inactive === true,
  ownerId: ownerId || region?.ownerId,
});

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
  const arr = (Array.isArray(regions) ? regions : [])
    .map((region, index) => normalizeRegion(region, index))
    .filter(region => region.name);
  if (_userId) {
    const previousRegions = Array.isArray(_cachedRegions) ? _cachedRegions : [];
    const newIds = new Set(arr.map(r => r.id));
    const toDelete = previousRegions.filter(r => !newIds.has(r.id)).map(r => r.id);

    try {
      const dbArr = arr.map((r, i) => toDbObj({ ...r, order: i, ownerId: _userId }));
      if (dbArr.length > 0) {
        const { error } = await supabase.from('regions').upsert(dbArr, { onConflict: 'id' });
        if (error) throw error;
      }
      if (toDelete.length > 0) {
        const { error } = await supabase.from('regions').delete().in('id', toDelete);
        if (error) throw error;
      }

      _cachedRegions = arr;
      _snapshotListeners.forEach(cb => cb(arr));
      return arr;
    } catch (e) {
      console.warn('[RegionSync] saveBookmarkedRegions error:', e);
      throw e;
    }
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    return arr;
  } catch (e) {
    console.warn('[RegionSync] AsyncStorage save error:', e);
    throw e;
  }
};

export const clearBookmarkedRegions = async () => {
  if (_userId) {
    const { error } = await supabase
      .from('regions')
      .delete()
      .eq('owner_uid', _userId);
    if (error) {
      console.warn('[RegionSync] clearBookmarkedRegions error:', error);
      throw error;
    }
  }

  await AsyncStorage.removeItem(STORAGE_KEY);
  _cachedRegions = [];
  _snapshotListeners.forEach(cb => cb([]));
  return [];
};

export const addRegion = async (name, address, lat, lon, pageIndex = 0) => {
  const regions = await getBookmarkedRegions();
  const newRegion = {
    id: Date.now().toString(),
    name: String(name || '').trim(),
    address: address || '',
    lat: lat ?? null,
    lon: lon ?? null,
    pageIndex: Number.isFinite(Number(pageIndex)) ? Number(pageIndex) : 0,
    order: regions.length,
    inactive: false,
    ownerId: _userId || undefined,
  };
  if (!newRegion.name) throw new Error('REGION_NAME_REQUIRED');
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
