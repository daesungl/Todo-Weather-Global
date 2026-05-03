import AsyncStorage from '@react-native-async-storage/async-storage';

const TASKS_STORAGE_KEY = '@tasks_v1';

const _dateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const advanceByRepeat = (date, repeat) => {
  const d = new Date(date);
  switch (repeat) {
    case 'daily':   d.setDate(d.getDate() + 1);          break;
    case 'weekly':  d.setDate(d.getDate() + 7);          break;
    case 'monthly': d.setMonth(d.getMonth() + 1);        break;
    case 'yearly':  d.setFullYear(d.getFullYear() + 1);  break;
  }
  return d;
};

export const getTasks = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(TASKS_STORAGE_KEY);
    return jsonValue != null ? JSON.parse(jsonValue) : [];
  } catch (e) {
    console.error('Failed to get tasks', e);
    return [];
  }
};

export const saveTasks = async (tasks) => {
  try {
    await AsyncStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
    return true;
  } catch (e) {
    console.error('Failed to save tasks', e);
    return false;
  }
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
  await saveTasks(updated);
  return updated;
};

// Creates multiple repeat instances and saves them all
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
    current = advanceByRepeat(current, repeat);
  }

  const updated = [...tasks, ...newTasks];
  await saveTasks(updated);
  return updated;
};

export const toggleTaskCompletion = async (taskId) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const updated = tasks.map(t =>
    t.id === taskId ? { ...t, isCompleted: !t.isCompleted, updatedAt: now } : t
  );
  await saveTasks(updated);
  return updated;
};

export const deleteTask = async (taskId) => {
  const tasks = await getTasks();
  const updated = tasks.filter(t => t.id !== taskId);
  await saveTasks(updated);
  return updated;
};

// scope: 'this' | 'future' | 'all'
export const deleteRepeatTasks = async (taskId, scope) => {
  const tasks = await getTasks();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return tasks;

  let updated;
  if (scope === 'this') {
    updated = tasks.filter(t => t.id !== taskId);
  } else if (scope === 'future') {
    updated = tasks.filter(t => !(t.repeatGroupId === task.repeatGroupId && t.date >= task.date));
  } else {
    updated = tasks.filter(t => t.repeatGroupId !== task.repeatGroupId);
  }

  await saveTasks(updated);
  return updated;
};

// Extends or shortens a repeat series by changing its end date.
// Adds new occurrences if newRepeatEndDate is later, removes them if earlier.
// Applies globally to all instances — no 3-way choice needed.
export const updateRepeatSeriesEndDate = async (taskId, newRepeatEndDate) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const task = tasks.find(t => t.id === taskId);
  if (!task || !task.repeatGroupId) return tasks;

  const groupId = task.repeatGroupId;
  const repeat = task.repeat;
  const groupTasks = tasks
    .filter(t => t.repeatGroupId === groupId)
    .sort((a, b) => a.date.localeCompare(b.date));

  const master = groupTasks.find(t => t.isRepeatMaster) || groupTasks[0];
  const masterStart = new Date(master.date + 'T12:00:00');
  const masterEndObj = master.endDate ? new Date(master.endDate + 'T12:00:00') : masterStart;
  const durationMs = masterEndObj - masterStart;

  const newRepeatEnd = new Date(newRepeatEndDate + 'T12:00:00');
  const lastDate = new Date(groupTasks[groupTasks.length - 1].date + 'T12:00:00');

  // Remove instances after new end date; always keep the master
  let remaining = tasks.filter(t => {
    if (t.repeatGroupId !== groupId) return true;
    if (t.isRepeatMaster) return true;
    return t.date <= newRepeatEndDate;
  });

  // Update repeatEndDate on all remaining group instances
  remaining = remaining.map(t =>
    t.repeatGroupId === groupId ? { ...t, repeatEndDate: newRepeatEndDate, updatedAt: now } : t
  );

  // Add new occurrences if end date was extended
  const newOccurrences = [];
  if (newRepeatEnd > lastDate) {
    let current = advanceByRepeat(new Date(lastDate), repeat);
    const MAX_OCCURRENCES = 400;
    while (current <= newRepeatEnd && newOccurrences.length < MAX_OCCURRENCES) {
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
      current = advanceByRepeat(current, repeat);
    }
  }

  const updated = [...remaining, ...newOccurrences];
  await saveTasks(updated);
  return updated;
};

export const updateTask = async (taskId, updates) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const updated = tasks.map(t =>
    t.id === taskId ? { ...t, ...updates, updatedAt: now } : t
  );
  await saveTasks(updated);
  return updated;
};

// scope: 'this' | 'future' | 'all'
// For 'future'/'all', date/endDate of each occurrence is preserved
export const updateRepeatTasks = async (taskId, updates, scope) => {
  const tasks = await getTasks();
  const now = new Date().toISOString();
  const task = tasks.find(t => t.id === taskId);
  if (!task) return tasks;

  // Exclude per-occurrence date fields from multi-scope updates
  const { date: _d, endDate: _ed, ...sharedUpdates } = updates;

  const _dateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const oldDateMs = new Date(task.date + 'T12:00:00').getTime();
  const editDateMs = new Date(updates.date + 'T12:00:00').getTime();
  const dateShiftMs = editDateMs - oldDateMs;

  const editEndDateMs = updates.endDate ? new Date(updates.endDate + 'T12:00:00').getTime() : null;
  const durationMs = editEndDateMs !== null ? editEndDateMs - editDateMs : null;

  let updated;
  if (scope === 'this') {
    updated = tasks.map(t => t.id === taskId ? { ...t, ...updates, updatedAt: now } : t);
  } else if (scope === 'future') {
    updated = tasks.map(t => {
      if (t.repeatGroupId === task.repeatGroupId && t.date >= task.date) {
        if (t.id === taskId) {
          return { ...t, ...updates, updatedAt: now };
        }
        const stepDateMs = new Date(t.date + 'T12:00:00').getTime();
        const newStepDateMs = stepDateMs + dateShiftMs;
        const newDateStr = _dateStr(new Date(newStepDateMs));
        
        let newEndDate = null;
        if (durationMs !== null) {
          newEndDate = _dateStr(new Date(newStepDateMs + durationMs));
        } else if (t.endDate) {
          const oldEndMs = new Date(t.endDate + 'T12:00:00').getTime();
          newEndDate = _dateStr(new Date(oldEndMs + dateShiftMs));
        }
        return { ...t, ...sharedUpdates, date: newDateStr, endDate: newEndDate, updatedAt: now };
      }
      return t;
    });
  } else {
    updated = tasks.map(t => {
      if (t.repeatGroupId === task.repeatGroupId) {
        if (t.id === taskId) {
          return { ...t, ...updates, updatedAt: now };
        }
        const stepDateMs = new Date(t.date + 'T12:00:00').getTime();
        const newStepDateMs = stepDateMs + dateShiftMs;
        const newDateStr = _dateStr(new Date(newStepDateMs));
        
        let newEndDate = null;
        if (durationMs !== null) {
          newEndDate = _dateStr(new Date(newStepDateMs + durationMs));
        } else if (t.endDate) {
          const oldEndMs = new Date(t.endDate + 'T12:00:00').getTime();
          newEndDate = _dateStr(new Date(oldEndMs + dateShiftMs));
        }
        return { ...t, ...sharedUpdates, date: newDateStr, endDate: newEndDate, updatedAt: now };
      }
      return t;
    });
  }

  await saveTasks(updated);
  return updated;
};
