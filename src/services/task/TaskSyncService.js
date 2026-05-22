import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../config/supabaseConfig';

const TASKS_STORAGE_KEY = '@tasks_v1';
const PENDING_DELETES_KEY = '@tasks_pending_deletes_v1';
const getTasksStorageKey = (uid = _userId) => uid ? `${TASKS_STORAGE_KEY}_${uid}` : TASKS_STORAGE_KEY;
const getPendingDeletesStorageKey = (uid = _userId) => uid ? `${PENDING_DELETES_KEY}_${uid}` : PENDING_DELETES_KEY;

let _userId = null;
let _snapshotListeners = new Set();
let _subscription = null;
let _cachedTasks = null;
let _pendingDeleteIds = new Set();

const _loadPendingDeletes = async () => {
  try {
    const json = await AsyncStorage.getItem(getPendingDeletesStorageKey());
    const ids = json ? JSON.parse(json) : [];
    _pendingDeleteIds = new Set(Array.isArray(ids) ? ids : []);
  } catch {
    _pendingDeleteIds = new Set();
  }
};

const _savePendingDeletes = async () => {
  try {
    await AsyncStorage.setItem(getPendingDeletesStorageKey(), JSON.stringify([..._pendingDeleteIds]));
  } catch {}
};

const _addPendingDeletes = async (ids) => {
  ids.forEach(id => _pendingDeleteIds.add(id));
  await _savePendingDeletes();
};

const _removePendingDeletes = async (ids) => {
  ids.forEach(id => _pendingDeleteIds.delete(id));
  await _savePendingDeletes();
};

const toCamelCase = (dbObj) => {
  if (!dbObj) return null;
  return {
    id: dbObj.id,
    ownerId: dbObj.owner_uid,
    title: dbObj.title,
    memo: dbObj.memo,
    date: dbObj.date,
    time: dbObj.time,
    endDate: dbObj.end_date,
    endTime: dbObj.end_time,
    isAllDay: dbObj.is_all_day,
    repeat: dbObj.repeat,
    repeatEndDate: dbObj.repeat_end_date,
    repeatGroupId: dbObj.repeat_group_id,
    isRepeatMaster: dbObj.is_repeat_master,
    isCompleted: dbObj.is_completed,
    color: dbObj.color,
    notify: dbObj.notify,
    notificationId: dbObj.notification_id,
    locationName: dbObj.location_name,
    weatherRegion: dbObj.weather_region,
    createdAt: dbObj.created_at,
    updatedAt: dbObj.updated_at,
  };
};

const toDbObj = (appObj) => {
  const dbObj = {};
  if (appObj.id !== undefined) dbObj.id = appObj.id;
  if (appObj.ownerId !== undefined) dbObj.owner_uid = appObj.ownerId;
  if (appObj.title !== undefined) dbObj.title = appObj.title || 'Untitled Task';
  if (appObj.memo !== undefined) dbObj.memo = appObj.memo;
  if (appObj.date !== undefined) dbObj.date = appObj.date;
  if (appObj.time !== undefined) dbObj.time = appObj.time;
  if (appObj.endDate !== undefined) dbObj.end_date = appObj.endDate;
  if (appObj.endTime !== undefined) dbObj.end_time = appObj.endTime;
  if (appObj.isAllDay !== undefined) dbObj.is_all_day = appObj.isAllDay;
  if (appObj.repeat !== undefined) dbObj.repeat = appObj.repeat;
  if (appObj.repeatEndDate !== undefined) dbObj.repeat_end_date = appObj.repeatEndDate;
  if (appObj.repeatGroupId !== undefined) dbObj.repeat_group_id = appObj.repeatGroupId;
  if (appObj.isRepeatMaster !== undefined) dbObj.is_repeat_master = appObj.isRepeatMaster;
  if (appObj.isCompleted !== undefined) dbObj.is_completed = appObj.isCompleted;
  if (appObj.color !== undefined) dbObj.color = appObj.color;
  if (appObj.notify !== undefined) dbObj.notify = appObj.notify;
  if (appObj.notificationId !== undefined) dbObj.notification_id = appObj.notificationId;
  if (appObj.locationName !== undefined) dbObj.location_name = appObj.locationName;
  if (appObj.weatherRegion !== undefined) dbObj.weather_region = appObj.weatherRegion;
  return dbObj;
};

const _loadLocalTasks = async () => {
  try {
    const storageKey = getTasksStorageKey();
    const json = await AsyncStorage.getItem(storageKey);
    const legacyJson = storageKey !== TASKS_STORAGE_KEY ? await AsyncStorage.getItem(TASKS_STORAGE_KEY) : null;
    const sourceJson = json || legacyJson;
    const tasks = sourceJson ? JSON.parse(sourceJson) : [];
    return Array.isArray(tasks) ? tasks : [];
  } catch (e) {
    console.error('[TaskSync] local task cache error:', e);
    return [];
  }
};

const _batchWrite = async (uid, toSet = [], toDelete = []) => {
  if (!uid) return;

  if (toDelete.length > 0) {
    for (let i = 0; i < toDelete.length; i += 100) {
      const chunk = toDelete.slice(i, i + 100);
      const { error } = await supabase.from('tasks').delete().in('id', chunk);
      if (error) throw error;
    }
  }

  if (toSet.length > 0) {
    for (let i = 0; i < toSet.length; i += 100) {
      const chunk = toSet.slice(i, i + 100).map(t => toDbObj({ ...t, ownerId: uid }));
      const { error } = await supabase.from('tasks').upsert(chunk, { onConflict: 'id' });
      if (error) throw error;
    }
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

const _startSubscription = async (uid) => {
  if (_subscription) {
    supabase.removeChannel(_subscription);
    _subscription = null;
  }

  const fetchInitial = async () => {
    await _loadPendingDeletes();

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('owner_uid', uid);

    if (error) {
      console.warn('[TaskSync] fetch error:', error);
      return;
    }

    // Retry deletions that failed in a previous session
    if (_pendingDeleteIds.size > 0) {
      const pendingArr = [..._pendingDeleteIds];
      const { data: retried } = await supabase
        .from('tasks')
        .delete()
        .in('id', pendingArr)
        .select('id');
      if (retried && retried.length > 0) {
        await _removePendingDeletes(retried.map(r => r.id));
      }
    }

    const tasks = (data || [])
      .map(toCamelCase)
      .filter(t => !_pendingDeleteIds.has(t.id));
    _cachedTasks = tasks;
    AsyncStorage.setItem(getTasksStorageKey(uid), JSON.stringify(tasks)).catch(() => {});
    _snapshotListeners.forEach((cb) => cb(tasks));
  };

  await fetchInitial();

  _subscription = supabase
    .channel(`public:tasks:owner_uid=eq.${uid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter: `owner_uid=eq.${uid}` }, async (payload) => {
      await fetchInitial();
    })
    .subscribe();
};

export const initTaskSync = async (uid) => {
  _userId = uid;
  _cachedTasks = null;

  if (uid) {
    const localTasks = await _loadLocalTasks();
    _cachedTasks = localTasks;
    _snapshotListeners.forEach((cb) => cb(localTasks));
    await _startSubscription(uid);
  } else {
    if (_subscription) {
      supabase.removeChannel(_subscription);
      _subscription = null;
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

export const getTasks = async () => {
  if (_cachedTasks !== null) return _cachedTasks;

  if (_userId) {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('owner_uid', _userId);
        
      if (!error) {
        const tasks = (data || []).map(toCamelCase);
        _cachedTasks = tasks;
        AsyncStorage.setItem(getTasksStorageKey(_userId), JSON.stringify(tasks)).catch(() => {});
        return tasks;
      }
    } catch (e) {
      console.warn('[TaskSync] getTasks error:', e);
    }
  }
  return _loadLocalTasks();
};

export const saveTasks = async (tasks) => {
  const arr = Array.isArray(tasks) ? tasks : [];
  if (_userId) {
    try {
      const toDelete = (_cachedTasks || [])
        .filter((t) => !arr.some((n) => n.id === t.id))
        .map((t) => t.id);
      await _batchWrite(_userId, arr, toDelete);
      _cachedTasks = arr;
      AsyncStorage.setItem(getTasksStorageKey(), JSON.stringify(arr)).catch(() => {});
      return true;
    } catch (e) {
      console.warn('[TaskSync] saveTasks error:', e);
    }
  }
  try {
    await AsyncStorage.setItem(getTasksStorageKey(), JSON.stringify(arr));
    return true;
  } catch (e) {
    return false;
  }
};

export const clearTasks = async () => {
  if (_userId) {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('owner_uid', _userId);
    if (error) {
      console.warn('[TaskSync] clearTasks error:', error);
      throw error;
    }
  }

  _pendingDeleteIds = new Set();
  await AsyncStorage.multiRemove([getTasksStorageKey(), getPendingDeletesStorageKey()]);
  _cachedTasks = [];
  _snapshotListeners.forEach((cb) => cb([]));
  return [];
};

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
    const dbObj = toDbObj({ ...newTask, ownerId: _userId });
    const { error } = await supabase.from('tasks').insert(dbObj);
    if (error) throw error;
  }

  _cachedTasks = updated;
  AsyncStorage.setItem(getTasksStorageKey(), JSON.stringify(updated)).catch(() => {});
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
    const { error } = await supabase.from('tasks')
      .update({ is_completed: !task.isCompleted, updated_at: now })
      .eq('id', taskId);
    if (error) throw error;
  }

  _cachedTasks = updated;
  AsyncStorage.setItem(getTasksStorageKey(), JSON.stringify(updated)).catch(() => {});
  return updated;
};

export const deleteTask = async (taskId) => {
  const tasks = await getTasks();
  const updated = tasks.filter((t) => t.id !== taskId);

  // Mark as pending so fetchInitial never restores it even if Supabase delete fails
  await _addPendingDeletes([taskId]);

  if (_userId) {
    const { data, error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId)
      .select('id');
    if (error) {
      console.warn('[TaskSync] deleteTask DB error:', error.message);
    } else if (data && data.length > 0) {
      await _removePendingDeletes([taskId]);
    }
  }

  _cachedTasks = updated;
  _snapshotListeners.forEach((cb) => cb(updated));
  AsyncStorage.setItem(getTasksStorageKey(), JSON.stringify(updated)).catch(() => {});
  return updated;
};

export const updateTask = async (taskId, updates) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const updated = tasks.map((t) =>
    t.id === taskId ? { ...t, ...updates, updatedAt: now } : t
  );

  if (_userId) {
    const dbObj = toDbObj(updates);
    const { error } = await supabase.from('tasks').update(dbObj).eq('id', taskId);
    if (error) throw error;
  }

  _cachedTasks = updated;
  AsyncStorage.setItem(getTasksStorageKey(), JSON.stringify(updated)).catch(() => {});
  return updated;
};

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
    await _batchWrite(_userId, newTasks, []);
  }

  _cachedTasks = updated;
  AsyncStorage.setItem(getTasksStorageKey(), JSON.stringify(updated)).catch(() => {});
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

  const updatedIds = new Set(updated.map((t) => t.id));
  const toDelete = tasks.filter((t) => !updatedIds.has(t.id)).map((t) => t.id);

  await _addPendingDeletes(toDelete);

  if (_userId) {
    try {
      await _batchWrite(_userId, [], toDelete);
      await _removePendingDeletes(toDelete);
    } catch (e) {
      console.warn('[TaskSync] deleteRepeatTasks DB error:', e.message);
    }
  }

  _cachedTasks = updated;
  _snapshotListeners.forEach((cb) => cb(updated));
  AsyncStorage.setItem(getTasksStorageKey(), JSON.stringify(updated)).catch(() => {});
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
    const updatedIds = new Set(remaining.map((t) => t.id));
    const toDelete = tasks
      .filter((t) => t.repeatGroupId === groupId && !updatedIds.has(t.id))
      .map((t) => t.id);
    const toSet = [
      ...remaining.filter((t) => t.repeatGroupId === groupId),
      ...newOccurrences,
    ];
    await _batchWrite(_userId, toSet, toDelete);
  }

  _cachedTasks = updated;
  AsyncStorage.setItem(getTasksStorageKey(), JSON.stringify(updated)).catch(() => {});
  return updated;
};

export const convertRepeatTaskToSingle = async (taskId, updates) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const task = tasks.find((t) => t.id === taskId);
  if (!task || !task.repeatGroupId) return updateTask(taskId, updates);

  const groupId = task.repeatGroupId;
  const keptTask = {
    ...task,
    ...updates,
    repeat: null,
    repeatEndDate: null,
    repeatGroupId: null,
    isRepeatMaster: null,
    updatedAt: now,
  };
  const updated = tasks
    .filter((t) => t.repeatGroupId !== groupId || t.id === taskId)
    .map((t) => (t.id === taskId ? keptTask : t));

  if (_userId) {
    const toDelete = tasks
      .filter((t) => t.repeatGroupId === groupId && t.id !== taskId)
      .map((t) => t.id);
    await _batchWrite(_userId, [keptTask], toDelete);
  }

  _cachedTasks = updated;
  AsyncStorage.setItem(getTasksStorageKey(), JSON.stringify(updated)).catch(() => {});
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
    const changedTasks = updated.filter((t) => {
      const orig = tasks.find((o) => o.id === t.id);
      return orig && orig.updatedAt !== t.updatedAt;
    });
    await _batchWrite(_userId, changedTasks, []);
  }

  _cachedTasks = updated;
  AsyncStorage.setItem(getTasksStorageKey(), JSON.stringify(updated)).catch(() => {});
  return updated;
};
