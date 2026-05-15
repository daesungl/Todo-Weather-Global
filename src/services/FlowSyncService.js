import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getPlanSteps as getSupabasePlanSteps,
  listPlans as listSupabasePlans,
  markPlanRead as markSupabasePlanRead,
  replacePlanSteps as replaceSupabasePlanSteps,
  deletePlan as deleteSupabasePlan,
  leavePlan as leaveSupabasePlan,
  savePlan as saveSupabasePlan,
  updatePlanOrders as updateSupabasePlanOrders,
} from './supabase/PlanApiService';
import { supabase } from '../config/supabaseConfig';

const getFlowsStorageKey = (uid) => `@todo_weather_flows_${uid || 'guest'}`;
const getSharedFlowsStorageKey = (uid) => `@todo_weather_shared_flows_${uid}`;
const getDeletedFlowsStorageKey = (uid) => `@todo_weather_deleted_flows_${uid || 'guest'}`;

let _userId = null;
let _snapshotListeners = new Set();
let _membershipPollInterval = null;
let _flowRefs = new Map();
let _flowDocs = new Map();
let _flowSteps = new Map();
let _deletedStepIds = new Map();
let _lastOptimisticUpdateMs = new Map();
let _cachedFlows = null;
let _isRemoteUpdate = false;
let _initPromise = null;
let _initUid = null;
let _lastUserOrderChangeMs = 0;
let _pendingDeletes = new Set();
let _deletedFlowIds = new Set();

export const isRemoteFlowUpdate = () => _isRemoteUpdate;

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

const _stopMembershipPoll = () => {
  if (_membershipPollInterval) {
    if (typeof _membershipPollInterval.clear === 'function') {
      _membershipPollInterval.clear();
    } else {
      clearInterval(_membershipPollInterval);
    }
    _membershipPollInterval = null;
  }
};

const _isValidPlanId = (id) => id && /^\d+$/.test(String(id));

const _loadDeletedFlowIds = async (uid) => {
  if (!uid) return new Set();
  try {
    const json = await AsyncStorage.getItem(getDeletedFlowsStorageKey(uid));
    const ids = json ? JSON.parse(json) : [];
    return new Set(Array.isArray(ids) ? ids.filter(Boolean).map(String) : []);
  } catch (e) {
    console.warn('[FlowSync] deleted flow tombstone load error:', e);
    return new Set();
  }
};

const _saveDeletedFlowIds = async () => {
  if (!_userId) return;
  try {
    await AsyncStorage.setItem(getDeletedFlowsStorageKey(_userId), JSON.stringify(Array.from(_deletedFlowIds)));
  } catch (e) {
    console.warn('[FlowSync] deleted flow tombstone save error:', e);
  }
};

const _rememberDeletedFlowId = (flowId) => {
  if (!flowId) return;
  _deletedFlowIds.add(String(flowId));
  _pendingDeletes.add(String(flowId));
  _saveDeletedFlowIds();
};

const _forgetDeletedFlowId = (flowId) => {
  if (!flowId) return;
  _deletedFlowIds.delete(String(flowId));
  _pendingDeletes.delete(String(flowId));
  _saveDeletedFlowIds();
};

const _filterDeletedFlows = (flows = []) =>
  (Array.isArray(flows) ? flows : []).filter(flow => flow?.id && !_deletedFlowIds.has(String(flow.id)));

const _startMembershipPoll = (uid) => {
  _stopMembershipPoll();
  if (!uid) return;

  let channelPlans;
  let channelMembers;

  const load = async () => {
    if (!_userId) return;
    try {
      const plans = await listSupabasePlans();
      // 유효한 플랜 ID만 허용 (숫자 타임스탬프 ID)
      const validPlans = _filterDeletedFlows(plans.filter(p => p.id && /^\d+$/.test(String(p.id))));
      const returnedIds = new Set(validPlans.map(p => p.id));
      const toRevoke = [];
      for (const [flowId, ref] of _flowRefs.entries()) {
        if (!returnedIds.has(flowId)) toRevoke.push(flowId);
      }
      toRevoke.forEach(flowId => _dropInaccessibleFlow(flowId, 'membership revoked'));
      const staleStepPlanIds = [];
      validPlans.forEach(plan => {
        if (_pendingDeletes.has(plan.id)) return;
        // Skip overwriting order if user reordered cards recently (within 5 seconds)
        const userJustReordered = (Date.now() - _lastUserOrderChangeMs) < 5000;
        const existingRef = _flowRefs.get(plan.id);
        const existingDoc = _flowDocs.get(plan.id);

        // Detect remote step changes (another member added/edited steps)
        if (plan.stepsUpdatedAt && existingDoc?.stepsUpdatedAt !== plan.stepsUpdatedAt) {
          const lastOptMs = _lastOptimisticUpdateMs.get(plan.id) || 0;
          if (Date.now() - lastOptMs > 3000) staleStepPlanIds.push(plan.id);
        }

        const normalized = {
          ...plan,
          _ownerUid: plan.ownerUid && plan.ownerUid !== uid ? plan.ownerUid : undefined,
          _role: plan._role || (plan.ownerUid === uid ? 'owner' : 'viewer'),
          order: userJustReordered && existingRef ? existingRef.order : (plan.order ?? 1000000),
        };
        _flowRefs.set(plan.id, {
          flowId: plan.id,
          ownerUid: plan.ownerUid,
          role: normalized._role,
          permissions: normalized._permissions,
          order: normalized.order,
          joinedAt: normalized._joinedAt,
          lastReadStepsAt: normalized._lastReadStepsAt,
          lastReadCommentsAt: normalized._lastReadCommentsAt,
        });
        // Merge: prefer existing doc data for title/content if we just added this plan (within 15s)
        const mergedDoc = (userJustReordered && existingDoc && existingDoc.title)
          ? { ...plan, ...existingDoc, order: normalized.order, id: plan.id }
          : { ...(existingDoc || {}), ...normalized, order: normalized.order, id: plan.id };
        _flowDocs.set(plan.id, mergedDoc);
      });
      _mergeAndNotify(true);

      if (staleStepPlanIds.length > 0) {
        await Promise.all(staleStepPlanIds.map(planId =>
          getSupabasePlanSteps(planId)
            .then(steps => {
              const sorted = _sortSteps(_filterDeletedSteps(planId, steps));
              _flowSteps.set(planId, sorted);
            })
            .catch(e => console.warn('[FlowSync] steps refresh error:', planId, e))
        ));
        _mergeAndNotify(true);
      }
    } catch (e) {
      console.warn('[FlowSync] membership poll error:', e);
    }
  };

  load();

  if (supabase) {
    channelPlans = supabase
      .channel('public:plans:user')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, () => {
        load();
      })
      .subscribe();

    channelMembers = supabase
      .channel(`public:plan_members:uid=eq.${uid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_members', filter: `uid=eq.${uid}` }, () => {
        load();
      })
      .subscribe();
  }

  _membershipPollInterval = {
    clear: () => {
      if (channelPlans) supabase.removeChannel(channelPlans);
      if (channelMembers) supabase.removeChannel(channelMembers);
    }
  };
};

const _dropInaccessibleFlow = (flowId, reason = 'inaccessible') => {
  if (!flowId) return;
  console.warn('[FlowSync] dropping inaccessible flowRef', { flowId, reason });
  _flowRefs.delete(flowId);
  _flowDocs.delete(flowId);
  _flowSteps.delete(flowId);
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

const _normalizeForCompare = (value) => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value?.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (Array.isArray(value)) return value.map(_normalizeForCompare);
  if (_isPlainObject(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, _normalizeForCompare(value[key])])
        .filter(([, child]) => child !== undefined)
    );
  }
  return value;
};

const _stableStringify = (value) =>
  JSON.stringify(_normalizeForCompare(_cleanForFirestore(value)));

const _stepsSignature = (flowId, steps = []) =>
  _stableStringify(
    _filterDeletedSteps(flowId, steps).map((step, index) => ({
      id: step.id,
      data: _cleanStepData(step, index),
    }))
  );

const _haveStepsChanged = (flowId, previousSteps, nextSteps) => {
  if (!Array.isArray(previousSteps)) return true;
  return _stepsSignature(flowId, previousSteps) !== _stepsSignature(flowId, nextSteps);
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
  if (_deletedFlowIds.has(String(flowId))) return null;
  const ref = _flowRefs.get(flowId);
  const doc = _flowDocs.get(flowId);
  if (!ref || !doc) return null;

  const role = ref.role || (doc.ownerUid === _userId ? 'owner' : 'viewer');
  const flow = {
    id: flowId,
    title: doc.title || '제목 없는 플로우',
    ...doc,
    steps: _sortSteps(_filterDeletedSteps(flowId, _flowSteps.get(flowId) || [])),
    _role: role,
    _permissions: ref.permissions,
    _joinedAt: ref.joinedAt,
    _lastReadStepsAt: ref.lastReadStepsAt,
    _lastReadCommentsAt: ref.lastReadCommentsAt,
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

const _loadRemoteFlows = async (uid) => {
  const plans = await listSupabasePlans();
  // 유효한 플랜 ID만 허용 (숫자 타임스탬프 ID)
  const validPlans = _filterDeletedFlows(plans.filter(p => p.id && /^\d+$/.test(String(p.id))));
  const normalizedPlans = validPlans.map(plan => ({
    ...plan,
    _ownerUid: plan.ownerUid && plan.ownerUid !== uid ? plan.ownerUid : undefined,
    _role: plan._role || (plan.ownerUid === uid ? 'owner' : 'viewer'),
  }));
  const plansWithSteps = await Promise.all(normalizedPlans.map(async (plan) => {
    try {
      const steps = await getSupabasePlanSteps(plan.id);
      return { ...plan, steps };
    } catch (e) {
      console.warn('[FlowSync] Supabase initial steps load failed:', plan.id, e);
      return { ...plan, steps: [] };
    }
  }));
  for (const plan of plansWithSteps) {
    _flowRefs.set(plan.id, {
      flowId: plan.id,
      ownerUid: plan.ownerUid,
      role: plan._role,
      permissions: plan._permissions,
      order: plan.order ?? 1000000,
      joinedAt: plan._joinedAt,
      lastReadStepsAt: plan._lastReadStepsAt,
      lastReadCommentsAt: plan._lastReadCommentsAt,
    });
    _flowDocs.set(plan.id, { ...plan, id: plan.id });
    _flowSteps.set(plan.id, _sortSteps(_filterDeletedSteps(plan.id, plan.steps || [])));
  }
  const returnedIds = new Set(plansWithSteps.map(plan => plan.id));
  for (const flowId of Array.from(_flowRefs.keys())) {
    if (!returnedIds.has(flowId)) {
      _flowRefs.delete(flowId);
      _flowDocs.delete(flowId);
      _flowSteps.delete(flowId);
    }
  }
  _cachedFlows = plansWithSteps
    .map(plan => ({ ...plan, steps: _sortSteps(_filterDeletedSteps(plan.id, plan.steps || [])) }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return _cachedFlows;
};

const _initFlowSyncInternal = async (uid) => {
  _userId = uid;
  _flowRefs = new Map();
  _flowDocs = new Map();
  _flowSteps = new Map();
  _deletedFlowIds = await _loadDeletedFlowIds(uid);
  _cachedFlows = null;
  _stopMembershipPoll();

  if (uid) {
    // 1. 로컬 캐시를 먼저 로드해서 UI를 즉시 표시
    try {
      const localJson = await AsyncStorage.getItem(getFlowsStorageKey(uid));
      const sharedJson = await AsyncStorage.getItem(getSharedFlowsStorageKey(uid));
      const localOwn = localJson ? JSON.parse(localJson) : [];
      const localShared = sharedJson ? JSON.parse(sharedJson) : [];
      const localAll = [
        ...(Array.isArray(localOwn) ? localOwn : []),
        ...(Array.isArray(localShared) ? localShared : []),
      ].filter(f => _isValidPlanId(f.id))
        .filter(f => !_deletedFlowIds.has(String(f.id)))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      // 유효하지 않은 ID가 있는 경우 정리된 데이터를 로컬 저장
      const hasInvalid = (Array.isArray(localOwn) ? localOwn : []).some(f => !_isValidPlanId(f.id))
        || (Array.isArray(localShared) ? localShared : []).some(f => !_isValidPlanId(f.id));
      if (hasInvalid) {
        const cleanOwn = (Array.isArray(localOwn) ? localOwn : []).filter(f => _isValidPlanId(f.id));
        const cleanShared = (Array.isArray(localShared) ? localShared : []).filter(f => _isValidPlanId(f.id));
        AsyncStorage.setItem(getFlowsStorageKey(uid), JSON.stringify(cleanOwn)).catch(() => {});
        AsyncStorage.setItem(getSharedFlowsStorageKey(uid), JSON.stringify(cleanShared)).catch(() => {});
      }
      if (localAll.length > 0) {
        // 로컬 데이터를 메모리에 반영하여 UI 즉시 표시
        localAll.forEach(flow => {
          _flowRefs.set(flow.id, {
            flowId: flow.id,
            ownerUid: flow._ownerUid || flow.ownerUid || uid,
            role: flow._role || 'owner',
            permissions: flow._permissions,
            order: flow.order ?? 0,
          });
          _flowDocs.set(flow.id, { ...flow, id: flow.id });
          _flowSteps.set(flow.id, _sortSteps(_filterDeletedSteps(flow.id, flow.steps || [])));
        });
        _cachedFlows = localAll;
        _snapshotListeners.forEach(cb => cb(localAll));
      }
    } catch (e) {
      console.warn('[FlowSync] local cache load error:', e);
    }

    // 2. 서버에서 최신 데이터 받아서 차이만 업데이트
    try {
      const flows = await _loadRemoteFlows(uid);
      _snapshotListeners.forEach(cb => cb(flows));
    } catch (e) {
      console.warn('[FlowSync] initial load error:', e);
    }
    _startMembershipPoll(uid);
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

export const subscribeToFlowSteps = (flowId, callback) => {
  if (!flowId) return () => {};

  const cachedSteps = _sortSteps(_filterDeletedSteps(flowId, _flowSteps.get(flowId) || []));
  if (callback) callback(cachedSteps);

  const flow = _flowFromParts(flowId);
  if (!flow) {
    if (callback) callback([]);
    return () => {};
  }
  let cancelled = false;
  let previousSignature = _stepsSignature(flowId, cachedSteps);

  const load = () => {
    getSupabasePlanSteps(flowId).then(steps => {
      if (cancelled) return;
      // Ignore server data if we made a local update within the last 6 seconds
      const lastOptMs = _lastOptimisticUpdateMs.get(flowId) || 0;
      if (Date.now() - lastOptMs < 6000) return;

      const sortedSteps = _sortSteps(_filterDeletedSteps(flowId, steps));
      const nextSignature = _stepsSignature(flowId, sortedSteps);
      if (nextSignature === previousSignature) return;
      previousSignature = nextSignature;
      _flowSteps.set(flowId, sortedSteps);
      _mergeAndNotify(true);
      if (callback) callback(sortedSteps);
    }).catch(err => {
      if (err?.status === 403) {
        _dropInaccessibleFlow(flowId, 'supabase steps permission-denied');
        if (callback) callback([]);
        return;
      }
      console.warn('[FlowSync] Supabase steps load failed:', err);
    });
  };

  load();

  let channel;
  if (supabase) {
    channel = supabase
      .channel(`public:plan_steps:plan_id=eq.${flowId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'plan_steps',
          filter: `plan_id=eq.${flowId}`,
        },
        () => {
          const lastOptMs = _lastOptimisticUpdateMs.get(flowId) || 0;
          if (Date.now() - lastOptMs < 3000) return; // 실시간이므로 보호 시간 단축 (6초 -> 3초)
          load();
        }
      )
      .subscribe();
  }

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
};

export const refreshSharedFlowListener = (ownerUid, flowId, role, order) => {
  if (!_userId || !flowId) return;
  _forgetDeletedFlowId(flowId);
  _loadRemoteFlows(_userId)
    .then(flows => {
      if (order !== undefined && _flowRefs.has(flowId)) {
        const ref = _flowRefs.get(flowId);
        _flowRefs.set(flowId, { ...ref, order });
        const doc = _flowDocs.get(flowId);
        if (doc) _flowDocs.set(flowId, { ...doc, order });
        const sorted = Array.from(_flowRefs.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        updateSupabasePlanOrders(sorted.map(r => ({ plan_id: r.flowId, sort_order: r.order })))
          .catch(e => console.warn('[FlowSync] updatePlanOrders after join failed:', e));
        _mergeAndNotify(true);
      } else {
        _snapshotListeners.forEach(cb => cb(flows));
      }
    })
    .catch(e => console.warn('[FlowSync] Supabase refresh flow failed:', e));
};

export const markFlowRead = async (flowId, options = {}) => {
  if (!_userId || !flowId) return;
  const now = new Date();
  const localUpdates = { updatedAt: now.toISOString() };

  if (options.steps !== false) {
    localUpdates.lastReadStepsAt = now.toISOString();
  }
  if (options.comments !== false) {
    localUpdates.lastReadCommentsAt = now.toISOString();
  }

  _flowRefs.set(flowId, {
    ...(_flowRefs.get(flowId) || { flowId }),
    ...localUpdates,
  });
  _mergeAndNotify();

  try {
    await markSupabasePlanRead(flowId, options);
  } catch (e) {
    console.warn('[FlowSync] markFlowRead failed:', e);
  }
};

export const removeSharedFlowOptimistic = (flowId) => {
  _rememberDeletedFlowId(flowId);
  _flowRefs.delete(flowId);
  _flowDocs.delete(flowId);
  _flowSteps.delete(flowId);
  _mergeAndNotify();
};

export const updateFlowDoc = async (flow, options = {}) => {
  if (!flow || !_userId) return;
  _lastOptimisticUpdateMs.set(flow.id, Date.now());
  const {
    syncSteps = true,
    markStepsUpdated = true,
    optimistic = true,
  } = options || {};

  // Capture previous steps BEFORE updating local state (needed for change detection below)
  const previousSteps = syncSteps && Array.isArray(flow.steps)
    ? _flowSteps.get(flow.id)
    : null;

  // For most interactions we keep optimistic updates. For step creation/editing
  // we can opt out so the modal stays in a saving state until Supabase confirms,
  // preventing the realtime listener from briefly restoring the previous list.
  if (optimistic && syncSteps && Array.isArray(flow.steps)) {
    _flowSteps.set(flow.id, _sortSteps(_filterDeletedSteps(flow.id, flow.steps || [])));
  }

  await saveSupabasePlan(flow);
  _flowDocs.set(flow.id, {
    ...(_flowDocs.get(flow.id) || {}),
    id: flow.id,
    ..._cleanFlowDocData(flow),
    ownerUid: flow._ownerUid || flow.ownerUid || _userId,
  });
  if (syncSteps && Array.isArray(flow.steps)) {
    const stepsChanged = _haveStepsChanged(flow.id, previousSteps, flow.steps || []);
    if (stepsChanged) {
      await replaceSupabasePlanSteps(flow.id, flow.steps, { markUpdated: markStepsUpdated });
    }
    _flowSteps.set(flow.id, _sortSteps(_filterDeletedSteps(flow.id, flow.steps || [])));
  }
  _mergeAndNotify();
};

export const deleteFlowStepDocs = async (flow, stepIds = []) => {
  if (!flow || !_userId || !flow.id) return false;

  const ids = [...new Set((Array.isArray(stepIds) ? stepIds : [stepIds]).filter(Boolean))];
  if (ids.length === 0) return false;

  // Supabase 쓰기 중 realtime 이벤트가 발생해 load()가 구버전 데이터를 복원하지 않도록 보호
  _lastOptimisticUpdateMs.set(flow.id, Date.now());
  _rememberDeletedStepIds(flow.id, ids);
  _flowSteps.set(flow.id, _sortSteps(_filterDeletedSteps(flow.id, flow.steps || [])));
  _mergeAndNotify();

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
  meta.updatedAt = new Date().toISOString();
  meta.stepsCount = _filterDeletedSteps(flow.id, flow.steps || []).length;

  try {
    await saveSupabasePlan({ ...meta, id: flow.id, ownerUid });
    await replaceSupabasePlanSteps(flow.id, _filterDeletedSteps(flow.id, flow.steps || []));
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
  _flowSteps.set(flow.id, _sortSteps(_filterDeletedSteps(flow.id, flow.steps || [])));
  _mergeAndNotify();
  return true;
};

export const getLocalCachedFlows = async () => {
  if (_cachedFlows !== null) return _cachedFlows;
  try {
    const ownJson = await AsyncStorage.getItem(getFlowsStorageKey(_userId));
    const sharedJson = _userId ? await AsyncStorage.getItem(getSharedFlowsStorageKey(_userId)) : null;
    const own = ownJson ? JSON.parse(ownJson) : [];
    const shared = sharedJson ? JSON.parse(sharedJson) : [];
    return [
      ...(Array.isArray(own) ? own : []),
      ...(Array.isArray(shared) ? shared : []),
    ].filter(f => _isValidPlanId(f.id))
      .filter(f => !_deletedFlowIds.has(String(f.id)))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  } catch {
    return [];
  }
};

// 카드 드래그 순서 변경 전용 - 로컬 즉시 저장 + 서버 백그라운드 저장
export const reorderFlows = async (orderedFlows) => {
  _lastUserOrderChangeMs = Date.now();

  // 메모리 즉시 업데이트
  orderedFlows.forEach((flow, index) => {
    const ref = _flowRefs.get(flow.id);
    if (ref) _flowRefs.set(flow.id, { ...ref, order: index });
    const doc = _flowDocs.get(flow.id);
    if (doc) _flowDocs.set(flow.id, { ...doc, order: index });
  });
  _mergeAndNotify();

  // AsyncStorage에 즉시 저장 (로컬 우선)
  if (_userId) {
    try {
      const withOrder = orderedFlows.map((f, i) => ({ ...f, order: i }));
      const own = withOrder.filter(f => !f._ownerUid || f._role === 'owner');
      const shared = withOrder.filter(f => f._ownerUid && f._role !== 'owner');
      await AsyncStorage.setItem(getFlowsStorageKey(_userId), JSON.stringify(own));
      if (shared.length > 0) {
        await AsyncStorage.setItem(getSharedFlowsStorageKey(_userId), JSON.stringify(shared));
      }
    } catch (e) {
      console.warn('[FlowSync] reorderFlows AsyncStorage error:', e);
    }
  }

  // 서버에 순서 저장 (백그라운드, 실패해도 무방)
  if (_userId) {
    const orderItems = orderedFlows.map((f, i) => ({ plan_id: f.id, sort_order: i }));
    updateSupabasePlanOrders(orderItems)
      .catch(e => console.warn('[FlowSync] reorderFlows server error:', e));
  }
};

export const getFlows = async () => {
  if (_userId) {
    if (_cachedFlows !== null) return _cachedFlows;

    try {
      return await _loadRemoteFlows(_userId);
    } catch (e) {
      console.warn('[FlowSync] getFlows error, falling back:', e);
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
  const arr = _filterDeletedFlows(Array.isArray(flows) ? flows : []);
  const ordered = arr.map((f, i) => ({ ...f, order: i }));
  const ownFlows = ordered.filter(f => !f._ownerUid || f._role === 'owner');
  const sharedFlows = ordered.filter(f => f._ownerUid || (f._role && f._role !== 'owner'));
  const previousFlowSteps = new Map(_flowSteps);

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
      _lastUserOrderChangeMs = Date.now();
      const orderItems = ordered.map(f => ({ plan_id: f.id, sort_order: f.order }));
      await updateSupabasePlanOrders(orderItems).catch(e => console.warn('[FlowSync] update orders failed', e));

      for (const flow of ownFlows) {
        await saveSupabasePlan({ ...flow, _role: 'owner' });
        const previousSteps = previousFlowSteps.get(flow.id);
        const nextSteps = _filterDeletedSteps(flow.id, flow.steps || []);
        if (_haveStepsChanged(flow.id, previousSteps, nextSteps)) {
          await replaceSupabasePlanSteps(flow.id, nextSteps);
        }
      }
      for (const flow of sharedFlows) {
        await saveSupabasePlan(flow);
        if (Array.isArray(flow.steps)) {
          const previousSteps = previousFlowSteps.get(flow.id);
          const nextSteps = _filterDeletedSteps(flow.id, flow.steps || []);
          if (_haveStepsChanged(flow.id, previousSteps, nextSteps)) {
            await replaceSupabasePlanSteps(flow.id, nextSteps);
          }
        }
      }
    } catch (e) {
      console.warn('[FlowSync] saveFlows error:', {
        code: e?.code,
        message: e?.message,
        uid: _userId,
        ownFlowCount: ownFlows.length,
        sharedFlowCount: sharedFlows.length,
        flowIds: ordered.map(flow => flow.id),
      });
      throw e;
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

export const addFlow = async (flow, options = {}) => {
  const { optimistic = true } = options || {};
  _forgetDeletedFlowId(flow.id);
  _lastUserOrderChangeMs = Date.now();
  let minOrder = 0;
  for (const doc of _flowDocs.values()) {
    if (doc.order !== undefined && doc.order < minOrder) minOrder = doc.order;
  }
  for (const ref of _flowRefs.values()) {
    if (ref.order !== undefined && ref.order < minOrder) minOrder = ref.order;
  }
  const newOrder = minOrder - 1;

  _flowRefs.set(flow.id, { flowId: flow.id, ownerUid: _userId, role: 'owner', order: newOrder });
  _flowDocs.set(flow.id, { id: flow.id, ...flow, ownerUid: _userId, order: newOrder });
  _flowSteps.set(flow.id, _filterDeletedSteps(flow.id, flow.steps || []));
  if (optimistic || !_userId) _mergeAndNotify();

  if (_userId) {
    try {
      await saveSupabasePlan({ ...flow, _role: 'owner', order: newOrder });
      await replaceSupabasePlanSteps(flow.id, _filterDeletedSteps(flow.id, flow.steps || []));
      if (!optimistic) _mergeAndNotify();
    } catch (e) {
      console.warn('[FlowSync] addFlow backend save error:', e);
      _flowRefs.delete(flow.id);
      _flowDocs.delete(flow.id);
      _flowSteps.delete(flow.id);
      if (optimistic) _mergeAndNotify();
      throw e;
    }

    try {
      const ownFlows = Array.from(_flowDocs.values())
        .filter(f => !f._ownerUid || f._role === 'owner')
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      await AsyncStorage.setItem(getFlowsStorageKey(_userId), JSON.stringify(ownFlows));
    } catch (e) {
      console.warn('[FlowSync] addFlow AsyncStorage error:', e);
    }
  }

  return _cachedFlows;
};

export const deleteFlow = async (id) => {
  _rememberDeletedFlowId(id);
  const role = _flowRefs.get(id)?.role || _flowDocs.get(id)?._role || 'owner';
  _flowRefs.delete(id);
  _flowDocs.delete(id);
  _flowSteps.delete(id);
  _mergeAndNotify();

  if (_userId) {
    try {
      if (role === 'owner') {
        await deleteSupabasePlan(id);
      } else {
        await leaveSupabasePlan(id);
      }
    } catch (e) {
      if (__DEV__) console.warn('[FlowSync] deleteFlow Supabase error:', e);
    }
  }

  try {
    const ownJson = await AsyncStorage.getItem(getFlowsStorageKey(_userId));
    const sharedJson = _userId ? await AsyncStorage.getItem(getSharedFlowsStorageKey(_userId)) : null;
    const own = ownJson ? JSON.parse(ownJson) : [];
    const shared = sharedJson ? JSON.parse(sharedJson) : [];
    await AsyncStorage.setItem(
      getFlowsStorageKey(_userId),
      JSON.stringify((Array.isArray(own) ? own : []).filter(f => f.id !== id))
    );
    if (_userId) {
      await AsyncStorage.setItem(
        getSharedFlowsStorageKey(_userId),
        JSON.stringify((Array.isArray(shared) ? shared : []).filter(f => f.id !== id))
      );
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
