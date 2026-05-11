import firestore from '@react-native-firebase/firestore';
import { shouldUseSupabasePlans } from '../config/supabaseConfig';
import {
  getPlanBadgeState,
  listUnreadPlanBadges,
  markPlanRead,
} from './supabase/PlanApiService';
import { getSupabaseClient } from './supabase/client';

const docExists = (doc) =>
  typeof doc?.exists === 'function' ? doc.exists() : !!doc?.exists;

const badgeStateRef = (uid) =>
  firestore().collection('users').doc(uid).collection('badge').doc('state');

const unreadBadgesCollection = (uid) =>
  firestore().collection('users').doc(uid).collection('unreadFlowBadges');

export const subscribeToFlowBadgeState = (uid, callback) => {
  if (!uid || typeof callback !== 'function') return () => {};
  if (shouldUseSupabasePlans()) {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getPlanBadgeState();
        if (!cancelled) callback({ exists: true, count: Math.max(0, Number(data?.count || 0)) });
      } catch (error) {
        if (__DEV__) console.warn('[FlowBadge] Supabase state listener failed:', error);
        if (!cancelled) callback({ exists: true, count: 0, error });
      }
    };
    load();
    const interval = setInterval(load, 60000);

    const client = getSupabaseClient();
    let channel = null;
    if (client) {
      channel = client.channel(`badge_state_${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_badge_state', filter: `uid=eq.${uid}` }, () => {
          if (!cancelled) load();
        })
        .subscribe();
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (channel) channel.unsubscribe();
    };
  }

  return badgeStateRef(uid).onSnapshot(
    (doc) => {
      const exists = docExists(doc);
      const data = exists ? (doc.data() || {}) : null;
      const count = Math.max(0, Number(data?.unreadFlowBadgeCount || 0));
      callback({ exists, count });
    },
    (error) => {
      console.warn('[FlowBadge] state listener failed:', error);
      callback({ exists: false, count: 0, error });
    }
  );
};

export const subscribeToUnreadFlowBadges = (uid, callback) => {
  if (!uid || typeof callback !== 'function') return () => {};
  if (shouldUseSupabasePlans()) {
    let cancelled = false;
    const load = async () => {
      try {
        const rows = await listUnreadPlanBadges();
        if (cancelled) return;
        const badges = {};
        rows.forEach(row => {
          const flowId = row.plan_id || row.planId;
          if (!flowId) return;
          badges[flowId] = {
            id: flowId,
            flowId,
            reason: row.reason,
            actorUid: row.actor_uid,
            actorName: row.actor_name,
            stepId: row.step_id,
            stepTitle: row.step_title,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          };
        });
        callback(badges);
      } catch (error) {
        if (__DEV__) console.warn('[FlowBadge] Supabase unread badge listener failed:', error);
        if (!cancelled) callback({});
      }
    };
    load();
    const interval = setInterval(load, 60000);

    const client = getSupabaseClient();
    let channel = null;
    if (client) {
      channel = client.channel(`unread_badges_${uid}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'unread_plan_badges', filter: `uid=eq.${uid}` }, () => {
          if (!cancelled) load();
        })
        .subscribe();
    }

    return () => {
      cancelled = true;
      clearInterval(interval);
      if (channel) channel.unsubscribe();
    };
  }

  return unreadBadgesCollection(uid).onSnapshot(
    (snap) => {
      const badges = {};
      snap.forEach(doc => {
        badges[doc.id] = { id: doc.id, ...(doc.data() || {}) };
      });
      callback(badges);
    },
    (error) => {
      console.warn('[FlowBadge] unread badge listener failed:', error);
      callback({});
    }
  );
};

export const markFlowBadgeRead = async (uid, flowId) => {
  if (!uid || !flowId) return false;
  if (shouldUseSupabasePlans()) {
    try {
      await markPlanRead(flowId, { steps: false, comments: false });
      return true;
    } catch (error) {
      if (__DEV__) console.warn('[FlowBadge] Supabase mark read failed:', error);
      return false;
    }
  }

  const userBadgeStateRef = badgeStateRef(uid);
  const unreadBadgeRef = unreadBadgesCollection(uid).doc(flowId);

  try {
    let removed = false;
    await firestore().runTransaction(async (transaction) => {
      const badgeDoc = await transaction.get(unreadBadgeRef);
      if (!docExists(badgeDoc)) return;

      removed = true;
      const stateDoc = await transaction.get(userBadgeStateRef);
      const currentCount = Math.max(0, Number(stateDoc.data()?.unreadFlowBadgeCount || 0));
      transaction.delete(unreadBadgeRef);
      transaction.set(
        userBadgeStateRef,
        {
          unreadFlowBadgeCount: Math.max(0, currentCount - 1),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    return removed;
  } catch (error) {
    console.warn('[FlowBadge] mark read failed:', error);
    return false;
  }
};
