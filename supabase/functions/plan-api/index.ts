import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const looksLikeEmail = (value?: string | null) =>
  typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

const displayNameFromEmail = (email?: string | null) => {
  if (!email || !looksLikeEmail(email)) return null;
  return email.split('@')[0] || null;
};

const normalizeDisplayName = (name?: string | null, email?: string | null) => {
  const trimmedName = String(name || '').trim();
  if (trimmedName && !looksLikeEmail(trimmedName)) return trimmedName;
  return displayNameFromEmail(email) || trimmedName || null;
};

const requireUser = async (req: Request) => {
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) throw new Response('Missing bearer token', { status: 401, headers: corsHeaders });

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new Response('Unauthorized', { status: 401, headers: corsHeaders });

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name')
    .eq('uid', user.id)
    .maybeSingle();

  const displayName = normalizeDisplayName(
    user.user_metadata?.full_name || user.user_metadata?.name || profile?.display_name,
    user.email
  ) || 'Member';

  return {
    uid: user.id as string,
    email: user.email as string | undefined,
    displayName,
  };
};

const cleanPlanPayload = (payload: Record<string, unknown>, uid: string) => ({
  id: String(payload.id),
  owner_uid: String(payload.ownerUid || payload._ownerUid || uid),
  title: String(payload.title || 'Untitled Plan'),
  description: payload.description ?? null,
  period: payload.period ?? null,
  location: payload.location ?? null,
  address: payload.address ?? null,
  lat: payload.lat ?? null,
  lon: payload.lon ?? null,
  weather_summary: payload.weatherSummary ?? null,
  weather_temp: payload.weatherTemp ?? null,
  weather_cond_key: payload.weatherCondKey ?? null,
  weather_is_day: payload.weatherIsDay ?? null,
  gradient: payload.gradient ?? null,
  progress: Number(payload.progress || 0),
  steps_count: Array.isArray(payload.steps) ? payload.steps.length : Number(payload.stepsCount || 0),
  steps_updated_at: payload.stepsUpdatedAt ?? null,
  steps_last_uid: payload.stepsLastUid ?? null,
  comments_updated_at: payload.commentsUpdatedAt ?? null,
  comments_last_uid: payload.commentsLastUid ?? null,
  comments_count: Number(payload.commentsCount || 0),
});

const stepPayload = (planId: string, step: Record<string, unknown>, index: number) => ({
  plan_id: planId,
  id: String(step.id || `${Date.now()}_${index}`),
  activity: step.activity ?? null,
  memo: step.memo ?? null,
  date: step.date ?? null,
  end_date: step.endDate ?? null,
  time: step.time ?? null,
  end_time: step.endTime ?? null,
  region: step.region ?? null,
  lat: step.lat ?? null,
  lon: step.lon ?? null,
  repeat: step.repeat ?? null,
  repeat_end_date: step.repeatEndDate ?? null,
  repeat_group_id: step.repeatGroupId ?? null,
  is_repeat_master: Boolean(step.isRepeatMaster),
  notify: Boolean(step.notify),
  order_index: Number(step.order ?? index),
  created_by: step.createdBy ?? null,
  created_by_name: step.createdByName ?? null,
  updated_by: step.updatedBy ?? null,
  updated_by_name: step.updatedByName ?? null,
  content_updated_at: step.contentUpdatedAt ?? null,
  date_updated_at: step.dateUpdatedAt ?? null,
  time_updated_at: step.timeUpdatedAt ?? null,
  data: step,
});

const toAppStep = (row: Record<string, unknown>) => ({
  ...(row.data as Record<string, unknown> || {}),
  id: row.id,
  order: row.order_index,
});

const toAppComment = (row: Record<string, unknown>) => ({
  id: row.id,
  stepId: row.step_id,
  uid: row.uid,
  displayName: row.display_name,
  text: row.text,
  createdAt: row.created_at,
});

const toAppMember = (row: Record<string, unknown>) => ({
  uid: row.uid,
  role: row.role,
  displayName: row.display_name || `User ${String(row.uid || '').slice(0, 5)}`,
  permissions: row.permissions || {
    edit: row.role === 'editor',
    manageComments: row.role === 'editor',
  },
});

const toAppPlan = (row: Record<string, unknown>) => ({
  id: row.id,
  title: row.title,
  description: row.description,
  period: row.period,
  location: row.location,
  address: row.address,
  lat: row.lat,
  lon: row.lon,
  weatherSummary: row.weather_summary,
  weatherTemp: row.weather_temp,
  weatherCondKey: row.weather_cond_key,
  weatherIsDay: row.weather_is_day,
  gradient: row.gradient,
  progress: row.progress,
  ownerUid: row.owner_uid,
  memberCount: row.member_count,
  stepsCount: row.steps_count,
  stepsUpdatedAt: row.steps_updated_at,
  stepsLastUid: row.steps_last_uid,
  commentsUpdatedAt: row.comments_updated_at,
  commentsLastUid: row.comments_last_uid,
  commentsCount: row.comments_count,
  updatedAt: row.updated_at,
});

const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const tokenDocId = (token: string) =>
  String(token || '').replace(/[/.#$[\]]/g, '_').slice(0, 500);

const sendExpoPush = async (
  tokens: string[],
  message: { title: string; body: string; badge: number; data: Record<string, unknown> },
) => {
  const validTokens = [...new Set(tokens.filter(token => String(token || '').startsWith('ExponentPushToken[')))];
  if (validTokens.length === 0) return;

  const chunks: string[][] = [];
  for (let i = 0; i < validTokens.length; i += 100) chunks.push(validTokens.slice(i, i + 100));

  await Promise.all(chunks.map(async (chunk) => {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk.map(token => ({
        to: token,
        sound: 'default',
        channelId: 'schedule_alerts',
        title: message.title,
        body: message.body,
        badge: message.badge,
        data: message.data,
      }))),
    });
    if (!res.ok) {
      console.warn('[plan-api] Expo push failed:', res.status, await res.text().catch(() => ''));
    }
  }));
};

const publishUnreadPlanBadge = async ({
  planId,
  actorUid,
  actorName,
  reason,
  stepId,
  stepTitle,
}: {
  planId: string;
  actorUid: string;
  actorName: string;
  reason: 'step' | 'comment';
  stepId?: string | null;
  stepTitle?: string | null;
}) => {
  const { data: plan } = await admin.from('plans').select('title').eq('id', planId).maybeSingle();
  const { data: members, error: membersError } = await admin
    .from('plan_members')
    .select('uid')
    .eq('plan_id', planId)
    .neq('uid', actorUid);
  if (membersError) throw membersError;

  const title = plan?.title || 'Plan';
  const body = reason === 'comment'
    ? `${actorName}: ${stepTitle || '일정'}에 댓글을 남겼습니다.`
    : `${actorName}: 일정을 추가/수정했습니다.`;

  await Promise.all((members || []).map(async (member: Record<string, unknown>) => {
    const targetUid = String(member.uid || '');
    if (!targetUid) return;

    const { data: badgeResult, error: badgeError } = await admin.rpc('create_unread_plan_badge', {
      target_uid: targetUid,
      target_plan_id: planId,
      badge_reason: reason,
      badge_actor_uid: actorUid,
      badge_actor_name: actorName,
      badge_step_id: stepId || null,
      badge_step_title: stepTitle || null,
    });
    if (badgeError) throw badgeError;

    const result = Array.isArray(badgeResult) ? badgeResult[0] : badgeResult;
    if (!result?.created) return;

    const { data: tokens, error: tokenError } = await admin
      .from('user_push_tokens')
      .select('token')
      .eq('uid', targetUid)
      .eq('enabled', true);
    if (tokenError) throw tokenError;

    await sendExpoPush((tokens || []).map((row: Record<string, unknown>) => String(row.token || '')), {
      title,
      body,
      badge: Math.max(0, Number(result.unread_count || 1)),
      data: { type: 'plan_unread', planId, reason, stepId: stepId || null },
    });
  }));
};

const pickStepForBadge = (steps: Record<string, unknown>[]) => {
  if (!Array.isArray(steps) || steps.length === 0) return null;
  return steps.reduce((best, step) => {
    const bestMs = new Date(String(best?.updatedAt || best?.createdAt || 0)).getTime() || 0;
    const stepMs = new Date(String(step?.updatedAt || step?.createdAt || 0)).getTime() || 0;
    return stepMs >= bestMs ? step : best;
  }, steps[0]);
};

const refreshUnreadBadgeCount = async (uid: string) => {
  const { data, error } = await admin.rpc('refresh_unread_plan_badge_count', { target_uid: uid });
  if (error) throw error;
  return Math.max(0, Number(data || 0));
};

const clearUnreadPlanBadge = async (uid: string, planId: string) => {
  const { data: badge, error: badgeError } = await admin
    .from('unread_plan_badges')
    .select('plan_id')
    .eq('uid', uid)
    .eq('plan_id', planId)
    .maybeSingle();
  if (badgeError) throw badgeError;
  if (!badge) return false;

  await admin.from('unread_plan_badges').delete().eq('uid', uid).eq('plan_id', planId).throwOnError();
  await refreshUnreadBadgeCount(uid);
  return true;
};

const pruneInaccessibleUnreadBadges = async (uid: string) => {
  const { data: badges, error: badgesError } = await admin
    .from('unread_plan_badges')
    .select('plan_id')
    .eq('uid', uid);
  if (badgesError) throw badgesError;

  const planIds = [...new Set((badges || []).map((row: Record<string, unknown>) => String(row.plan_id || '')).filter(Boolean))];
  if (planIds.length === 0) return refreshUnreadBadgeCount(uid);

  const { data: memberships, error: membershipsError } = await admin
    .from('plan_members')
    .select('plan_id')
    .eq('uid', uid)
    .in('plan_id', planIds);
  if (membershipsError) throw membershipsError;

  const accessibleIds = new Set((memberships || []).map((row: Record<string, unknown>) => String(row.plan_id || '')));
  const staleIds = planIds.filter(planId => !accessibleIds.has(planId));
  if (staleIds.length > 0) {
    await admin.from('unread_plan_badges').delete().eq('uid', uid).in('plan_id', staleIds).throwOnError();
  }

  return refreshUnreadBadgeCount(uid);
};

const assertMember = async (uid: string, planId: string) => {
  const { data, error } = await admin
    .from('plan_members')
    .select('role, permissions, sort_order, joined_at, last_read_steps_at, last_read_comments_at')
    .eq('plan_id', planId)
    .eq('uid', uid)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Response('Not a plan member', { status: 403, headers: corsHeaders });
  return data;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const path = url.pathname.replace(/^\/plan-api/, '').split('/').filter(Boolean);

    if (req.method === 'POST' && path[0] === 'push-token') {
      const body = await req.json();
      const token = String(body.token || '').trim();
      if (!token) throw new Response('Missing push token', { status: 400, headers: corsHeaders });
      const tokenId = tokenDocId(token);
      if (!tokenId) throw new Response('Invalid push token', { status: 400, headers: corsHeaders });
      
      await admin.from('user_push_tokens').delete().eq('token_id', tokenId).neq('uid', user.uid);

      await admin.from('user_push_tokens').upsert({
        uid: user.uid,
        token_id: tokenId,
        token,
        token_type: body.tokenType || 'expo',
        platform: body.platform || null,
        enabled: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'uid,token_id' }).throwOnError();
      return json({ ok: true });
    }

    if (req.method === 'GET' && path[0] === 'badge-state') {
      const count = await pruneInaccessibleUnreadBadges(user.uid);
      const { data, error } = await admin
        .from('user_badge_state')
        .select('unread_plan_badge_count')
        .eq('uid', user.uid)
        .maybeSingle();
      if (error) throw error;
      return json({ exists: true, count: Math.max(0, Number(data?.unread_plan_badge_count ?? count)) });
    }

    if (req.method === 'GET' && path[0] === 'unread-badges') {
      await pruneInaccessibleUnreadBadges(user.uid);
      const { data, error } = await admin
        .from('unread_plan_badges')
        .select('*')
        .eq('uid', user.uid);
      if (error) throw error;
      return json({ badges: data || [] });
    }

    if (req.method === 'PUT' && path[0] === 'me' && path[1] === 'display-name') {
      const body = await req.json();
      const displayName = normalizeDisplayName(body.displayName, user.email) || user.displayName || null;
      if (!displayName) {
        throw new Response('Missing display name', { status: 400, headers: corsHeaders });
      }

      await admin
        .from('profiles')
        .upsert({
          uid: user.uid,
          email: user.email || null,
          display_name: displayName,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'uid' })
        .throwOnError();

      await admin
        .from('plan_members')
        .update({ display_name: displayName })
        .eq('uid', user.uid)
        .throwOnError();

      return json({ ok: true, displayName });
    }

    if (req.method === 'GET' && path[0] === 'plans' && path.length === 1) {
      const { data, error } = await admin
        .from('plan_members')
        .select('role, permissions, sort_order, joined_at, last_read_steps_at, last_read_comments_at, plans(*)')
        .eq('uid', user.uid)
        .order('sort_order', { ascending: true });
      if (error) throw error;

      return json({
        plans: (data || []).map((row: Record<string, unknown>) => ({
          ...toAppPlan(row.plans as Record<string, unknown>),
          _role: row.role,
          _permissions: row.permissions,
          _joinedAt: row.joined_at,
          _lastReadStepsAt: row.last_read_steps_at,
          _lastReadCommentsAt: row.last_read_comments_at,
          order: row.sort_order,
        })),
      });
    }

    if (req.method === 'GET' && path[0] === 'plans' && path[2] === 'steps') {
      const planId = path[1];
      await assertMember(user.uid, planId);
      const { data, error } = await admin
        .from('plan_steps')
        .select('*')
        .eq('plan_id', planId)
        .order('order_index', { ascending: true });
      if (error) throw error;
      return json({ steps: (data || []).map(toAppStep) });
    }

    if (req.method === 'PUT' && path[0] === 'plans' && path[1] === 'order' && path.length === 2) {
      const payload = await req.json();
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (items.length > 0) {
        await Promise.all(items.map((item: any) => 
          admin.from('plan_members').update({ sort_order: Number(item.sort_order) })
            .eq('plan_id', item.plan_id)
            .eq('uid', user.uid)
        ));
      }
      return json({ ok: true });
    }

    if (req.method === 'PUT' && path[0] === 'plans' && path.length === 2 && path[1] !== 'order') {
      const planId = path[1];
      const payload = await req.json();
      const existingMember = await admin
        .from('plan_members')
        .select('role')
        .eq('plan_id', planId)
        .eq('uid', user.uid)
        .maybeSingle();
      const role = existingMember.data?.role;
      if (existingMember.data && !['owner', 'editor'].includes(role)) {
        throw new Response('No edit permission', { status: 403, headers: corsHeaders });
      }

      await admin.from('profiles').upsert({
        uid: user.uid,
        display_name: user.displayName || null,
        email: user.email || null,
      }, { onConflict: 'uid', ignoreDuplicates: true });

      const plan = cleanPlanPayload({ ...payload, id: planId }, user.uid);
      const { error: planError } = await admin.from('plans').upsert(plan);
      if (planError) throw planError;

      if (!existingMember.data) {
      const { error: memberError } = await admin.from('plan_members').upsert({
          plan_id: planId,
          uid: user.uid,
          role: 'owner',
          display_name: user.displayName || 'Owner',
          sort_order: Number(payload.order || 0),
          last_read_steps_at: new Date().toISOString(),
          last_read_comments_at: new Date().toISOString(),
        }, { onConflict: 'plan_id,uid' });
        if (memberError) throw memberError;
      }

      return json({ ok: true });
    }

    if (req.method === 'DELETE' && path[0] === 'plans' && path.length === 2) {
      const planId = path[1];
      const member = await assertMember(user.uid, planId);
      if (member.role !== 'owner') {
        throw new Response('Only owner can delete plan', { status: 403, headers: corsHeaders });
      }
      await admin.from('plans').delete().eq('id', planId).throwOnError();
      return json({ ok: true });
    }

    if (req.method === 'PUT' && path[0] === 'plans' && path[2] === 'steps') {
      const planId = path[1];
      const member = await assertMember(user.uid, planId);
      if (!['owner', 'editor'].includes(String(member.role))) {
        throw new Response('No edit permission', { status: 403, headers: corsHeaders });
      }

      const payload = await req.json();
      const steps = Array.isArray(payload.steps) ? payload.steps : [];
      const markUpdated = payload.markUpdated !== false;
      const rows = steps.map((step: Record<string, unknown>, index: number) => stepPayload(planId, step, index));
      const nextIds = rows.map((row) => row.id);

      if (nextIds.length > 0) {
        const { error: upsertError } = await admin.from('plan_steps').upsert(rows, { onConflict: 'plan_id,id' });
        if (upsertError) throw upsertError;
      }
      const deleteQuery = admin.from('plan_steps').delete().eq('plan_id', planId);
      if (nextIds.length > 0) {
        const inList = nextIds
          .map(id => String(id).replace(/[(),]/g, ''))
          .filter(Boolean)
          .join(',');
        if (inList) deleteQuery.not('id', 'in', `(${inList})`);
      }
      const { error: deleteError } = await deleteQuery;
      if (deleteError) throw deleteError;

      const planPatch: Record<string, unknown> = {
        steps_count: rows.length,
      };
      if (markUpdated) {
        planPatch.steps_updated_at = new Date().toISOString();
        planPatch.steps_last_uid = user.uid;
      }
      const { error: planError } = await admin.from('plans').update(planPatch).eq('id', planId);
      if (planError) throw planError;

      if (markUpdated) {
        const step = pickStepForBadge(steps);
        await publishUnreadPlanBadge({
          planId,
          actorUid: user.uid,
          actorName: user.displayName || 'Member',
          reason: 'step',
          stepId: step?.id ? String(step.id) : null,
          stepTitle: step?.activity ? String(step.activity) : null,
        });
      }

      return json({ ok: true });
    }

    if (req.method === 'POST' && path[0] === 'plans' && path[2] === 'mark-read') {
      const planId = path[1];
      await assertMember(user.uid, planId);
      const body = await req.json().catch(() => ({}));
      const patch: Record<string, string> = {};
      if (body.steps !== false) patch.last_read_steps_at = new Date().toISOString();
      if (body.comments !== false) patch.last_read_comments_at = new Date().toISOString();
      const { error } = await admin.from('plan_members').update(patch).eq('plan_id', planId).eq('uid', user.uid);
      if (error) throw error;

      await clearUnreadPlanBadge(user.uid, planId);
      return json({ ok: true });
    }

    if (req.method === 'POST' && path[0] === 'plans' && path[2] === 'invite') {
      const planId = path[1];
      const member = await assertMember(user.uid, planId);
      if (member.role !== 'owner') {
        throw new Response('Only owner can invite members', { status: 403, headers: corsHeaders });
      }

      const body = await req.json().catch(() => ({}));
      const role = body.role === 'editor' ? 'editor' : 'viewer';
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      let code = generateInviteCode();
      let insertError = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await admin.from('plan_invites').insert({
          code,
          plan_id: planId,
          owner_uid: user.uid,
          role,
          expires_at: expiresAt,
        });
        insertError = result.error;
        if (!insertError) break;
        code = generateInviteCode();
      }
      if (insertError) throw insertError;

      const { error: planError } = await admin.from('plans').update({
        invite_code: code,
        invite_role: role,
        invite_code_expires_at: expiresAt,
      }).eq('id', planId);
      if (planError) throw planError;

      return json({ code, role, expiresAt });
    }

    if (req.method === 'DELETE' && path[0] === 'plans' && path[2] === 'invite') {
      const planId = path[1];
      const code = path[3];
      const member = await assertMember(user.uid, planId);
      if (member.role !== 'owner') {
        throw new Response('Only owner can remove invites', { status: 403, headers: corsHeaders });
      }
      await admin.from('plan_invites').delete().eq('code', code).eq('plan_id', planId).throwOnError();
      return json({ ok: true });
    }

    if (req.method === 'GET' && path[0] === 'plans' && path[2] === 'members') {
      const planId = path[1];
      await assertMember(user.uid, planId);
      const { data, error } = await admin
        .from('plan_members')
        .select('uid, role, permissions, display_name')
        .eq('plan_id', planId)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return json({ members: (data || []).map(toAppMember) });
    }

    if (req.method === 'PUT' && path[0] === 'plans' && path[2] === 'members') {
      const planId = path[1];
      const memberUid = path[3];
      const member = await assertMember(user.uid, planId);
      if (member.role !== 'owner') {
        throw new Response('Only owner can update members', { status: 403, headers: corsHeaders });
      }
      const body = await req.json();
      const permissions = body.permissions || {};
      const role = permissions.edit ? 'editor' : 'viewer';
      await admin.from('plan_members').update({ permissions, role }).eq('plan_id', planId).eq('uid', memberUid).throwOnError();
      return json({ ok: true });
    }

    if (req.method === 'DELETE' && path[0] === 'plans' && path[2] === 'members') {
      const planId = path[1];
      const memberUid = path[3];
      const member = await assertMember(user.uid, planId);
      if (member.role !== 'owner' && memberUid !== user.uid) {
        throw new Response('No permission to remove member', { status: 403, headers: corsHeaders });
      }
      await admin.from('plan_members').delete().eq('plan_id', planId).eq('uid', memberUid).throwOnError();
      await clearUnreadPlanBadge(memberUid, planId);
      await admin.rpc('refresh_plan_member_count', { target_plan_id: planId }).throwOnError();
      return json({ ok: true });
    }

    if (req.method === 'POST' && path[0] === 'plans' && path[2] === 'leave') {
      const planId = path[1];
      const member = await assertMember(user.uid, planId);
      if (member.role === 'owner') {
        throw new Response('Owner cannot leave own plan', { status: 409, headers: corsHeaders });
      }
      await admin.from('plan_members').delete().eq('plan_id', planId).eq('uid', user.uid).throwOnError();
      await clearUnreadPlanBadge(user.uid, planId);
      await admin.rpc('refresh_plan_member_count', { target_plan_id: planId }).throwOnError();
      return json({ ok: true });
    }

    if (req.method === 'PUT' && path[0] === 'plans' && path[2] === 'me') {
      const planId = path[1];
      await assertMember(user.uid, planId);
      const body = await req.json();
      await admin.from('plan_members').update({
        display_name: normalizeDisplayName(body.displayName, user.email) || user.displayName || null,
      }).eq('plan_id', planId).eq('uid', user.uid).throwOnError();
      return json({ ok: true });
    }

    if (req.method === 'GET' && path[0] === 'plans' && path[2] === 'comments') {
      const planId = path[1];
      await assertMember(user.uid, planId);
      const { data, error } = await admin
        .from('plan_comments')
        .select('*')
        .eq('plan_id', planId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return json({ comments: (data || []).map(toAppComment) });
    }

    if (req.method === 'POST' && path[0] === 'plans' && path[2] === 'comments') {
      const planId = path[1];
      await assertMember(user.uid, planId);
      const body = await req.json();
      const text = String(body.text || '').trim();
      if (!body.stepId || !text) throw new Response('Missing comment fields', { status: 400, headers: corsHeaders });
      const { data: inserted, error } = await admin.from('plan_comments').insert({
        plan_id: planId,
        step_id: body.stepId,
        uid: user.uid,
        display_name: user.displayName || 'Guest',
        text,
      }).select('*').single();
      if (error) throw error;
      await admin.rpc('increment_plan_comment_count', {
        target_plan_id: planId,
        target_step_id: body.stepId,
        actor_uid: user.uid,
      }).throwOnError();
      const { data: step } = await admin
        .from('plan_steps')
        .select('activity, data')
        .eq('plan_id', planId)
        .eq('id', body.stepId)
        .maybeSingle();
      await publishUnreadPlanBadge({
        planId,
        actorUid: user.uid,
        actorName: user.displayName || 'Member',
        reason: 'comment',
        stepId: String(body.stepId),
        stepTitle: String(step?.activity || (step?.data as Record<string, unknown> | undefined)?.activity || '일정'),
      });
      return json({ ok: true, comment: toAppComment(inserted) });
    }

    if (req.method === 'DELETE' && path[0] === 'plans' && path[2] === 'comments') {
      const planId = path[1];
      const commentId = path[3];
      const member = await assertMember(user.uid, planId);
      const { data: comment, error: commentError } = await admin
        .from('plan_comments')
        .select('uid, step_id')
        .eq('plan_id', planId)
        .eq('id', commentId)
        .maybeSingle();
      if (commentError) throw commentError;
      if (!comment) return json({ ok: true });
      const canDelete = comment.uid === user.uid
        || member.role === 'owner'
        || member.role === 'editor'
        || member.permissions?.manageComments === true;
      if (!canDelete) throw new Response('No permission to delete comment', { status: 403, headers: corsHeaders });
      await admin.from('plan_comments').delete().eq('plan_id', planId).eq('id', commentId).throwOnError();
      await admin.rpc('decrement_plan_comment_count', {
        target_plan_id: planId,
        target_step_id: comment.step_id,
      }).throwOnError();
      return json({ ok: true });
    }

    if (req.method === 'POST' && path[0] === 'join') {
      const body = await req.json();
      const code = String(body.code || '').trim().toUpperCase();
      if (!code) throw new Response('Missing invite code', { status: 400, headers: corsHeaders });

      const { data: invite, error: inviteError } = await admin
        .from('plan_invites')
        .select('*')
        .eq('code', code)
        .maybeSingle();
      if (inviteError) throw inviteError;
      if (!invite) throw new Response('INVALID_CODE', { status: 404, headers: corsHeaders });
      if (new Date(invite.expires_at).getTime() < Date.now()) {
        throw new Response('EXPIRED_CODE', { status: 410, headers: corsHeaders });
      }
      if (invite.owner_uid === user.uid) {
        throw new Response('OWN_FLOW', { status: 409, headers: corsHeaders });
      }

      const { data: existing } = await admin
        .from('plan_members')
        .select('role')
        .eq('plan_id', invite.plan_id)
        .eq('uid', user.uid)
        .maybeSingle();

      const role = existing?.role || invite.role;
      const { error: memberError } = await admin.from('plan_members').upsert({
        plan_id: invite.plan_id,
        uid: user.uid,
        role,
        display_name: normalizeDisplayName(body.displayName, user.email) || user.displayName || `User ${user.uid.slice(0, 5)}`,
        last_read_steps_at: new Date().toISOString(),
        last_read_comments_at: new Date().toISOString(),
      }, { onConflict: 'plan_id,uid' });
      if (memberError) throw memberError;

      if (!existing) {
        await admin.rpc('increment_plan_member_count', { target_plan_id: invite.plan_id }).throwOnError();
        await admin.rpc('refresh_plan_member_count', { target_plan_id: invite.plan_id }).throwOnError();
      }

      const { data: plan, error: planError } = await admin.from('plans').select('*').eq('id', invite.plan_id).single();
      if (planError) throw planError;
      return json({ flowId: invite.plan_id, ownerUid: invite.owner_uid, role, flowTitle: plan.title });
    }

    if (req.method === 'POST' && path[0] === 'transfer-code' && path[1] === 'generate') {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      // Invalidate previous unused codes for this user
      await admin.from('transfer_codes').delete().eq('uid', user.uid).is('used_at', null);
      await admin.from('transfer_codes').insert({ code, uid: user.uid, expires_at: expiresAt }).throwOnError();
      return json({ code, expiresAt });
    }

    if (req.method === 'POST' && path[0] === 'transfer-code' && path[1] === 'redeem') {
      const body = await req.json();
      const code = String(body.code || '').replace(/-/g, '').toUpperCase().trim();
      if (!code) throw new Response('Missing code', { status: 400, headers: corsHeaders });

      const { data: record, error: codeError } = await admin
        .from('transfer_codes')
        .select('*')
        .eq('code', code)
        .maybeSingle();
      if (codeError) throw codeError;
      if (!record) throw new Response('Invalid code', { status: 404, headers: corsHeaders });
      if (record.used_at) throw new Response('Code already used', { status: 410, headers: corsHeaders });
      if (new Date(record.expires_at) < new Date()) throw new Response('Code expired', { status: 410, headers: corsHeaders });
      if (record.uid === user.uid) throw new Response('Cannot redeem your own code', { status: 400, headers: corsHeaders });

      const fromUid = record.uid as string;
      const toUid = user.uid;

      // Mark code as used first to prevent double redemption
      await admin.from('transfer_codes').update({ used_at: new Date().toISOString() }).eq('code', code).throwOnError();

      // Resolve plan_members conflicts (toUid already a member of a plan fromUid belongs to)
      const { data: fromMemberships } = await admin.from('plan_members').select('plan_id').eq('uid', fromUid);
      const { data: toMemberships } = await admin.from('plan_members').select('plan_id').eq('uid', toUid);
      const toPlanIds = new Set((toMemberships || []).map((m: Record<string, unknown>) => m.plan_id));
      for (const m of (fromMemberships || []) as Record<string, unknown>[]) {
        if (toPlanIds.has(m.plan_id)) {
          await admin.from('plan_members').delete().eq('uid', fromUid).eq('plan_id', m.plan_id);
        }
      }

      // Migrate all data
      await admin.from('tasks').update({ uid: toUid }).eq('uid', fromUid);
      await admin.from('regions').update({ uid: toUid }).eq('uid', fromUid);
      await admin.from('plans').update({ owner_uid: toUid }).eq('owner_uid', fromUid);
      await admin.from('plan_invites').update({ owner_uid: toUid }).eq('owner_uid', fromUid);
      await admin.from('plan_members').update({ uid: toUid }).eq('uid', fromUid);
      await admin.from('plan_step_notification_prefs').update({ uid: toUid }).eq('uid', fromUid);
      await admin.from('unread_plan_badges').update({ uid: toUid }).eq('uid', fromUid);
      await admin.from('user_badge_state').update({ uid: toUid }).eq('uid', fromUid);
      await admin.from('user_push_tokens').update({ uid: toUid }).eq('uid', fromUid);

      // Migrate profile: copy display_name if toUid doesn't have a real name set
      const { data: fromProfile } = await admin.from('profiles').select('*').eq('uid', fromUid).maybeSingle();
      const { data: toProfile } = await admin.from('profiles').select('display_name').eq('uid', toUid).maybeSingle();
      if (fromProfile?.display_name && (!toProfile?.display_name || /^Guest\s*#/.test(toProfile.display_name) || /^게스트\s*#/.test(toProfile.display_name))) {
        await admin.from('profiles').upsert({ uid: toUid, display_name: fromProfile.display_name }, { onConflict: 'uid' });
      }
      await admin.from('profiles').delete().eq('uid', fromUid);

      return json({ ok: true });
    }

    return json({ error: 'Not found' }, 404);
  } catch (error) {
    if (error instanceof Response) return error;
    console.error('[plan-api]', error);
    return json({ error: error?.message || 'Internal error' }, 500);
  }
});
