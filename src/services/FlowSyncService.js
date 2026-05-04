import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

const FLOWS_STORAGE_KEY = '@todo_weather_flows';
const MIGRATION_KEY_PREFIX = '@flows_migrated_';

let _userId = null;
let _snapshotListeners = new Set();
let _unsubscribeFirestore = null;
let _cachedFlows = null;

// ─── Internal Firestore helpers ───────────────────────────────────────────────

const _flowsCollection = (uid) =>
  firestore().collection('users').doc(uid).collection('flows');

const _docToFlow = (doc) => ({ id: doc.id, ...doc.data() });

const _flowsFromSnapshot = (snapshot) => {
  const docs = snapshot.docs
    .map(_docToFlow)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return docs;
};

const _saveToFirestore = async (uid, flows) => {
  const batch = firestore().batch();
  const col = _flowsCollection(uid);

  flows.forEach((flow, index) => {
    const { id, ...data } = flow;
    batch.set(col.doc(id), { ...data, order: index, ownerId: uid });
  });

  const newIds = new Set(flows.map((f) => f.id));
  (_cachedFlows || [])
    .filter((f) => !newIds.has(f.id))
    .forEach((f) => batch.delete(col.doc(f.id)));

  await batch.commit();
};

// ─── One-time migration: AsyncStorage → Firestore ────────────────────────────

const _migrateIfNeeded = async (uid) => {
  try {
    const migrationKey = `${MIGRATION_KEY_PREFIX}${uid}`;
    const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
    if (alreadyMigrated) return;

    const localJson = await AsyncStorage.getItem(FLOWS_STORAGE_KEY);
    const localFlows = localJson ? JSON.parse(localJson) : [];

    if (localFlows.length > 0) {
      const snapshot = await _flowsCollection(uid).limit(1).get();
      if (snapshot.empty) {
        await _saveToFirestore(uid, localFlows);
      }
    }

    await AsyncStorage.setItem(migrationKey, '1');
  } catch (e) {
    console.warn('[FlowSync] Migration error:', e);
  }
};

// ─── Snapshot subscription ────────────────────────────────────────────────────

const _startFirestoreSubscription = (uid) => {
  if (_unsubscribeFirestore) {
    _unsubscribeFirestore();
    _unsubscribeFirestore = null;
  }

  _unsubscribeFirestore = _flowsCollection(uid)
    .orderBy('order', 'asc')
    .onSnapshot(
      (snapshot) => {
        const flows = _flowsFromSnapshot(snapshot);
        _cachedFlows = flows;
        _snapshotListeners.forEach((cb) => cb(flows));
      },
      (error) => {
        console.warn('[FlowSync] Firestore snapshot error:', error);
      }
    );
};

// ─── Public lifecycle API ─────────────────────────────────────────────────────

export const initFlowSync = async (uid) => {
  _userId = uid;
  _cachedFlows = null;

  if (uid) {
    await _migrateIfNeeded(uid);
    _startFirestoreSubscription(uid);
  } else {
    if (_unsubscribeFirestore) {
      _unsubscribeFirestore();
      _unsubscribeFirestore = null;
    }
    _cachedFlows = null;
    _snapshotListeners.forEach((cb) => cb(null));
  }
};

export const subscribeToFlows = (callback) => {
  _snapshotListeners.add(callback);
  if (_cachedFlows !== null) callback(_cachedFlows);
  return () => _snapshotListeners.delete(callback);
};

// ─── FlowService-compatible API ───────────────────────────────────────────────

export const getFlows = async () => {
  if (_userId) {
    try {
      if (_cachedFlows !== null) return _cachedFlows;
      const snapshot = await _flowsCollection(_userId).orderBy('order', 'asc').get();
      const flows = _flowsFromSnapshot(snapshot);
      _cachedFlows = flows;
      return flows;
    } catch (e) {
      console.warn('[FlowSync] getFlows Firestore error, falling back:', e);
    }
  }
  try {
    const json = await AsyncStorage.getItem(FLOWS_STORAGE_KEY);
    const data = json ? JSON.parse(json) : [];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('[FlowSync] getFlows AsyncStorage error:', e);
    return [];
  }
};

export const saveFlows = async (flows) => {
  const arr = Array.isArray(flows) ? flows : [];
  if (_userId) {
    try {
      await _saveToFirestore(_userId, arr);
      return;
    } catch (e) {
      console.warn('[FlowSync] saveFlows Firestore error, falling back:', e);
    }
  }
  try {
    await AsyncStorage.setItem(FLOWS_STORAGE_KEY, JSON.stringify(arr));
  } catch (e) {
    console.error('[FlowSync] saveFlows AsyncStorage error:', e);
  }
};

export const addFlow = async (flow) => {
  const current = await getFlows();
  const updated = [flow, ...current];
  await saveFlows(updated);
  return updated;
};

export const deleteFlow = async (id) => {
  const current = await getFlows();
  const updated = current.filter((f) => f.id !== id);
  await saveFlows(updated);
  return updated;
};

export const applyFlowFreeLimit = async (limit) => {
  const flows = await getFlows();
  const sorted = [...flows].sort((a, b) =>
    (a.createdAt || '').localeCompare(b.createdAt || '')
  );
  const updated = sorted.map((f, i) => ({ ...f, inactive: i >= limit }));
  await saveFlows(updated);
  return updated;
};

export const restoreAllFlows = async () => {
  const flows = await getFlows();
  const updated = flows.map((f) => ({ ...f, inactive: false }));
  await saveFlows(updated);
  return updated;
};
