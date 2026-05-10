create or replace function public.create_unread_plan_badge(
  target_uid text,
  target_plan_id text,
  badge_reason text,
  badge_actor_uid text,
  badge_actor_name text,
  badge_step_id text,
  badge_step_title text
)
returns table(created boolean, unread_count integer)
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.unread_plan_badges (
    uid,
    plan_id,
    reason,
    actor_uid,
    actor_name,
    step_id,
    step_title,
    created_at,
    updated_at
  )
  values (
    target_uid,
    target_plan_id,
    badge_reason,
    badge_actor_uid,
    badge_actor_name,
    badge_step_id,
    badge_step_title,
    now(),
    now()
  )
  on conflict (uid, plan_id) do nothing;

  if not found then
    select false, coalesce(state.unread_plan_badge_count, 0)
    into created, unread_count
    from public.user_badge_state state
    where state.uid = target_uid;

    created := false;
    unread_count := coalesce(unread_count, 0);
    return next;
    return;
  end if;

  insert into public.user_badge_state (uid, unread_plan_badge_count, updated_at)
  values (target_uid, 1, now())
  on conflict (uid) do update
    set unread_plan_badge_count = public.user_badge_state.unread_plan_badge_count + 1,
        updated_at = now()
  returning public.user_badge_state.unread_plan_badge_count into unread_count;

  created := true;
  return next;
end;
$$;
