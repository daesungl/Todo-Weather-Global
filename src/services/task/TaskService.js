import AsyncStorage from '@react-native-async-storage/async-storage';

const TASKS_STORAGE_KEY = '@tasks_v1';

/**
 * Task Structure:
 * {
 *   id: string (uuid),
 *   title: string,
 *   date: string (YYYY-MM-DD),
 *   time: string (HH:mm),
 *   locationName: string (Optional - display only),
 *   weatherRegion: { lat, lon, name, address } (Optional - for weather data),
 *   isCompleted: boolean,
 *   createdAt: string (ISO)
 * }
 */

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
        const jsonValue = JSON.stringify(tasks);
        await AsyncStorage.setItem(TASKS_STORAGE_KEY, jsonValue);
        return true;
    } catch (e) {
        console.error('Failed to save tasks', e);
        return false;
    }
};

export const addTask = async (taskData) => {
    const tasks = await getTasks();
    const newTask = {
        ...taskData,
        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
        isCompleted: false,
        createdAt: new Date().toISOString(),
    };
    const updated = [...tasks, newTask];
    await saveTasks(updated);
    return updated;
};

export const toggleTaskCompletion = async (taskId) => {
    const tasks = await getTasks();
    const updated = tasks.map(t => 
        t.id === taskId ? { ...t, isCompleted: !t.isCompleted } : t
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

export const updateTask = async (taskId, updates) => {
    const tasks = await getTasks();
    const updated = tasks.map(t => 
        t.id === taskId ? { ...t, ...updates } : t
    );
    await saveTasks(updated);
    return updated;
};
