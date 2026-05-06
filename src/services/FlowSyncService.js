import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

const getFlowsStorageKey = (uid) => `@todo_weather_flows_${uid || 'guest'}`;
const getSharedFlowsStorageKey = (uid) => `@todo_weather_shared_flows_${uid}`;
const MIGRATION_KEY_PREFIX = '@flows_global_schema_migrated_';

let _userId = null;
let _snapshotListeners = new Set();
let _unsubscribeFlowRefs = null;
let _flowListeners = new Map(); // flowId -> { flowUnsub, stepsUnsub }
let _flowRefs = new Map();      // flowId -> ref data from users/{uid}/flowRefs
let _flowDocs = new Map();      // flowId -> flow metadata from /flows/{flowId}
let _flowSteps = new Map();     // flowId -> steps[] from /flows/{flowId}/steps
let _deletedStepIds = new Map(); // flowId -> Set(stepId) deleted during this runtime
let _cachedFlows = null;
let _isRemoteUpdate = false;
let _initPromise = null;
let _initUid = null;

export const isRemoteFlowUpdate = () => _isRemoteUpdate;

const _globalFlowsCollection = () => firestore().collection('flows');
const _legacyFlowsCollection = (uid) => firestore().collection('users').doc(uid).collection('flows');
const _flowRefsCollection = (uid) => firestore().collection('users').doc(uid).collection('flowRefs');
const _legacySharedFlowsCollection = (uid) => firestore().collection('users').doc(uid).collection('sharedFlows');
const _stepsCollection = (flowId) => _globalFlowsCollection().doc(flowId).collection('steps');
const _membersCollection = (flowId) => _globalFlowsCollection().doc(flowId).collection('members');

const _stripMeta = ({ _role, _ownerUid, _permissions, ...rest }) => rest;

const _isPlainObject = (value) =>
  value !== null
  && typeof value === 'object'
  && Object.getPrototypeOf(value) === Object.prototype;

const _cleanForFirestore = (value) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    return value
      .map(_cleanForFirestore)
      .filter(item => item !== undefined);
  }
  if (_isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, child]) => [key, _cleanForFirestore(child)])
        .filter(([, child]) => child !== undefined)
    );
  }
  return value;
};

const _cleanObject = (obj) =>
  _cleanForFirestore(obj || {});

const _docExists = (doc) =>
  typeof doc.exists === 'function' ? doc.exists() : !!doc.exists;

const _isPermissionDenied = (error) =>
  error?.code === 'firestore/permission-denied'
  || String(error?.message || '').includes('permission-denied');

const _dropInaccessibleFlow = (flowId, reason = 'inaccessible') => {
  if (!flowId) return;
  console.warn('[FlowSync] dropping inaccessible flowRef', { flowId, reason });
  _flowRefs.delete(flowId);
  _flowDocs.delete(flowId);
  _flowSteps.delete(flowId);
  _stopFlowListener(flowId);
  if (_userId) {
    _flowRefsCollection(_userId).doc(flowId).delete()
      .catch(e => console.warn('[FlowSync] failed to delete inaccessible flowRef:', flowId, e));
  }
  _mergeAndNotify(true);
};

const _cleanFlowDocData = (flow, { includeOrder = false } = {}) => {
  const { id, steps, order, ...rest } = _stripMeta(flow || {});
  const data = _cleanObject(rest);
  if (includeOrder && order !== undefined) data.order = order;
  return data;
};

const _cleanStepData = (step, order) => {
  const { id, ...rest } = step || {};
  return _cleanObject({ ...rest, order });
};

const _sortSteps = (steps = []) =>
  [...steps].sort((a, b) => {
    const orderA = a.order;
    const orderB = b.order;
    if (orderA !== undefined && orderB !== undefined && orderA !== orderB) return orderA - orderB;
    const dateCmp = (a.date || '').localeCompare(b.date || '');
    if (dateCmp !== 0) return dateCmp;
    return (a.time || '').localeCompare(b.time || '');
  });

const _rememberDeletedStepIds = (flowId, stepIds = []) => {
  if (!flowId) return;
  const ids = (Array.isArray(stepIds) ? stepIds : [stepIds]).filter(Boolean);
  if (ids.length === 0) return;
  const next = _deletedStepIds.get(flowId) || new Set();
  ids.forEach(id => next.add(id));
  _deletedStepIds.set(flowId, next);
};

const _forgetDeletedStepIds = (flowId, stepIds = []) => {
  const deleted = _deletedStepIds.get(flowId);
  if (!deleted) return;
  (Array.isArray(stepIds) ? stepIds : [stepIds]).filter(Boolean).forEach(id => deleted.delete(id));
  if (deleted.size === 0) _deletedStepIds.delete(flowId);
};

const _filterDeletedSteps = (flowId, steps = []) => {
  const deleted = _deletedStepIds.get(flowId);
  if (!deleted || deleted.size === 0) return Array.isArray(steps) ? steps : [];
  return (Array.isArray(steps) ? steps : []).filter(step => !deleted.has(step.id));
};

const _flowFromParts = (flowId) => {
  const ref = _flowRefs.get(flowId);
  const doc = _flowDocs.get(flowId);
  if (!ref || !doc) return null;

  const role = ref.role || (doc.ownerUid === _userId ? 'owner' : 'viewer');
  const flow = {
    id: flowId,
    title: doc.title || '제목 없는 플로우',
    ...doc,
    steps: _sortSteps(_flowSteps.get(flowId) || []),
    _role: role,
    _permissions: ref.permissions,
    order: ref.order ?? 1000000,
  };

  if (doc.ownerUid && doc.ownerUid !== _userId) {
    flow._ownerUid = doc.ownerUid;
  }

  return flow;
};

const _mergeAndNotify = (fromRemote = false) => {
  const merged = Array.from(_flowRefs.keys())
    .map(_flowFromParts)
    .filter(Boolean)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  _cachedFlows = merged;
  if (_userId) {
    const sharedFlows = merged.filter(f => f._ownerUid);
    AsyncStorage.setItem(getSharedFlowsStorageKey(_userId), JSON.stringify(sharedFlows))
      .catch(e => console.warn('[FlowSync] Failed to save shared flows:', e));
  }

  _isRemoteUpdate = fromRemote;
  _snapshotListeners.forEach(cb => cb(merged));
  Promise.resolve().then(() => { _isRemoteUpdate = false; });
};

const _commitBatched = async (ops) => {
  let batch = firestore().batch();
  let count = 0;

  const commit = async () => {
    if (count === 0) return;
    await batch.commit();
    batch = firestore().batch();
    count = 0;
  };

  for (const op of ops) {
    op(batch);
    count += 1;
    if (count >= 450) await commit();
  }

  await commit();
};

const _saveFlowRef = async (uid, flow) => {
  const ownerUid = flow._ownerUid || flow.ownerUid || uid;
  const role = flow._role || (ownerUid === uid ? 'owner' : 'viewer');
  const refData = _cleanObject({
    flowId: flow.id,
    ownerUid,
    role,
    permissions: flow._permissions,
    order: flow.order ?? 0,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  });

  await _flowRefsCollection(uid).doc(flow.id).set(refData, { merge: true });
};

const _replaceFlowSteps = async (flowId, steps = []) => {
  const nextSteps = _filterDeletedSteps(flowId, steps);
  const existing = await _stepsCollection(flowId).get();
  const nextIds = new Set(nextSteps.map(s => s.id).filter(Boolean));
  const ops = [];

  existing.docs.forEach(doc => {
    if (!nextIds.has(doc.id)) {
      ops.push(batch => batch.delete(doc.ref));
    }
  });

  nextSteps.forEach((step, index) => {
    const stepId = step.id || `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${index}`;
    _forgetDeletedStepIds(flowId, stepId);
    ops.push(batch => batch.set(_stepsCollection(flowId).doc(stepId), _cleanStepData({ ...step, id: stepId }, index), { merge: true }));
  });

  await _commitBatched(ops);
};

const _saveFlowToGlobal = async (uid, flow) => {
  if (!uid || !flow?.id) return;
  const ownerUid = flow._ownerUid || flow.ownerUid || uid;
  const isOwner = ownerUid === uid && (!flow._role || flow._role === 'owner');
  const isEditor = flow._role === 'editor';

  if (!isOwner && !isEditor) {
    if (__DEV__) console.log('[FlowSync] save skipped: no edit permission', { flowId: flow.id, role: flow._role });
    return;
  }

  const flowRef = _globalFlowsCollection().doc(flow.id);
  const meta = _cleanFlowDocData({ ...flow, ownerUid }, { includeOrder: false });
  meta.ownerUid = ownerUid;
  meta.updatedAt = flow.updatedAt || firestore.FieldValue.serverTimestamp();

  if (isOwner) {
    await flowRef.set(meta, { merge: true });
    const ownerBatch = firestore().batch();
    ownerBatch.set(_membersCollection(flow.id).doc(uid), {
      role: 'owner',
      displayName: flow.displayName || 'Owner',
      joinedAt: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    ownerBatch.set(_flowRefsCollection(uid).doc(flow.id), {
      flowId: flow.id,
      ownerUid: uid,
      role: 'owner',
      order: flow.order ?? 0,
      updatedAt: firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await ownerBatch.commit();
  } else {
    await flowRef.set(meta, { merge: true });
  }

  await _replaceFlowSteps(flow.id, flow.steps || []);
};

const _migrateLegacyFlow = async (uid, flow) => {
  if (!uid || !flow?.id) return;
  await _saveFlowToGlobal(uid, { ...flow, ownerUid: uid, _role: 'owner' });
  await _saveFlowRef(uid, { ...flow, ownerUid: uid, _role: 'owner' });
};

const _migrateIfNeeded = async (uid) => {
  try {
    const migrationKey = `${MIGRATION_KEY_PREFIX}${uid}`;
    const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
    if (alreadyMigrated) {
      const refsSnapshot = await _flowRefsCollection(uid).limit(1).get();
      if (!refsSnapshot.empty) return;
    }

    const localJson = await AsyncStorage.getItem(getFlowsStorageKey(uid));
    const legacyJson = await AsyncStorage.getItem('@todo_weather_flows');
    const localFlows = localJson ? JSON.parse(localJson) : (legacyJson ? JSON.parse(legacyJson) : []);

    for (const flow of Array.isArray(localFlows) ? localFlows : []) {
      try {
        await _migrateLegacyFlow(uid, flow);
      } catch (e) {
        console.warn('[FlowSync] Legacy local flow migration skipped:', flow?.id, e);
      }
    }

    const legacyOwnSnapshot = await _legacyFlowsCollection(uid).get();
    for (const doc of legacyOwnSnapshot.docs) {
      try {
        await _migrateLegacyFlow(uid, { id: doc.id, ...doc.data() });
      } catch (e) {
        console.warn('[FlowSync] Legacy Firestore flow migration skipped:', doc.id, e);
      }
    }

    const legacySharedSnapshot = await _legacySharedFlowsCollection(uid).get();
    const batch = firestore().batch();
    legacySharedSnapshot.docs.forEach(doc => {
      const data = doc.data();
      batch.set(_flowRefsCollection(uid).doc(doc.id), _cleanObject({
        flowId: doc.id,
        ownerUid: data.ownerUid,
        role: data.role || 'viewer',
        permissions: data.permissions,
        order: data.order ?? 1000000,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }), { merge: true });
    });
    if (!legacySharedSnapshot.empty) await batch.commit();

    await AsyncStorage.setItem(migrationKey, '1');
  } catch (e) {
    console.warn('[FlowSync] Migration error:', e);
  }
};

const _stopFlowListener = (flowId) => {
  const entry = _flowListeners.get(flowId);
  if (!entry) return;
  if (entry.flowUnsub) entry.flowUnsub();
  if (entry.stepsUnsub) entry.stepsUnsub();
  _flowListeners.delete(flowId);
};

const _startFlowListener = (flowId) => {
  if (_flowListeners.has(flowId)) return;

  const flowUnsub = _globalFlowsCollection().doc(flowId).onSnapshot(
    doc => {
      if (_docExists(doc)) _flowDocs.set(flowId, { id: doc.id, ...doc.data() });
      else _flowDocs.delete(flowId);
      _mergeAndNotify(true);
    },
    err => {
      if (_isPermissionDenied(err)) {
        _dropInaccessibleFlow(flowId, 'flow snapshot permission-denied');
        return;
      }
      console.warn(`[FlowSync] Flow ${flowId} snapshot error:`, err);
    }
  );

  const stepsUnsub = _stepsCollection(flowId).onSnapshot(
    snapshot => {
      const steps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      _flowSteps.set(flowId, _sortSteps(_filterDeletedSteps(flowId, steps)));
      _mergeAndNotify(true);
    },
    err => {
      if (_isPermissionDenied(err)) {
        _dropInaccessibleFlow(flowId, 'steps snapshot permission-denied');
        return;
      }
      console.warn(`[FlowSync] Flow ${flowId} steps error:`, err);
    }
  );

  _flowListeners.set(flowId, { flowUnsub, stepsUnsub });
};

const _startFlowRefsSubscription = (uid) => {
  if (_unsubscribeFlowRefs) { _unsubscribeFlowRefs(); _unsubscribeFlowRefs = null; }

  _unsubscribeFlowRefs = _flowRefsCollection(uid)
    .orderBy('order', 'asc')
    .onSnapshot(
      snapshot => {
        const currentIds = new Set(snapshot.docs.map(doc => doc.id));

        _flowListeners.forEach((_, flowId) => {
          if (!currentIds.has(flowId)) {
            _stopFlowListener(flowId);
            _flowRefs.delete(flowId);
            _flowDocs.delete(flowId);
            _flowSteps.delete(flowId);
          }
        });

        snapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          _flowRefs.set(doc.id, {
            flowId: doc.id,
            ...data,
            order: data.order !== undefined ? data.order : (1000000 + index),
          });
          _startFlowListener(doc.id);
        });

        _mergeAndNotify(true);
      },
      error => console.warn('[FlowSync] flowRefs snapshot error:', error)
    );
};

const _loadRemoteFlows = async (uid) => {
  const refsSnapshot = await _flowRefsCollection(uid).orderBy('order', 'asc').get();
  const flows = [];

  for (const refDoc of refsSnapshot.docs) {
    try {
      const refData = refDoc.data();
      const flowDoc = await _globalFlowsCollection().doc(refDoc.id).get();
      if (!_docExists(flowDoc)) {
        _dropInaccessibleFlow(refDoc.id, 'missing flow doc');
        continue;
      }

      const stepsSnapshot = await _stepsCollection(refDoc.id).get();
      _flowRefs.set(refDoc.id, { flowId: refDoc.id, ...refData });
      _flowDocs.set(refDoc.id, { id: flowDoc.id, ...flowDoc.data() });
      const remoteSteps = stepsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      _flowSteps.set(refDoc.id, _filterDeletedSteps(refDoc.id, remoteSteps));

      const flow = _flowFromParts(refDoc.id);
      if (flow) flows.push(flow);
    } catch (e) {
      if (_isPermissionDenied(e)) {
        _dropInaccessibleFlow(refDoc.id, 'initial load permission-denied');
        continue;
      }
      console.warn('[FlowSync] loadRemoteFlows flow skipped:', refDoc.id, e);
    }
  }

  _cachedFlows = flows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return _cachedFlows;
};

const _initFlowSyncInternal = async (uid) => {
  _userId = uid;
  _flowRefs = new Map();
  _flowDocs = new Map();
  _flowSteps = new Map();
  _cachedFlows = null;

  if (_unsubscribeFlowRefs) { _unsubscribeFlowRefs(); _unsubscribeFlowRefs = null; }
  _flowListeners.forEach((_, flowId) => _stopFlowListener(flowId));
  _flowListeners.clear();

  if (uid) {
    await _migrateIfNeeded(uid);
    try {
      const flows = await _loadRemoteFlows(uid);
      _snapshotListeners.forEach(cb => cb(flows));
    } catch (e) {
      console.warn('[FlowSync] initial load error:', e);
    }
    _startFlowRefsSubscription(uid);
  } else {
    const localFlows = await getFlows();
    _snapshotListeners.forEach(cb => cb(localFlows));
  }
};

export const initFlowSync = async (uid) => {
  if (_initPromise && _initUid === uid) return _initPromise;
  _initUid = uid;
  _initPromise = _initFlowSyncInternal(uid).finally(() => {
    if (_initUid === uid) {
      _initPromise = null;
      _initUid = null;
    }
  });
  return _initPromise;
};

export const subscribeToFlows = (callback) => {
  _snapshotListeners.add(callback);
  if (_cachedFlows !== null) callback(_cachedFlows);
  return () => _snapshotListeners.delete(callback);
};

export const refreshSharedFlowListener = (ownerUid, flowId, role, order) => {
  if (!_userId || !flowId) return;

  _flowRefsCollection(_userId).doc(flowId).set({
    flowId,
    ownerUid,
    role,
    order: order ?? 0,
    updatedAt: firestore.FieldValue.serverTimestamp(),
  }, { merge: true }).catch(e => console.warn('[FlowSync] refresh flowRef failed:', e));
};

export const removeSharedFlowOptimistic = (flowId) => {
  _flowRefs.delete(flowId);
  _flowDocs.delete(flowId);
  _flowSteps.delete(flowId);
  _stopFlowListener(flowId);
  _mergeAndNotify();
};

export const updateFlowDoc = async (flow) => {
  if (!flow || !_userId) return;
  await _saveFlowToGlobal(_userId, flow);
};

export const deleteFlowStepDocs = async (flow, stepIds = []) => {
  if (!flow || !_userId || !flow.id) return false;

  const ids = [...new Set((Array.isArray(stepIds) ? stepIds : [stepIds]).filter(Boolean))];
  if (ids.length === 0) return false;
  _rememberDeletedStepIds(flow.id, ids);

  const ownerUid = flow._ownerUid || flow.ownerUid || _userId;
  const isOwner = ownerUid === _userId && (!flow._role || flow._role === 'owner');
  const isEditor = flow._role === 'editor';

  if (!isOwner && !isEditor) {
    if (__DEV__) console.log('[FlowSync] step delete skipped: no edit permission', { flowId: flow.id, role: flow._role });
    _forgetDeletedStepIds(flow.id, ids);
    return false;
  }

  const meta = _cleanFlowDocData({ ...flow, ownerUid }, { includeOrder: false });
  meta.ownerUid = ownerUid;
  meta.updatedAt = flow.updatedAt || firestore.FieldValue.serverTimestamp();

  const ops = [
    batch => batch.set(_globalFlowsCollection().doc(flow.id), meta, { merge: true }),
    ...ids.map(stepId => batch => batch.delete(_stepsCollection(flow.id).doc(stepId))),
  ];

  try {
    await _commitBatched(ops);
  } catch (e) {
    _forgetDeletedStepIds(flow.id, ids);
    console.warn('[FlowSync] deleteFlowStepDocs:commitFailed', {
      flowId: flow.id,
      stepIds: ids,
      code: e?.code,
      message: e?.message,
    });
    throw e;
  }

  _flowDocs.set(flow.id, { id: flow.id, ...meta });
  _flowSteps.set(flow.id, _filterDeletedSteps(flow.id, flow.steps || []));
  _mergeAndNotify();
  return true;
};

export const getFlows = async () => {
  if (_userId) {
    if (_cachedFlows !== null) return _cachedFlows;

    try {
      return await _loadRemoteFlows(_userId);
    } catch (e) {
      console.warn('[FlowSync] getFlows Firestore error, falling back:', e);
    }
  }

  try {
    const json = await AsyncStorage.getItem(getFlowsStorageKey(_userId));
    const legacyJson = !_userId ? await AsyncStorage.getItem('@todo_weather_flows') : null;
    const data = json ? JSON.parse(json) : (legacyJson ? JSON.parse(legacyJson) : []);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('[FlowSync] getFlows AsyncStorage error:', e);
    return [];
  }
};

export const saveFlows = async (flows) => {
  const arr = Array.isArray(flows) ? flows : [];
  const ordered = arr.map((f, i) => ({ ...f, order: i }));
  const ownFlows = ordered.filter(f => !f._ownerUid || f._role === 'owner');
  const sharedFlows = ordered.filter(f => f._ownerUid || (f._role && f._role !== 'owner'));

  _flowRefs = new Map();
  ordered.forEach(flow => {
    _flowRefs.set(flow.id, {
      flowId: flow.id,
      ownerUid: flow._ownerUid || flow.ownerUid || _userId,
      role: flow._role || 'owner',
      permissions: flow._permissions,
      order: flow.order,
    });
    _flowDocs.set(flow.id, { id: flow.id, ..._cleanFlowDocData(flow), ownerUid: flow._ownerUid || flow.ownerUid || _userId });
    _flowSteps.set(flow.id, _filterDeletedSteps(flow.id, flow.steps || []));
  });
  _mergeAndNotify();

  if (_userId) {
    try {
      for (const flow of ownFlows) {
        await _saveFlowToGlobal(_userId, { ...flow, _role: 'owner' });
      }
      for (const flow of sharedFlows) {
        await _saveFlowRef(_userId, flow);
      }

      const currentRefs = await _flowRefsCollection(_userId).get();
      const nextIds = new Set(ordered.map(f => f.id));
      const batch = firestore().batch();
      currentRefs.docs
        .filter(doc => !nextIds.has(doc.id) && doc.data().role === 'owner')
        .forEach(doc => batch.delete(doc.ref));
      await batch.commit();
    } catch (e) {
      if (__DEV__) console.warn('[FlowSync] saveFlows Firestore error:', e);
    }
  }

  try {
    await AsyncStorage.setItem(getFlowsStorageKey(_userId), JSON.stringify(ownFlows));
    if (!_userId) {
      await AsyncStorage.setItem('@todo_weather_flows', JSON.stringify(ownFlows));
    }
  } catch (e) {
    if (__DEV__) console.error('[FlowSync] saveFlows AsyncStorage error:', e);
  }
};

export const addFlow = async (flow) => {
  const current = await getFlows();
  const ownFlows = current.filter(f => !f._ownerUid);
  await saveFlows([{ ...flow, _role: 'owner' }, ...ownFlows]);
  return [{ ...flow, _role: 'owner' }, ...current];
};

export const deleteFlow = async (id) => {
  _flowRefs.delete(id);
  _flowDocs.delete(id);
  _flowSteps.delete(id);
  _stopFlowListener(id);
  _mergeAndNotify();

  if (_userId) {
    try {
      const membersSnapshot = await _membersCollection(id).get();
      const stepsSnapshot = await _stepsCollection(id).get();
      const batch = firestore().batch();

      membersSnapshot.docs.forEach(memberDoc => {
        batch.delete(_flowRefsCollection(memberDoc.id).doc(id));
        batch.delete(memberDoc.ref);
      });
      stepsSnapshot.docs.forEach(stepDoc => batch.delete(stepDoc.ref));
      batch.delete(_globalFlowsCollection().doc(id));
      await batch.commit();
    } catch (e) {
      if (__DEV__) console.warn('[FlowSync] deleteFlow Firestore error:', e);
    }
  }

  try {
    const json = await AsyncStorage.getItem(getFlowsStorageKey(_userId));
    const data = json ? JSON.parse(json) : [];
    await AsyncStorage.setItem(getFlowsStorageKey(_userId), JSON.stringify(data.filter(f => f.id !== id)));
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
