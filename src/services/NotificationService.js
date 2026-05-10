import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes } from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import firestore from '@react-native-firebase/firestore';
import Constants from 'expo-constants';
import i18n from '../i18n';
import { dateStr, expandFlowStepsForRange } from '../utils/flowRecurrence';
import { shouldUseSupabasePlans } from '../config/supabaseConfig';
import { registerPlanPushToken } from './supabase/PlanApiService';

const MAX_PER_SERIES = 10;
const PERM_ASKED_KEY = '@notification_perm_asked';
const CHANNEL_ID = 'schedule_alerts';
const NOTIF_PREFS_PREFIX = '@notif_prefs_';
const PUSH_TOKEN_PREFIX = '@push_token_';

const flowStepNotifPrefsCollection = (uid) =>
  firestore().collection('users').doc(uid).collection('flowStepNotifications');

const prefDocId = (flowId, stepId) =>
  flowId && stepId ? `${flowId}_${stepId}` : null;

const getLocalUserNotifPrefs = async (uid) => {
  if (!uid) return {};
  try {
    const raw = await AsyncStorage.getItem(`${NOTIF_PREFS_PREFIX}${uid}`);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
};

const saveLocalUserNotifPrefs = async (uid, prefs) => {
  if (!uid) return;
  await AsyncStorage.setItem(`${NOTIF_PREFS_PREFIX}${uid}`, JSON.stringify(prefs || {}));
};

// Per-user flow-step notification preferences.
// Firestore stores the account-level on/off state; notificationId stays local because OS ids are device-specific.
export const getUserNotifPrefs = async (uid) => {
  if (!uid) return {};
  const localPrefs = await getLocalUserNotifPrefs(uid);
  try {
    const snap = await flowStepNotifPrefsCollection(uid).get();
    if (snap.empty) return localPrefs;

    const merged = { ...localPrefs };
    snap.forEach(doc => {
      const data = doc.data() || {};
      if (!data.stepId) return;
      merged[data.stepId] = {
        notify: !!data.notify,
        notificationId: localPrefs[data.stepId]?.notificationId ?? null,
        flowId: data.flowId || localPrefs[data.stepId]?.flowId || null,
        scheduleKey: localPrefs[data.stepId]?.scheduleKey || null,
      };
    });
    await saveLocalUserNotifPrefs(uid, merged).catch(() => {});
    return merged;
  } catch {
    return localPrefs;
  }
};

export const setUserNotifPref = async (uid, stepId, notify, notificationId, flowId = null, meta = {}) => {
  if (!uid || !stepId) return;
  try {
    const prefs = await getLocalUserNotifPrefs(uid);
    prefs[stepId] = {
      notify,
      notificationId: notificationId ?? null,
      flowId: flowId || prefs[stepId]?.flowId || null,
      scheduleKey: notify ? (meta.scheduleKey ?? prefs[stepId]?.scheduleKey ?? null) : null,
    };
    await saveLocalUserNotifPrefs(uid, prefs);

    const docId = prefDocId(flowId, stepId);
    if (docId) {
      await flowStepNotifPrefsCollection(uid).doc(docId).set({
        flowId,
        stepId,
        notify: !!notify,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
  } catch {}
};

export const deleteUserNotifPref = async (uid, stepId, flowId = null) => {
  if (!uid || !stepId) return;
  try {
    const prefs = await getLocalUserNotifPrefs(uid);
    const resolvedFlowId = flowId || prefs[stepId]?.flowId || null;
    delete prefs[stepId];
    await saveLocalUserNotifPrefs(uid, prefs);

    const docId = prefDocId(resolvedFlowId, stepId);
    if (docId) {
      await flowStepNotifPrefsCollection(uid).doc(docId).delete();
    }
  } catch {}
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android 8+ 필수: 알림 채널 생성 (앱 시작 시 1회)
export const setupAndroidChannel = async () => {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '일정 알림',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#469dd3',
    sound: 'default',
  });
};

// ── 권한 ──────────────────────────────────────────────────────────────────────

export const requestPermission = async () => {
  try {
    await setupAndroidChannel();

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const asked = await AsyncStorage.getItem(PERM_ASKED_KEY);
    if (asked && existing === 'denied') return false;

    const { status } = await Notifications.requestPermissionsAsync();
    await AsyncStorage.setItem(PERM_ASKED_KEY, '1');
    return status === 'granted';
  } catch {
    return false;
  }
};

export const getNotificationPermissionStatus = async () => {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    return permissions.status;
  } catch {
    return 'undetermined';
  }
};

const tokenDocId = (token) =>
  String(token || '').replace(/[/.#$[\]]/g, '_').slice(0, 500);

const getExpoProjectId = () =>
  Constants?.easConfig?.projectId
  || Constants?.expoConfig?.extra?.eas?.projectId
  || Constants?.manifest2?.extra?.eas?.projectId
  || Constants?.manifest?.extra?.eas?.projectId
  || null;

export const registerPushToken = async (uid) => {
  if (!uid) return null;
  try {
    await setupAndroidChannel();
    const permissions = await Notifications.getPermissionsAsync();
    if (permissions.status !== 'granted') return null;

    const projectId = getExpoProjectId();
    if (!projectId) return null;

    const tokenResult = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenResult?.data;
    if (!token) return null;

    const docId = tokenDocId(token);
    if (!docId) return null;

    const localKey = `${PUSH_TOKEN_PREFIX}${uid}`;
    const cached = await AsyncStorage.getItem(localKey).catch(() => null);
    if (shouldUseSupabasePlans()) {
      await registerPlanPushToken({ token, tokenType: 'expo', platform: Platform.OS });
    } else {
      const now = firestore.FieldValue.serverTimestamp();
      const tokenRef = firestore().collection('users').doc(uid).collection('pushTokens').doc(docId);
      await tokenRef.set({
        token,
        tokenType: 'expo',
        platform: Platform.OS,
        enabled: true,
        updatedAt: now,
        ...(cached === token ? {} : { createdAt: now }),
      }, { merge: true });
    }
    await AsyncStorage.setItem(localKey, token).catch(() => {});
    return token;
  } catch (error) {
    if (__DEV__) console.log('[Notification] registerPushToken failed:', error?.message || error);
    return null;
  }
};

export const requestBadgePermission = async (uid = null) => {
  try {
    await setupAndroidChannel();

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') {
      if (uid) registerPushToken(uid);
      return true;
    }
    if (existing === 'denied') return false;

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: false,
        allowBadge: true,
        allowSound: false,
      },
    });
    const granted = status === 'granted';
    if (granted && uid) registerPushToken(uid);
    return granted;
  } catch {
    return false;
  }
};

export const requestSharedPlanNotificationPermission = async (uid = null) => {
  try {
    await setupAndroidChannel();

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') {
      if (uid) registerPushToken(uid);
      return true;
    }
    if (existing === 'denied') return false;

    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    const granted = status === 'granted';
    if (granted && uid) registerPushToken(uid);
    return granted;
  } catch {
    return false;
  }
};

export const hasPermission = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
};

// ── 단일 알림 ─────────────────────────────────────────────────────────────────

const NOTIFY_BEFORE_MINUTES = 10;

// dateStr: 'YYYY-MM-DD', timeStr: 'HH:MM' or null (null → 자정 00:00)
export const scheduleNotification = async (title, body, dateStr, timeStr) => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    const [h, min] = timeStr ? timeStr.split(':').map(Number) : [0, 0];

    const triggerDate = new Date(y, m - 1, d, h, min, 0);
    triggerDate.setMinutes(triggerDate.getMinutes() - NOTIFY_BEFORE_MINUTES);
    if (triggerDate <= new Date()) return null; // 과거 시각은 스킵

    const trigger = {
      type: SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      ...(Platform.OS === 'android' && { channelId: CHANNEL_ID }),
    };

    const body = timeStr
      ? i18n.t('tasks.notify_body', { minutes: NOTIFY_BEFORE_MINUTES })
      : i18n.t('tasks.notify_body_midnight', { minutes: NOTIFY_BEFORE_MINUTES });

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
      },
      trigger,
    });
    return id;
  } catch {
    return null;
  }
};

export const cancelNotification = async (notificationId) => {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
};

export const cancelNotifications = async (ids = []) => {
  await Promise.all(ids.filter(Boolean).map(cancelNotification));
};

// ── refill ────────────────────────────────────────────────────────────────────

// 현재 OS에 스케줄된 알림 ID 집합 반환
const getScheduledIds = async () => {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return new Set(all.map(n => n.identifier));
  } catch {
    return new Set();
  }
};

// 트리거 시간이 이미 지난 OS 알림 자동 정리 (앱 시작 시 1회 호출)
export const cancelPastNotifications = async () => {
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    const now = Date.now();
    await Promise.all(
      all
        .filter(n => {
          const trigger = n.trigger;
          if (!trigger) return false;
          // date-based trigger: expo-notifications는 seconds 또는 Date 객체
          const ts = trigger.value ?? trigger.date;
          if (ts == null) return false;
          const ms = typeof ts === 'number' && ts < 1e10 ? ts * 1000 : Number(ts);
          return ms <= now;
        })
        .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {}))
    );
  } catch {}
};

// tasks: 전체 태스크 배열, updateTask: (id, patch) => Promise<void>
export const refillTaskNotifications = async (tasks, updateTask) => {
  if (!tasks?.length) return;

  const scheduledIds = await getScheduledIds();

  // notify=true 이고 미래인 태스크만 대상
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const future = tasks.filter(t => {
    if (!t.notify) return false;
    const [y, m, d] = t.date.split('-').map(Number);
    return new Date(y, m - 1, d) >= today;
  });

  // repeatGroupId별로 활성 알림 개수 집계
  const groupActive = {}; // groupId → count of still-scheduled
  for (const t of future) {
    if (t.repeatGroupId && t.notificationId && scheduledIds.has(t.notificationId)) {
      groupActive[t.repeatGroupId] = (groupActive[t.repeatGroupId] || 0) + 1;
    }
  }

  // 소진됐거나 아직 스케줄 안 된 항목에 알림 채우기
  const groupScheduled = { ...groupActive };
  for (const t of future.sort((a, b) => a.date.localeCompare(b.date))) {
    if (t.notificationId && scheduledIds.has(t.notificationId)) continue; // 이미 활성

    const gid = t.repeatGroupId;
    if (gid) {
      const count = groupScheduled[gid] || 0;
      if (count >= MAX_PER_SERIES) continue;
      groupScheduled[gid] = count + 1;
    }

    const newId = await scheduleNotification(t.title, t.title, t.date, t.time || null);
    if (newId) await updateTask(t.id, { notificationId: newId });
  }
};

// flows: 전체 플로우 배열, updateStep: (flowId, stepId, patch) => Promise<void>
// uid: current user id
// saveNotifId: async (stepId, newNotifId) => void - saves to per-user AsyncStorage
export const refillStepNotifications = async (flows, uid, saveNotifId) => {
  if (!flows?.length || !uid) return;

  const userPrefs = await getUserNotifPrefs(uid);
  const scheduledIds = await getScheduledIds();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const refillEnd = new Date(today);
  refillEnd.setDate(refillEnd.getDate() + 90);
  const todayStr = dateStr(today);
  const refillEndStr = dateStr(refillEnd);

  for (const flow of flows) {
    if (!flow.steps?.length) continue;

    const expandedSteps = expandFlowStepsForRange(flow.steps, todayStr, refillEndStr);
    const future = expandedSteps.filter(s => {
      const sid = s._sourceStepId || s.id;
      const pref = userPrefs[sid];
      const shouldNotify = pref !== undefined ? pref.notify : false;
      if (!shouldNotify || !s.time || !s.date) return false;
      const [y, m, d] = s.date.split('-').map(Number);
      return new Date(y, m - 1, d) >= today;
    });

    const groupActive = {};
    for (const s of future) {
      const sid = s._sourceStepId || s.id;
      const notifId = userPrefs[sid]?.notificationId;
      const scheduleKey = `${s.date}_${s.time}`;
      if (s.repeatGroupId && notifId && scheduledIds.has(notifId) && userPrefs[sid]?.scheduleKey === scheduleKey) {
        groupActive[s.repeatGroupId] = (groupActive[s.repeatGroupId] || 0) + 1;
      }
    }

    const groupScheduled = { ...groupActive };
    for (const s of future.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))) {
      const sid = s._sourceStepId || s.id;
      const notifId = userPrefs[sid]?.notificationId;
      const scheduleKey = `${s.date}_${s.time}`;
      if (notifId && scheduledIds.has(notifId) && userPrefs[sid]?.scheduleKey === scheduleKey) continue;
      if (notifId) await cancelNotification(notifId);

      const gid = s.repeatGroupId;
      if (gid) {
        const count = groupScheduled[gid] || 0;
        if (count >= MAX_PER_SERIES) continue;
        groupScheduled[gid] = count + 1;
      }

      const newId = await scheduleNotification(s.activity || flow.title, s.activity || flow.title, s.date, s.time);
      if (newId) await saveNotifId(sid, newId, { scheduleKey });
    }
  }
};
