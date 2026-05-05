import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

const FLOWS_STORAGE_KEY = '@todo_weather_flows';
const SHARED_FLOWS_STORAGE_KEY = '@todo_weather_shared_flows';
const MIGRATION_KEY_PREFIX = '@flows_migrated_';

let _userId = null;
let _snapshotListeners = new Set();
let _unsubscribeOwnFlows = null;
let _unsubscribeSharedFlows = null;
let _sharedFlowListeners = new Map(); // flowId → unsubscribe fn
let _ownFlows = [];           // own flow documents (raw, no _role)
let _sharedFlowsData = [];    // shared flow documents (with _ownerUid, _role)
let _cachedFlows = null;      // merged: own (_role:'owner') + shared

// ─── Internal Firestore helpers ───────────────────────────────────────────────

const _flowsCollection = (uid) =>
  firestore().collection('users').doc(uid).collection('flows');

const _docToFlow = (doc) => ({ id: doc.id, ...doc.data() });

const _flowsFromSnapshot = (snapshot) =>
  snapshot.docs.map(_docToFlow).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const _stripMeta = ({ _role, _ownerUid, ...rest }) => rest;

const _mergeAndNotify = () => {
  const merged = [
    ..._ownFlows.map(f => ({ ...f, _role: 'owner' })),
    ..._sharedFlowsData,
  ];
  _cachedFlows = merged;
  if (_userId) {
    AsyncStorage.setItem(SHARED_FLOWS_STORAGE_KEY, JSON.stringify(_sharedFlowsData)).catch(e => console.warn('[FlowSync] Failed to save shared flows:', e));
  }
  _snapshotListeners.forEach(cb => cb(merged));
};

const _saveToFirestore = async (uid, ownFlows) => {
  const batch = firestore().batch();
  const col = _flowsCollection(uid);

  ownFlows.forEach((flow, index) => {
    const { id, ...data } = flow;
    batch.set(col.doc(id), { ...data, order: index, ownerUid: uid });
  });

  // Diff only against _ownFlows (never attempt to delete shared flow docs)
  const newIds = new Set(ownFlows.map(f => f.id));
  (_ownFlows || [])
    .filter(f => !newIds.has(f.id))
    .forEach(f => batch.delete(col.doc(f.id)));

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

// ─── Snapshot subscriptions ───────────────────────────────────────────────────

const _startOwnFlowsSubscription = (uid) => {
  if (_unsubscribeOwnFlows) { _unsubscribeOwnFlows(); _unsubscribeOwnFlows = null; }

  _unsubscribeOwnFlows = _flowsCollection(uid)
    .orderBy('order', 'asc')
    .onSnapshot(
      snapshot => {
        _ownFlows = _flowsFromSnapshot(snapshot);
        _mergeAndNotify();
      },
      error => console.warn('[FlowSync] Own flows snapshot error:', error)
    );
};

const _startSharedFlowsSubscription = (uid) => {
  if (_unsubscribeSharedFlows) { _unsubscribeSharedFlows(); _unsubscribeSharedFlows = null; }
  _sharedFlowListeners.forEach(unsub => unsub());
  _sharedFlowListeners.clear();
  _sharedFlowsData = [];

  const sharedFlowsCol = firestore().collection('users').doc(uid).collection('sharedFlows');

  _unsubscribeSharedFlows = sharedFlowsCol.onSnapshot(snapshot => {
    const currentIds = new Set(snapshot.docs.map(d => d.id));

    // Remove listeners for flows no longer shared with us
    _sharedFlowListeners.forEach((unsub, flowId) => {
      if (!currentIds.has(flowId)) {
        unsub();
        _sharedFlowListeners.delete(flowId);
      }
    });

    // CRUCIAL: Remove stale flows from data cache (handles case where app restarts and no listener exists yet)
    _sharedFlowsData = _sharedFlowsData.filter(f => currentIds.has(f.id));

    // If all shared flows removed, notify immediately
    if (currentIds.size === 0 && _sharedFlowsData.length === 0) {
      _mergeAndNotify();
      return;
    }

    // Add listeners for newly shared flows
    snapshot.docs.forEach(pointerDoc => {
      const { ownerUid, role } = pointerDoc.data();
      const flowId = pointerDoc.id;

      // If a listener exists AND the flow is already in _sharedFlowsData, it's healthy — skip.
      // If a listener exists but the flow is NOT in _sharedFlowsData, the listener likely died
      // (e.g. permission error before membership was fully written) — tear it down and retry.
      if (_sharedFlowListeners.has(flowId)) {
        if (_sharedFlowsData.some(f => f.id === flowId)) return;
        _sharedFlowListeners.get(flowId)();
        _sharedFlowListeners.delete(flowId);
      }

      const unsub = firestore()
        .collection('users').doc(ownerUid).collection('flows').doc(flowId)
        .onSnapshot(
          flowDoc => {
            if (flowDoc.exists) {
              const flowData = {
                id: flowDoc.id,
                ...flowDoc.data(),
                _ownerUid: ownerUid,
                _role: role,
              };
              const idx = _sharedFlowsData.findIndex(f => f.id === flowId);
              if (idx >= 0) _sharedFlowsData[idx] = flowData;
              else _sharedFlowsData.push(flowData);
            } else {
              _sharedFlowsData = _sharedFlowsData.filter(f => f.id !== flowId);
            }
            _mergeAndNotify();
          },
          err => {
            console.warn('[FlowSync] Shared flow snapshot error:', err);
            // Remove dead listener so the next sharedFlows snapshot can retry.
            _sharedFlowListeners.delete(flowId);
          }
        );

      _sharedFlowListeners.set(flowId, unsub);
    });
  }, error => console.warn('[FlowSync] Shared flows collection error:', error));
};

// ─── Public lifecycle API ─────────────────────────────────────────────────────

export const initFlowSync = async (uid) => {
  _userId = uid;
  _ownFlows = [];
  _sharedFlowsData = [];
  _cachedFlows = null;

  // Cleanup all previous subscriptions
  if (_unsubscribeOwnFlows) { _unsubscribeOwnFlows(); _unsubscribeOwnFlows = null; }
  if (_unsubscribeSharedFlows) { _unsubscribeSharedFlows(); _unsubscribeSharedFlows = null; }
  _sharedFlowListeners.forEach(unsub => unsub());
  _sharedFlowListeners.clear();

  if (uid) {
    try {
      const sharedJson = await AsyncStorage.getItem(SHARED_FLOWS_STORAGE_KEY);
      if (sharedJson) {
        _sharedFlowsData = JSON.parse(sharedJson) || [];
      }
    } catch (e) {
      console.warn('[FlowSync] Failed to load cached shared flows:', e);
    }
    
    await _migrateIfNeeded(uid);
    _startOwnFlowsSubscription(uid);
    _startSharedFlowsSubscription(uid);
  } else {
    _snapshotListeners.forEach(cb => cb(null));
  }
};

export const subscribeToFlows = (callback) => {
  _snapshotListeners.add(callback);
  if (_cachedFlows !== null) callback(_cachedFlows);
  return () => _snapshotListeners.delete(callback);
};

// Force-refresh a specific shared flow listener (call after a successful join).
// The sharedFlows collection snapshot will eventually trigger the retry logic, but
// this provides an immediate kick in case the pointer doc already existed before.
export const refreshSharedFlowListener = (ownerUid, flowId, role) => {
  // Tear down any existing (possibly dead) listener for this flowId
  if (_sharedFlowListeners.has(flowId)) {
    _sharedFlowListeners.get(flowId)();
    _sharedFlowListeners.delete(flowId);
  }
  _sharedFlowsData = _sharedFlowsData.filter(f => f.id !== flowId);

  const unsub = firestore()
    .collection('users').doc(ownerUid).collection('flows').doc(flowId)
    .onSnapshot(
      flowDoc => {
        if (flowDoc.exists) {
          const flowData = { id: flowDoc.id, ...flowDoc.data(), _ownerUid: ownerUid, _role: role };
          const idx = _sharedFlowsData.findIndex(f => f.id === flowId);
          if (idx >= 0) _sharedFlowsData[idx] = flowData;
          else _sharedFlowsData.push(flowData);
        } else {
          _sharedFlowsData = _sharedFlowsData.filter(f => f.id !== flowId);
        }
        _mergeAndNotify();
      },
      err => {
        console.warn('[FlowSync] refreshSharedFlowListener error:', err);
        _sharedFlowListeners.delete(flowId);
      }
    );
  _sharedFlowListeners.set(flowId, unsub);
};

// Optimistic removal of a shared flow (called before leaveFlow Firestore write)
export const removeSharedFlowOptimistic = (flowId) => {
  _sharedFlowsData = _sharedFlowsData.filter(f => f.id !== flowId);
  const unsub = _sharedFlowListeners.get(flowId);
  if (unsub) { unsub(); _sharedFlowListeners.delete(flowId); }
  _mergeAndNotify();
};

// ─── Flow document update (own or shared) ────────────────────────────────────

export const updateFlowDoc = async (flow) => {
  const ownerUid = flow._ownerUid || _userId;
  if (__DEV__) {
    console.log('[FlowSync] updateFlowDoc called', { 
      flowId: flow.id, 
      ownerUid, 
      hasUserId: !!_userId,
      hasOrder: flow.order !== undefined,
      order: flow.order
    });
  }
  if (!ownerUid) {
    if (__DEV__) console.warn('[FlowSync] No ownerUid found for updateFlowDoc');
    return;
  }
  const { id, _ownerUid, _role, ...data } = flow;
  try {
    await firestore().collection('users').doc(ownerUid).collection('flows').doc(id).update(data);
    if (__DEV__) console.log('[FlowSync] Firestore update success for flow:', id);
  } catch (e) {
    if (__DEV__) console.error('[FlowSync] Firestore update FAILED:', e);
    throw e;
  }
};

// ─── FlowService-compatible API ───────────────────────────────────────────────

export const getFlows = async () => {
  if (_userId) {
    try {
      if (_cachedFlows !== null) return _cachedFlows;
      const snapshot = await _flowsCollection(_userId).orderBy('order', 'asc').get();
      const flows = _flowsFromSnapshot(snapshot);
      _ownFlows = flows;
      _cachedFlows = [
        ...flows.map(f => ({ ...f, _role: 'owner' })),
        ..._sharedFlowsData
      ];
      return _cachedFlows;
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

// saveFlows only persists own flows; shared flows must use updateFlowDoc directly
export const saveFlows = async (flows) => {
  const arr = Array.isArray(flows) ? flows : [];
  const ownFlows = arr.filter(f => !f._ownerUid).map(_stripMeta);

  _ownFlows = ownFlows;
  _mergeAndNotify();

  if (_userId) {
    try {
      if (__DEV__) console.log('[FlowSync] saveFlows - Syncing to Firestore...', { count: ownFlows.length });
      await _saveToFirestore(_userId, ownFlows);
    } catch (e) {
      if (__DEV__) console.warn('[FlowSync] saveFlows Firestore error:', e);
    }
  }
  try {
    await AsyncStorage.setItem(FLOWS_STORAGE_KEY, JSON.stringify(ownFlows));
  } catch (e) {
    if (__DEV__) console.error('[FlowSync] saveFlows AsyncStorage error:', e);
  }
};

export const addFlow = async (flow) => {
  const current = await getFlows();
  const ownFlows = current.filter(f => !f._ownerUid);
  const updated = [flow, ...ownFlows];
  await saveFlows(updated);
  return [...current.filter(f => f._ownerUid), ...updated.map(f => ({ ...f, _role: 'owner' }))];
};

export const deleteFlow = async (id) => {
  // Optimistic update: remove from cache immediately so getFlows() is never stale
  _ownFlows = (_ownFlows || []).filter(f => f.id !== id);
  _mergeAndNotify();

  if (_userId) {
    try {
      if (__DEV__) console.log('[FlowSync] deleteFlow - Deleting from Firestore...', { id });
      await _flowsCollection(_userId).doc(id).delete();
      if (__DEV__) console.log('[FlowSync] deleteFlow - Firestore deletion success.');
    } catch (e) {
      if (__DEV__) console.warn('[FlowSync] deleteFlow Firestore error:', e);
    }
  }
  try {
    const json = await AsyncStorage.getItem(FLOWS_STORAGE_KEY);
    const data = json ? JSON.parse(json) : [];
    const filtered = data.filter(f => f.id !== id);
    await AsyncStorage.setItem(FLOWS_STORAGE_KEY, JSON.stringify(filtered));
    if (__DEV__) console.log('[FlowSync] deleteFlow - AsyncStorage update success.');
  } catch (e) {
    if (__DEV__) console.error('[FlowSync] deleteFlow AsyncStorage error:', e);
  }
};

export const applyFlowFreeLimit = async (limit) => {
  const flows = await getFlows();
  const ownFlows = flows.filter(f => !f._ownerUid);
  const sorted = [...ownFlows].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  const updated = sorted.map((f, i) => ({ ...f, inactive: i >= limit }));
  await saveFlows(updated);
  return updated;
};

export const restoreAllFlows = async () => {
  const flows = await getFlows();
  const ownFlows = flows.filter(f => !f._ownerUid).map(f => ({ ...f, inactive: false }));
  await saveFlows(ownFlows);
  return ownFlows;
};
