import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';

const TASKS_STORAGE_KEY = '@tasks_v1';
const MIGRATION_KEY_PREFIX = '@tasks_migrated_';

let _userId = null;
let _snapshotListeners = new Set();
let _unsubscribeFirestore = null;
let _cachedTasks = null;

// ─── Internal helpers ─────────────────────────────────────────────────────────

const _tasksCollection = (uid) =>
  firestore().collection('users').doc(uid).collection('tasks');

const _docToTask = (doc) => ({ id: doc.id, ...doc.data() });

const _tasksFromSnapshot = (snapshot) => snapshot.docs.map(_docToTask);

const _batchWrite = async (uid, toSet = [], toDelete = []) => {
  const col = _tasksCollection(uid);
  const allOps = [
    ...toSet.map(({ id, ...data }) => ({ type: 'set', id, data: { ...data, ownerId: uid } })),
    ...toDelete.map((id) => ({ type: 'delete', id })),
  ];
  for (let i = 0; i < allOps.length; i += 499) {
    const chunk = allOps.slice(i, i + 499);
    const batch = firestore().batch();
    chunk.forEach((op) =>
      op.type === 'set'
        ? batch.set(col.doc(op.id), op.data)
        : batch.delete(col.doc(op.id))
    );
    await batch.commit();
  }
};

const _dateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const _advanceByRepeat = (date, repeat) => {
  const d = new Date(date);
  switch (repeat) {
    case 'daily':   d.setDate(d.getDate() + 1);          break;
    case 'weekly':  d.setDate(d.getDate() + 7);          break;
    case 'monthly': d.setMonth(d.getMonth() + 1);        break;
    case 'yearly':  d.setFullYear(d.getFullYear() + 1);  break;
  }
  return d;
};

// ─── One-time migration ───────────────────────────────────────────────────────

const _migrateIfNeeded = async (uid) => {
  try {
    const migrationKey = `${MIGRATION_KEY_PREFIX}${uid}`;
    const alreadyMigrated = await AsyncStorage.getItem(migrationKey);
    if (alreadyMigrated) return;

    const localJson = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
    const localTasks = localJson ? JSON.parse(localJson) : [];

    if (localTasks.length > 0) {
      const snapshot = await _tasksCollection(uid).limit(1).get();
      if (snapshot.empty) {
        await _batchWrite(uid, localTasks, []);
      }
    }

    await AsyncStorage.setItem(migrationKey, '1');
  } catch (e) {
    console.warn('[TaskSync] Migration error:', e);
  }
};

// ─── Snapshot subscription ────────────────────────────────────────────────────

const _startFirestoreSubscription = (uid) => {
  if (_unsubscribeFirestore) {
    _unsubscribeFirestore();
    _unsubscribeFirestore = null;
  }

  _unsubscribeFirestore = _tasksCollection(uid).onSnapshot(
    (snapshot) => {
      const tasks = _tasksFromSnapshot(snapshot);
      _cachedTasks = tasks;
      _snapshotListeners.forEach((cb) => cb(tasks));
    },
    (error) => {
      console.warn('[TaskSync] Firestore snapshot error:', error);
    }
  );
};

// ─── Public lifecycle API ─────────────────────────────────────────────────────

export const initTaskSync = async (uid) => {
  _userId = uid;
  _cachedTasks = null;

  if (uid) {
    await _migrateIfNeeded(uid);
    _startFirestoreSubscription(uid);
  } else {
    if (_unsubscribeFirestore) {
      _unsubscribeFirestore();
      _unsubscribeFirestore = null;
    }
    _cachedTasks = null;
    _snapshotListeners.forEach((cb) => cb(null));
  }
};

export const subscribeToTasks = (callback) => {
  _snapshotListeners.add(callback);
  if (_cachedTasks !== null) callback(_cachedTasks);
  return () => _snapshotListeners.delete(callback);
};

// ─── Read ─────────────────────────────────────────────────────────────────────

export const getTasks = async () => {
  if (_userId) {
    try {
      if (_cachedTasks !== null) return _cachedTasks;
      const snapshot = await _tasksCollection(_userId).get();
      const tasks = _tasksFromSnapshot(snapshot);
      _cachedTasks = tasks;
      return tasks;
    } catch (e) {
      console.warn('[TaskSync] getTasks Firestore error, falling back:', e);
    }
  }
  try {
    const json = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('[TaskSync] getTasks AsyncStorage error:', e);
    return [];
  }
};

// ─── saveTasks: full rewrite (migration & internal bulk use only) ─────────────

export const saveTasks = async (tasks) => {
  const arr = Array.isArray(tasks) ? tasks : [];
  if (_userId) {
    try {
      const toDelete = (_cachedTasks || [])
        .filter((t) => !arr.some((n) => n.id === t.id))
        .map((t) => t.id);
      await _batchWrite(_userId, arr, toDelete);
      _cachedTasks = arr;
      return true;
    } catch (e) {
      console.warn('[TaskSync] saveTasks Firestore error, falling back:', e);
    }
  }
  try {
    await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(arr));
    return true;
  } catch (e) {
    console.error('[TaskSync] saveTasks AsyncStorage error:', e);
    return false;
  }
};

// ─── Single-task operations → 1 Firestore op each ────────────────────────────

export const addTask = async (taskData) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const newTask = {
    ...taskData,
    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
    isCompleted: false,
    createdAt: now,
    updatedAt: now,
  };
  const updated = [...tasks, newTask];

  if (_userId) {
    try {
      const { id, ...data } = newTask;
      await _tasksCollection(_userId).doc(id).set({ ...data, ownerId: _userId });
      _cachedTasks = updated;
      return updated;
    } catch (e) {
      console.warn('[TaskSync] addTask Firestore error, falling back:', e);
    }
  }
  await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const toggleTaskCompletion = async (taskId) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return tasks;
  const updated = tasks.map((t) =>
    t.id === taskId ? { ...t, isCompleted: !t.isCompleted, updatedAt: now } : t
  );

  if (_userId) {
    try {
      await _tasksCollection(_userId).doc(taskId).update({
        isCompleted: !task.isCompleted,
        updatedAt: now,
      });
      _cachedTasks = updated;
      return updated;
    } catch (e) {
      console.warn('[TaskSync] toggleTaskCompletion Firestore error, falling back:', e);
    }
  }
  await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const deleteTask = async (taskId) => {
  const tasks = await getTasks();
  const updated = tasks.filter((t) => t.id !== taskId);

  if (_userId) {
    try {
      await _tasksCollection(_userId).doc(taskId).delete();
      _cachedTasks = updated;
      return updated;
    } catch (e) {
      console.warn('[TaskSync] deleteTask Firestore error, falling back:', e);
    }
  }
  await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const updateTask = async (taskId, updates) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const updated = tasks.map((t) =>
    t.id === taskId ? { ...t, ...updates, updatedAt: now } : t
  );

  if (_userId) {
    try {
      await _tasksCollection(_userId).doc(taskId).update({ ...updates, updatedAt: now });
      _cachedTasks = updated;
      return updated;
    } catch (e) {
      console.warn('[TaskSync] updateTask Firestore error, falling back:', e);
    }
  }
  await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

// ─── Repeat-series operations → batch (N ops, unavoidable) ───────────────────

export const addRepeatTasks = async (taskData, repeat, repeatEndDate) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const groupId = `rg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const startDate = new Date(taskData.date + 'T12:00:00');
  const taskEnd = taskData.endDate ? new Date(taskData.endDate + 'T12:00:00') : startDate;
  const durationMs = taskEnd - startDate;
  const repeatEnd = new Date(repeatEndDate + 'T12:00:00');
  const MAX_OCCURRENCES = 400;

  const newTasks = [];
  let current = new Date(startDate);
  while (current <= repeatEnd && newTasks.length < MAX_OCCURRENCES) {
    const occStartStr = _dateStr(current);
    const occEndStr = _dateStr(new Date(current.getTime() + durationMs));
    newTasks.push({
      ...taskData,
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${newTasks.length}`,
      date: occStartStr,
      endDate: occEndStr,
      repeat,
      repeatEndDate,
      repeatGroupId: groupId,
      isRepeatMaster: newTasks.length === 0,
      isCompleted: false,
      createdAt: now,
      updatedAt: now,
    });
    current = _advanceByRepeat(current, repeat);
  }

  const updated = [...tasks, ...newTasks];

  if (_userId) {
    try {
      await _batchWrite(_userId, newTasks, []);
      _cachedTasks = updated;
      return updated;
    } catch (e) {
      console.warn('[TaskSync] addRepeatTasks Firestore error, falling back:', e);
    }
  }
  await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const deleteRepeatTasks = async (taskId, scope) => {
  const tasks = await getTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return tasks;

  let updated;
  if (scope === 'this') {
    updated = tasks.filter((t) => t.id !== taskId);
  } else if (scope === 'future') {
    updated = tasks.filter(
      (t) => !(t.repeatGroupId === task.repeatGroupId && t.date >= task.date)
    );
  } else {
    updated = tasks.filter((t) => t.repeatGroupId !== task.repeatGroupId);
  }

  if (_userId) {
    try {
      const updatedIds = new Set(updated.map((t) => t.id));
      const toDelete = tasks.filter((t) => !updatedIds.has(t.id)).map((t) => t.id);
      await _batchWrite(_userId, [], toDelete);
      _cachedTasks = updated;
      return updated;
    } catch (e) {
      console.warn('[TaskSync] deleteRepeatTasks Firestore error, falling back:', e);
    }
  }
  await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const updateRepeatSeriesEndDate = async (taskId, newRepeatEndDate) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const task = tasks.find((t) => t.id === taskId);
  if (!task || !task.repeatGroupId) return tasks;

  const groupId = task.repeatGroupId;
  const repeat = task.repeat;
  const groupTasks = tasks
    .filter((t) => t.repeatGroupId === groupId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const master = groupTasks.find((t) => t.isRepeatMaster) || groupTasks[0];
  const masterStart = new Date(master.date + 'T12:00:00');
  const masterEndObj = master.endDate ? new Date(master.endDate + 'T12:00:00') : masterStart;
  const durationMs = masterEndObj - masterStart;
  const newRepeatEnd = new Date(newRepeatEndDate + 'T12:00:00');
  const lastDate = new Date(groupTasks[groupTasks.length - 1].date + 'T12:00:00');

  let remaining = tasks.filter((t) => {
    if (t.repeatGroupId !== groupId) return true;
    if (t.isRepeatMaster) return true;
    return t.date <= newRepeatEndDate;
  });
  remaining = remaining.map((t) =>
    t.repeatGroupId === groupId ? { ...t, repeatEndDate: newRepeatEndDate, updatedAt: now } : t
  );

  const newOccurrences = [];
  if (newRepeatEnd > lastDate) {
    let current = _advanceByRepeat(new Date(lastDate), repeat);
    while (current <= newRepeatEnd && newOccurrences.length < 400) {
      newOccurrences.push({
        ...master,
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}_ext_${newOccurrences.length}`,
        date: _dateStr(current),
        endDate: _dateStr(new Date(current.getTime() + durationMs)),
        repeatEndDate: newRepeatEndDate,
        isRepeatMaster: false,
        isCompleted: false,
        createdAt: now,
        updatedAt: now,
      });
      current = _advanceByRepeat(current, repeat);
    }
  }

  const updated = [...remaining, ...newOccurrences];

  if (_userId) {
    try {
      const updatedIds = new Set(remaining.map((t) => t.id));
      const toDelete = tasks
        .filter((t) => t.repeatGroupId === groupId && !updatedIds.has(t.id))
        .map((t) => t.id);
      // updated group tasks + new occurrences to set
      const toSet = [
        ...remaining.filter((t) => t.repeatGroupId === groupId),
        ...newOccurrences,
      ];
      await _batchWrite(_userId, toSet, toDelete);
      _cachedTasks = updated;
      return updated;
    } catch (e) {
      console.warn('[TaskSync] updateRepeatSeriesEndDate Firestore error, falling back:', e);
    }
  }
  await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};

export const updateRepeatTasks = async (taskId, updates, scope) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return tasks;

  const { date: _d, endDate: _ed, ...sharedUpdates } = updates;
  const oldDateMs = new Date(task.date + 'T12:00:00').getTime();
  const editDateMs = new Date(updates.date + 'T12:00:00').getTime();
  const dateShiftMs = editDateMs - oldDateMs;
  const editEndDateMs = updates.endDate ? new Date(updates.endDate + 'T12:00:00').getTime() : null;
  const durationMs = editEndDateMs !== null ? editEndDateMs - editDateMs : null;

  let updated;
  if (scope === 'this') {
    updated = tasks.map((t) => (t.id === taskId ? { ...t, ...updates, updatedAt: now } : t));
  } else if (scope === 'future') {
    updated = tasks.map((t) => {
      if (t.repeatGroupId !== task.repeatGroupId || t.date < task.date) return t;
      if (t.id === taskId) return { ...t, ...updates, updatedAt: now };
      const stepMs = new Date(t.date + 'T12:00:00').getTime() + dateShiftMs;
      const newEndDate = durationMs !== null
        ? _dateStr(new Date(stepMs + durationMs))
        : t.endDate ? _dateStr(new Date(new Date(t.endDate + 'T12:00:00').getTime() + dateShiftMs)) : null;
      return { ...t, ...sharedUpdates, date: _dateStr(new Date(stepMs)), endDate: newEndDate, updatedAt: now };
    });
  } else {
    updated = tasks.map((t) => {
      if (t.repeatGroupId !== task.repeatGroupId) return t;
      if (t.id === taskId) return { ...t, ...updates, updatedAt: now };
      const stepMs = new Date(t.date + 'T12:00:00').getTime() + dateShiftMs;
      const newEndDate = durationMs !== null
        ? _dateStr(new Date(stepMs + durationMs))
        : t.endDate ? _dateStr(new Date(new Date(t.endDate + 'T12:00:00').getTime() + dateShiftMs)) : null;
      return { ...t, ...sharedUpdates, date: _dateStr(new Date(stepMs)), endDate: newEndDate, updatedAt: now };
    });
  }

  if (_userId) {
    try {
      // Only write tasks that actually changed
      const changedTasks = updated.filter((t) => {
        const orig = tasks.find((o) => o.id === t.id);
        return orig && orig.updatedAt !== t.updatedAt;
      });
      await _batchWrite(_userId, changedTasks, []);
      _cachedTasks = updated;
      return updated;
    } catch (e) {
      console.warn('[TaskSync] updateRepeatTasks Firestore error, falling back:', e);
    }
  }
  await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(updated));
  return updated;
};
