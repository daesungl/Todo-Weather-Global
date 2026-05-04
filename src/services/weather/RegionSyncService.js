import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

const STORAGE_KEY = '@save_wBookmark';
const MIGRATION_KEY_PREFIX = '@regions_migrated_';

let _userId = null;
let _snapshotListeners = new Set();
let _unsubscribeFirestore = null;
let _cachedRegions = null;

// ─── Internal Firestore helpers ───────────────────────────────────────────────

const _regionsCollection = (uid) =>
  firestore().collection('users').doc(uid).collection('regions');

const _docToRegion = (doc) => ({ id: doc.id, ...doc.data() });

const _regionsFromSnapshot = (snapshot) =>
  snapshot.docs
    .map(_docToRegion)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const _saveToFirestore = async (uid, regions) => {
  const batch = firestore().batch();
  const col = _regionsCollection(uid);

  regions.forEach((region, index) => {
    const { id, ...data } = region;
    batch.set(col.doc(id), { ...data, order: index, ownerId: uid });
  });

  const newIds = new Set(regions.map((r) => r.id));
  (_cachedRegions || [])
    .filter((r) => !newIds.has(r.id))
    .forEach((r) => batch.delete(col.doc(r.id)));

  await batch.commit();
};

// ─── One-time migration: AsyncStorage → Firestore ────────────────────────────

const _migrateIfNeeded = async (uid) => {
  try {
    const migrationKey = `${MIGRATION_KEY_PREFIX}${uid}`;
    const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
    if (alreadyMigrated) return;

    const localJson = await AsyncStorage.getItem(STORAGE_KEY);
    const localRegions = localJson ? JSON.parse(localJson) : [];

    if (localRegions.length > 0) {
      const snapshot = await _regionsCollection(uid).limit(1).get();
      if (snapshot.empty) {
        await _saveToFirestore(uid, localRegions);
      }
    }

    await AsyncStorage.setItem(migrationKey, '1');
  } catch (e) {
    console.warn('[RegionSync] Migration error:', e);
  }
};

// ─── Snapshot subscription ────────────────────────────────────────────────────

const _startFirestoreSubscription = (uid) => {
  if (_unsubscribeFirestore) {
    _unsubscribeFirestore();
    _unsubscribeFirestore = null;
  }

  _unsubscribeFirestore = _regionsCollection(uid)
    .orderBy('order', 'asc')
    .onSnapshot(
      (snapshot) => {
        const regions = _regionsFromSnapshot(snapshot);
        _cachedRegions = regions;
        _snapshotListeners.forEach((cb) => cb(regions));
      },
      (error) => {
        console.warn('[RegionSync] Firestore snapshot error:', error);
      }
    );
};

// ─── Public lifecycle API ─────────────────────────────────────────────────────

export const initRegionSync = async (uid) => {
  _userId = uid;
  _cachedRegions = null;

  if (uid) {
    await _migrateIfNeeded(uid);
    _startFirestoreSubscription(uid);
  } else {
    if (_unsubscribeFirestore) {
      _unsubscribeFirestore();
      _unsubscribeFirestore = null;
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

// ─── RegionService-compatible API ────────────────────────────────────────────

export const getBookmarkedRegions = async () => {
  if (_userId) {
    try {
      if (_cachedRegions !== null) return _cachedRegions;
      const snapshot = await _regionsCollection(_userId).orderBy('order', 'asc').get();
      const regions = _regionsFromSnapshot(snapshot);
      _cachedRegions = regions;
      return regions;
    } catch (e) {
      console.warn('[RegionSync] getBookmarkedRegions Firestore error, falling back:', e);
    }
  }
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    if (!json) return [];
    const regions = JSON.parse(json);
    return regions.map((r) => ({ ...r, name: r.name.replace(/^\[[A-Z]{2}\]\s*/, '') }));
  } catch (e) {
    console.error('[RegionSync] getBookmarkedRegions AsyncStorage error:', e);
    return [];
  }
};

export const saveBookmarkedRegions = async (regions) => {
  const arr = Array.isArray(regions) ? regions : [];
  if (_userId) {
    try {
      await _saveToFirestore(_userId, arr);
      return;
    } catch (e) {
      console.warn('[RegionSync] saveBookmarkedRegions Firestore error, falling back:', e);
    }
  }
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.error('[RegionSync] saveBookmarkedRegions AsyncStorage error:', e);
  }
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
