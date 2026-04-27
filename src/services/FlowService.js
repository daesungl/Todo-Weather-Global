import AsyncStorage from '@react-native-async-storage/async-storage';

const FLOWS_STORAGE_KEY = '@todo_weather_flows';

/**
 * 모든 Flow 목록을 가져옵니다.
 */
export const getFlows = async () => {
  try {
    const jsonValue = await AsyncStorage.getItem(FLOWS_STORAGE_KEY);
    const data = jsonValue != null ? JSON.parse(jsonValue) : [];
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Failed to fetch flows', e);
    return [];
  }
};

/**
 * 새로운 Flow를 저장하거나 기존 목록을 업데이트합니다.
 */
export const saveFlows = async (flows) => {
  try {
    const dataToSave = Array.isArray(flows) ? flows : [];
    const jsonValue = JSON.stringify(dataToSave);
    await AsyncStorage.setItem(FLOWS_STORAGE_KEY, jsonValue);
  } catch (e) {
    console.error('Failed to save flows', e);
  }
};

/**
 * 특정 Flow를 ID로 삭제합니다.
 */
export const deleteFlow = async (id) => {
  try {
    const flows = await getFlows();
    const filteredFlows = flows.filter(flow => flow.id !== id);
    await saveFlows(filteredFlows);
    return filteredFlows;
  } catch (e) {
    console.error('Failed to delete flow', e);
    return [];
  }
};

/**
 * 무료 한도 초과분을 비활성화합니다. 오래된 것부터 유지, 최신 것부터 잠금.
 */
export const applyFlowFreeLimit = async (limit) => {
  try {
    const flows = await getFlows();
    const sorted = [...flows].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const updated = sorted.map((f, i) => ({ ...f, inactive: i >= limit }));
    await saveFlows(updated);
    return updated;
  } catch (e) {
    console.error('Failed to apply flow limit', e);
    return [];
  }
};

/**
 * 비활성화된 Flow를 모두 복원합니다.
 */
export const restoreAllFlows = async () => {
  try {
    const flows = await getFlows();
    const updated = flows.map(f => ({ ...f, inactive: false }));
    await saveFlows(updated);
    return updated;
  } catch (e) {
    console.error('Failed to restore flows', e);
    return [];
  }
};

/**
 * 새로운 Flow를 하나 추가합니다.
 */
export const addFlow = async (flow) => {
  try {
    const flows = await getFlows();
    const updatedFlows = [flow, ...(Array.isArray(flows) ? flows : [])];
    await saveFlows(updatedFlows);
    return updatedFlows;
  } catch (e) {
    console.error('Failed to add flow', e);
    return [];
  }
};
