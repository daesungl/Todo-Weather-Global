create or replace function public.refresh_unread_plan_badge_count(target_uid text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  select count(*)::integer
  into next_count
  from public.unread_plan_badges
  where uid = target_uid;

  insert into public.user_badge_state (uid, unread_plan_badge_count, updated_at)
  values (target_uid, next_count, now())
  on conflict (uid) do update
    set unread_plan_badge_count = excluded.unread_plan_badge_count,
        updated_at = now();

  return next_count;
end;
$$;
