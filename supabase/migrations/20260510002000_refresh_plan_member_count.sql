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
