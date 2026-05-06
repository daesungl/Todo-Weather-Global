import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

const getFlowsStorageKey = (uid) => `@todo_weather_flows_${uid}`;
const getSharedFlowsStorageKey = (uid) => `@todo_weather_shared_flows_${uid}`;
const MIGRATION_KEY_PREFIX = '@flows_migrated_';

let _userId = null;
let _snapshotListeners = new Set();
let _unsubscribeOwnFlows = null;
let _unsubscribeSharedFlows = null;
let _sharedFlowListeners = new Map(); // flowId → unsubscribe fn
let _ownFlows = [];           // own flow documents (raw, no _role)
let _sharedFlowsData = [];    // shared flow documents (with _ownerUid, _role)
let _cachedFlows = null;      // merged: own (_role:'owner') + shared
let _isRemoteUpdate = false;  // true when change originated from Firestore (not local)

// Firestore 원격 업데이트 여부를 외부에서 확인할 수 있도록 export
export const isRemoteFlowUpdate = () => _isRemoteUpdate;

// ─── Internal Firestore helpers ───────────────────────────────────────────────

const _flowsCollection = (uid) =>
  firestore().collection('users').doc(uid).collection('flows');

const _docToFlow = (doc, index) => {
  const data = doc.data();
  return { 
    id: doc.id, 
    ...data,
    order: (data.order !== undefined && data.order !== null) ? data.order : (1000000 + index)
  };
};

const _flowsFromSnapshot = (snapshot) =>
  snapshot.docs.map((doc, i) => _docToFlow(doc, i)).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

const _stripMeta = ({ _role, _ownerUid, _permissions, ...rest }) => rest;

const _mergeAndNotify = (fromRemote = false) => {
  const mergedMap = new Map();
  // 1. 자신의 플로우 우선 추가 (Role: 'owner')
  _ownFlows.forEach(f => {
    mergedMap.set(f.id, { ...f, _role: 'owner' });
  });
  // 2. 공유받은 플로우 추가 (이미 있으면 무시 - 오너 권한 우선)
  _sharedFlowsData.forEach(f => {
    if (!mergedMap.has(f.id)) {
      mergedMap.set(f.id, f);
    }
  });

  const merged = Array.from(mergedMap.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  _cachedFlows = merged;
  if (__DEV__) {
    console.log('[FlowSync] _mergeAndNotify', {
      own: _ownFlows.length,
      shared: _sharedFlowsData.length,
      merged: merged.length,
      list: merged.map(f => `${f.id.slice(-4)}:${f.order ?? 'none'}:${f._role || 'no-role'}`)
    });
  }
  if (_userId) {
    AsyncStorage.setItem(getSharedFlowsStorageKey(_userId), JSON.stringify(_sharedFlowsData)).catch(e => console.warn('[FlowSync] Failed to save shared flows:', e));
  }
  _isRemoteUpdate = fromRemote;
  _snapshotListeners.forEach(cb => cb(merged));
  // 콜백 실행 후 플래그 초기화 (동기 콜백 체인이 끝난 직후)
  Promise.resolve().then(() => { _isRemoteUpdate = false; });
};

const _saveAllFlowOrdersToFirestore = async (uid, flows) => {
  if (!uid) return;
  const batch = firestore().batch();
  const ownCol = _flowsCollection(uid);
  const sharedCol = firestore().collection('users').doc(uid).collection('sharedFlows');

  const ownFlows = flows.filter(f => f._role === 'owner' || !f._ownerUid);
  const sharedFlows = flows.filter(f => f._role && f._role !== 'owner');

  // Update own flows orders (merge:true preserves server-only fields like commentCounts)
  ownFlows.forEach((flow) => {
    const { id, ...data } = _stripMeta(flow);
    batch.set(ownCol.doc(id), { ...data, order: flow.order, ownerUid: uid }, { merge: true });
  });

  // Update shared flows pointer orders
  sharedFlows.forEach((flow) => {
    // Use set with merge: true to be more robust than update
    batch.set(sharedCol.doc(flow.id), { order: flow.order }, { merge: true });
  });

  // Handle deletions (only for own flows)
  const newOwnIds = new Set(ownFlows.map(f => f.id));
  (_ownFlows || [])
    .filter(f => !newOwnIds.has(f.id))
    .forEach(f => batch.delete(ownCol.doc(f.id)));

  await batch.commit();
};

// ─── One-time migration: AsyncStorage → Firestore ────────────────────────────

const _migrateIfNeeded = async (uid) => {
  try {
    const migrationKey = `${MIGRATION_KEY_PREFIX}${uid}`;
    const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
    if (alreadyMigrated) return;

    const localJson = await AsyncStorage.getItem(getFlowsStorageKey(uid));
    // Fallback to old global key for migration
    const legacyJson = await AsyncStorage.getItem('@todo_weather_flows');
    const localFlows = localJson ? JSON.parse(localJson) : (legacyJson ? JSON.parse(legacyJson) : []);

    if (localFlows.length > 0) {
      const snapshot = await _flowsCollection(uid).limit(1).get();
      if (snapshot.empty) {
        // Use the existing saveFlows logic for migration
        await saveFlows(localFlows);
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
        _mergeAndNotify(true); // true = Firestore 원격 변경
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

    // CRUCIAL: Remove stale flows from data cache
    _sharedFlowsData = _sharedFlowsData.filter(f => currentIds.has(f.id));

    // If all shared flows removed, notify immediately
    if (currentIds.size === 0 && _sharedFlowsData.length === 0) {
      _mergeAndNotify(true);
      return;
    }

    // Add/Update listeners for shared flows
    // 신규 flowId를 먼저 식별해서 딜레이 적용 대상 파악
    const existingListenerIds = new Set(_sharedFlowListeners.keys());

    snapshot.docs.forEach((pointerDoc, pointerIdx) => {
      const pointerData = pointerDoc.data();
      const { ownerUid, role } = pointerData;
      // order 필드가 없는 기존 문서는 큰 값으로 fallback → 맨 뒤에 정렬
      const order = pointerData.order !== undefined ? pointerData.order : (Date.now() + pointerIdx);
      const flowId = pointerDoc.id;
      const isNewFlow = !existingListenerIds.has(flowId);

      if (_sharedFlowListeners.has(flowId)) {
        const existing = _sharedFlowsData.find(f => f.id === flowId);
        if (!existing) {
          // Listener exists but data not yet populated (e.g. set up by refreshSharedFlowListener)
          // — don't tear it down, it's already working
          return;
        }
        const roleChanged = existing._role !== role;
        const permChanged = JSON.stringify(existing._permissions) !== JSON.stringify(pointerData.permissions);
        const orderChanged = existing.order !== order;

        // Nothing relevant changed — skip
        if (!roleChanged && !permChanged && !orderChanged) return;

        // Only order changed — safe to patch in place; no need to restart the listener
        if (!roleChanged && !permChanged) {
          existing.order = order;
          _mergeAndNotify();
          return;
        }

        // Role or permissions changed → must restart the listener so its closure
        // captures the new values.
        _sharedFlowListeners.get(flowId)();
        _sharedFlowListeners.delete(flowId);
      }

      const _startFlowListener = () => {
        // 이미 리스너가 있으면 덮어쓰지 않음
        if (_sharedFlowListeners.has(flowId)) return;
        
        const unsub = firestore()
          .collection('users').doc(ownerUid).collection('flows').doc(flowId)
          .onSnapshot(
            flowDoc => {
              const rawData = flowDoc.data();
              if (rawData) {
                const flowData = {
                  id: flowDoc.id,
                  title: rawData.title || '제목 없는 플로우',
                  ...rawData,
                  _ownerUid: ownerUid,
                  _role: role,
                  _permissions: pointerData.permissions,
                  order: order,
                };
                const idx = _sharedFlowsData.findIndex(f => f.id === flowId);
                if (idx >= 0) _sharedFlowsData[idx] = flowData;
                else _sharedFlowsData.push(flowData);
              } else {
                _sharedFlowsData = _sharedFlowsData.filter(f => f.id !== flowId);
              }
              _mergeAndNotify(true);
            },
            err => {
              // 권한 오류(permission-denied)일 경우에만 재시도
              if (err.code === 'permission-denied' || err.code === 'PERMISSION_DENIED') {
                if (__DEV__) console.log(`[FlowSync] Permission delayed for ${flowId}, retrying in 2s...`);
                _sharedFlowListeners.delete(flowId);
                setTimeout(() => {
                  if (!_sharedFlowListeners.has(flowId) && _userId) _startFlowListener();
                }, 2000);
              } else {
                console.warn(`[FlowSync] Shared flow ${flowId} error:`, err);
                _sharedFlowListeners.delete(flowId);
              }
            }
          );
        _sharedFlowListeners.set(flowId, unsub);
      };

      // 즉시 리스너 시작 (지연 로직 제거)
      _startFlowListener();
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
      const sharedJson = await AsyncStorage.getItem(getSharedFlowsStorageKey(uid));
      // Fallback to old global key for migration
      const legacySharedJson = await AsyncStorage.getItem('@todo_weather_shared_flows');
      if (sharedJson) {
        _sharedFlowsData = JSON.parse(sharedJson) || [];
      } else if (legacySharedJson) {
        _sharedFlowsData = JSON.parse(legacySharedJson) || [];
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
export const refreshSharedFlowListener = (ownerUid, flowId, role, order) => {
  // Tear down any existing (possibly dead) listener for this flowId
  if (_sharedFlowListeners.has(flowId)) {
    _sharedFlowListeners.get(flowId)();
    _sharedFlowListeners.delete(flowId);
  }
  _sharedFlowsData = _sharedFlowsData.filter(f => f.id !== flowId);

  // Persist the order to the sharedFlows pointer doc so it survives restarts
  if (order !== undefined && _userId) {
    firestore()
      .collection('users').doc(_userId).collection('sharedFlows').doc(flowId)
      .set({ order }, { merge: true })
      .catch(e => console.warn('[FlowSync] refreshSharedFlowListener order update failed:', e));
  }

  const unsub = firestore()
    .collection('users').doc(ownerUid).collection('flows').doc(flowId)
    .onSnapshot(
      flowDoc => {
        const rawData = flowDoc.data();
        if (rawData) {
          const flowData = { id: flowDoc.id, title: rawData.title || '제목 없는 플로우', ...rawData, _ownerUid: ownerUid, _role: role, ...(order !== undefined && { order }) };
          const idx = _sharedFlowsData.findIndex(f => f.id === flowId);
          if (idx >= 0) _sharedFlowsData[idx] = flowData;
          else _sharedFlowsData.push(flowData);
        } else {
          _sharedFlowsData = _sharedFlowsData.filter(f => f.id !== flowId);
        }
        _mergeAndNotify();
      },
      err => {
        console.warn('[FlowSync] refreshSharedFlowListener error:', err.code, err.message);
        _sharedFlowListeners.delete(flowId);
        // permission-denied: Firestore 규칙 전파 지연 대응 — _startFlowListener와 동일하게 재시도
        if ((err.code === 'permission-denied' || err.code === 'PERMISSION_DENIED') && _userId) {
          setTimeout(() => {
            if (!_sharedFlowListeners.has(flowId) && _userId) {
              if (__DEV__) console.log(`[FlowSync] refreshSharedFlowListener retrying for ${flowId}`);
              refreshSharedFlowListener(ownerUid, flowId, role, order);
            }
          }, 2000);
        }
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
  if (!flow) return;
  const ownerUid = flow._ownerUid || _userId;
  const isOwner = !flow._ownerUid || ownerUid === _userId;
  const isEditor = flow._role === 'editor';

  if (!isOwner && !isEditor) {
    if (__DEV__) console.log('[FlowSync] updateFlowDoc skipped: User has no edit permission (Role: ' + flow._role + ')');
    return;
  }
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
  const { id, ...rest } = flow;
  // Firestore는 undefined 값을 허용하지 않으므로 제거, _role/_ownerUid/_permissions 메타 필드 제외
  const cleanData = Object.fromEntries(
    Object.entries(_stripMeta(rest)).filter(([, v]) => v !== undefined)
  );
  try {
    if (__DEV__) console.log(`[FlowSync] Attempting update on: users/${ownerUid}/flows/${id}`, cleanData);
    await firestore().collection('users').doc(ownerUid).collection('flows').doc(id).set(cleanData, { merge: true });
    if (__DEV__) console.log('[FlowSync] Firestore update success for flow:', id);
  } catch (e) {
    if (__DEV__) {
      console.error('[FlowSync] Firestore update FAILED:', e);
      console.error('[FlowSync] Target Path:', `users/${ownerUid}/flows/${id}`);
      console.error('[FlowSync] Current User:', _userId);
      console.error('[FlowSync] Flow Role:', flow._role);
    }
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
    const json = await AsyncStorage.getItem(getFlowsStorageKey(_userId));
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
  // 드래그 순서대로 강제 순번 할당
  const ordered = arr.map((f, i) => ({ ...f, order: i }));
  
  // ownFlows: _ownerUid가 없거나 _role이 'owner'인 경우
  const ownFlows = ordered.filter(f => !f._ownerUid || f._role === 'owner').map(_stripMeta);
  // sharedFlows: _ownerUid가 있거나 _role이 'owner'가 아닌 경우
  const sharedFlows = ordered.filter(f => f._ownerUid || (f._role && f._role !== 'owner'));

  if (__DEV__) {
    console.log('[FlowSync] saveFlows sync', {
      total: arr.length,
      own: ownFlows.length,
      shared: sharedFlows.length,
      sharedIds: sharedFlows.map(f => f.id)
    });
  }

  _ownFlows = ownFlows;
  _sharedFlowsData = sharedFlows;

  _mergeAndNotify();

  if (_userId) {
    try {
      if (__DEV__) console.log('[FlowSync] saveFlows - Syncing to Firestore...', { count: ordered.length });
      await _saveAllFlowOrdersToFirestore(_userId, ordered);
    } catch (e) {
      if (__DEV__) console.warn('[FlowSync] saveFlows Firestore error:', e);
    }
  }
  try {
    await AsyncStorage.setItem(getFlowsStorageKey(_userId), JSON.stringify(ownFlows));
  } catch (e) {
    if (__DEV__) console.error('[FlowSync] saveFlows AsyncStorage error:', e);
  }
};

export const addFlow = async (flow) => {
  const current = await getFlows(); // already sorted by user's custom order
  const ownFlows = current.filter(f => !f._ownerUid);
  await saveFlows([flow, ...ownFlows]);
  // Return new flow at top, then all existing flows (own+shared) in their original order
  return [{ ...flow, _role: 'owner' }, ...current];
};

export const deleteFlow = async (id) => {
  // Optimistic update: remove from cache immediately so getFlows() is never stale
  _ownFlows = (_ownFlows || []).filter(f => f.id !== id);
  _mergeAndNotify();

  if (_userId) {
    try {
      if (__DEV__) console.log('[FlowSync] deleteFlow - Deleting from Firestore...', { id });
      const membersSnapshot = await _flowsCollection(_userId).doc(id).collection('members').get();
      const batch = firestore().batch();

      // Delete the flow doc itself
      batch.delete(_flowsCollection(_userId).doc(id));

      // For each member, delete their sharedFlows pointer and the member doc
      membersSnapshot.docs.forEach(memberDoc => {
        const memberUid = memberDoc.id;
        batch.delete(
          firestore().collection('users').doc(memberUid).collection('sharedFlows').doc(id)
        );
        batch.delete(
          _flowsCollection(_userId).doc(id).collection('members').doc(memberUid)
        );
      });

      await batch.commit();
      if (__DEV__) console.log('[FlowSync] deleteFlow - Firestore deletion success.', { memberCount: membersSnapshot.size });
    } catch (e) {
      if (__DEV__) console.warn('[FlowSync] deleteFlow Firestore error:', e);
    }
  }
  try {
    if (_userId) {
      const json = await AsyncStorage.getItem(getFlowsStorageKey(_userId));
      const data = json ? JSON.parse(json) : [];
      const filtered = data.filter(f => f.id !== id);
      await AsyncStorage.setItem(getFlowsStorageKey(_userId), JSON.stringify(filtered));
      if (__DEV__) console.log('[FlowSync] deleteFlow - AsyncStorage update success.');
    }
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
