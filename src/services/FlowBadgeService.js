import {
  getPlanBadgeState,
  listUnreadPlanBadges,
  markPlanRead,
} from './supabase/PlanApiService';
import { supabase } from '../config/supabaseConfig';

export const subscribeToFlowBadgeState = (uid, callback) => {
  if (!uid || typeof callback !== 'function') return () => {};
  let cancelled = false;
  const channelId = `badges_state_${uid}_${Date.now()}`;

  const load = async () => {
    try {
      const data = await getPlanBadgeState();
      if (!cancelled) callback({ exists: true, count: Math.max(0, Number(data?.count || 0)) });
    } catch (error) {
      if (__DEV__) console.warn('[FlowBadge] state listener failed:', error);
      if (!cancelled) callback({ exists: true, count: 0, error });
    }
  };

  load();

  let channelBadges;
  if (supabase) {
    channelBadges = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unread_plan_badges', filter: `uid=eq.${uid}` }, () => load())
      .subscribe();
  }

  return () => {
    cancelled = true;
    if (channelBadges) supabase.removeChannel(channelBadges);
  };
};

export const subscribeToUnreadFlowBadges = (uid, callback) => {
  if (!uid || typeof callback !== 'function') return () => {};
  let cancelled = false;
  const channelId = `badges_unread_${uid}_${Date.now()}`;

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
      if (__DEV__) console.warn('[FlowBadge] unread badge listener failed:', error);
      if (!cancelled) callback({});
    }
  };

  load();

  let channelBadges;
  if (supabase) {
    channelBadges = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unread_plan_badges', filter: `uid=eq.${uid}` }, () => load())
      .subscribe();
  }

  return () => {
    cancelled = true;
    if (channelBadges) supabase.removeChannel(channelBadges);
  };
};

export const markFlowBadgeRead = async (uid, flowId) => {
  if (!uid || !flowId) return false;
  try {
    await markPlanRead(flowId, { steps: false, comments: false });
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[FlowBadge] mark read failed:', error);
    return false;
  }
};
