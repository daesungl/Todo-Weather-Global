import {
  generatePlanInviteCode,
  invalidatePlanInviteCode,
  joinPlanByCode,
  leavePlan,
  listPlanMembers,
  removePlanMember,
  syncAllPlanMemberDisplayNames,
  syncPlanMemberDisplayName,
  updatePlanMemberPermissions,
} from './supabase/PlanApiService';
import { supabase } from '../config/supabaseConfig';

export const generateInviteCode = async (uid, flowId, role = 'viewer', flowData = null) => {
  const result = await generatePlanInviteCode(flowId, role);
  return result.code;
};

export const invalidateInviteCode = async (uid, flowId, code) => {
  try {
    await invalidatePlanInviteCode(flowId, code);
  } catch (_) {}
};

export const joinFlowByCode = async (uid, code, displayName = '') => {
  return joinPlanByCode(code, displayName);
};

export const leaveFlow = async (uid, ownerUid, flowId) => {
  await leavePlan(flowId);
};

export const syncMemberCount = async (flowId, count) => {
  // Supabase handles member count via RPC on the server
};

export const removeMember = async (ownerUid, flowId, memberUid) => {
  await removePlanMember(flowId, memberUid);
};

export const getFlowMembers = async (ownerUid, flowId) => {
  return listPlanMembers(flowId);
};

export const subscribeToFlowMembers = (ownerUid, flowId, onUpdate) => {
  if (!ownerUid || !flowId) return () => {};
  let cancelled = false;

  const load = () => {
    listPlanMembers(flowId)
      .then(members => { if (!cancelled) onUpdate(members); })
      .catch(err => {
        if (!cancelled && err?.status === 403) { onUpdate([]); return; }
        console.warn('[InviteService] members load error:', err);
      });
  };

  load();

  let channel;
  if (supabase) {
    channel = supabase
      .channel(`public:plan_members:plan_id=eq.${flowId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plan_members', filter: `plan_id=eq.${flowId}` },
        () => load()
      )
      .subscribe();
  }

  return () => {
    cancelled = true;
    if (channel) supabase.removeChannel(channel);
  };
};

export const syncMemberDisplayName = async (flowId, uid, displayName) => {
  if (!flowId || !uid || !displayName) return;
  await syncPlanMemberDisplayName(flowId, displayName);
};

export const syncAllMemberDisplayNames = async (displayName) => {
  if (!displayName) return;
  await syncAllPlanMemberDisplayNames(displayName);
};

export const updateMemberPermissions = async (ownerUid, flowId, memberUid, permissions) => {
  await updatePlanMemberPermissions(flowId, memberUid, permissions);
};
