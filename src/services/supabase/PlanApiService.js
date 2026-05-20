import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL, shouldUseSupabasePlans } from '../../config/supabaseConfig';

const planApiBaseUrl = () =>
  `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/plan-api`;

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('LOGIN_REQUIRED');
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
};

const request = async (path, options = {}) => {
  if (!shouldUseSupabasePlans()) {
    throw new Error('SUPABASE_PLANS_DISABLED');
  }

  const headers = await getAuthHeaders();
  const response = await fetch(`${planApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {}
  if (!response.ok) {
    const message = data?.error || text || `Supabase plan API failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
};

export const isSupabasePlanBackendEnabled = shouldUseSupabasePlans;

export const listPlans = async () => {
  const data = await request('/plans');
  return data?.plans || [];
};

export const deleteAccount = async () =>
  request('/account', {
    method: 'DELETE',
  });

export const getPlanSteps = async (planId) => {
  const data = await request(`/plans/${encodeURIComponent(planId)}/steps`);
  return data?.steps || [];
};

export const savePlan = async (plan) =>
  request(`/plans/${encodeURIComponent(plan.id)}`, {
    method: 'PUT',
    body: JSON.stringify(plan),
  });

export const deletePlan = async (planId) =>
  request(`/plans/${encodeURIComponent(planId)}`, {
    method: 'DELETE',
  });

export const updatePlanOrders = async (items) =>
  request('/plans/order', {
    method: 'PUT',
    body: JSON.stringify({ items }),
  });

export const replacePlanSteps = async (planId, steps = [], options = {}) =>
  request(`/plans/${encodeURIComponent(planId)}/steps`, {
    method: 'PUT',
    body: JSON.stringify({
      steps,
      markUpdated: options.markUpdated !== false,
    }),
  });

export const markPlanRead = async (planId, options = {}) =>
  request(`/plans/${encodeURIComponent(planId)}/mark-read`, {
    method: 'POST',
    body: JSON.stringify(options),
  });

export const generatePlanInviteCode = async (planId, role = 'viewer') =>
  request(`/plans/${encodeURIComponent(planId)}/invite`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });

export const joinPlanByCode = async (code, displayName = '') =>
  request('/join', {
    method: 'POST',
    body: JSON.stringify({ code, displayName }),
  });

export const invalidatePlanInviteCode = async (planId, code) =>
  request(`/plans/${encodeURIComponent(planId)}/invite/${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });

export const listPlanMembers = async (planId) => {
  const data = await request(`/plans/${encodeURIComponent(planId)}/members`);
  return data?.members || [];
};

export const updatePlanMemberPermissions = async (planId, memberUid, permissions) =>
  request(`/plans/${encodeURIComponent(planId)}/members/${encodeURIComponent(memberUid)}`, {
    method: 'PUT',
    body: JSON.stringify({ permissions }),
  });

export const removePlanMember = async (planId, memberUid) =>
  request(`/plans/${encodeURIComponent(planId)}/members/${encodeURIComponent(memberUid)}`, {
    method: 'DELETE',
  });

export const leavePlan = async (planId) =>
  request(`/plans/${encodeURIComponent(planId)}/leave`, {
    method: 'POST',
  });

export const syncPlanMemberDisplayName = async (planId, displayName) =>
  request(`/plans/${encodeURIComponent(planId)}/me`, {
    method: 'PUT',
    body: JSON.stringify({ displayName }),
  });

export const syncAllPlanMemberDisplayNames = async (displayName) =>
  request('/me/display-name', {
    method: 'PUT',
    body: JSON.stringify({ displayName }),
  });

export const listPlanComments = async (planId) => {
  const data = await request(`/plans/${encodeURIComponent(planId)}/comments`);
  return data?.comments || [];
};

export const addPlanComment = async (planId, stepId, text) =>
  request(`/plans/${encodeURIComponent(planId)}/comments`, {
    method: 'POST',
    body: JSON.stringify({ stepId, text }),
  });

export const deletePlanComment = async (planId, commentId) =>
  request(`/plans/${encodeURIComponent(planId)}/comments/${encodeURIComponent(commentId)}`, {
    method: 'DELETE',
  });

export const registerPlanPushToken = async ({ token, tokenType = 'expo', platform = null }) =>
  request('/push-token', {
    method: 'POST',
    body: JSON.stringify({ token, tokenType, platform }),
  });

export const getPlanBadgeState = async () =>
  request('/badge-state');

export const listUnreadPlanBadges = async () => {
  const data = await request('/unread-badges');
  return data?.badges || [];
};
