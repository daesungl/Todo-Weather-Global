create or replace function public.decrement_plan_member_count(target_plan_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.plans
  set member_count = greatest(member_count - 1, 1),
      updated_at = now()
  where id = target_plan_id;
end;
$$;

create or replace function public.refresh_plan_member_count(target_plan_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.plans
  set member_count = greatest(
        (select count(*)::integer from public.plan_members where plan_id = target_plan_id),
        1
      ),
      updated_at = now()
  where id = target_plan_id;
end;
$$;

create or replace function public.increment_plan_comment_count(
  target_plan_id text,
  target_step_id text,
  actor_uid text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.plans
  set comments_count = comments_count + 1,
      comments_updated_at = now(),
      comments_last_uid = actor_uid,
      updated_at = now()
  where id = target_plan_id;
end;
$$;

create or replace function public.decrement_plan_comment_count(
  target_plan_id text,
  target_step_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.plans
  set comments_count = greatest(comments_count - 1, 0),
      updated_at = now()
  where id = target_plan_id;
end;
$$;
