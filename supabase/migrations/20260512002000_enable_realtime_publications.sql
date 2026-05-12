-- Enable Realtime for all plan-related tables.
-- Uses DO block to skip tables already in the publication.

do $$
declare
  t text;
  tables text[] := array[
    'plans', 'plan_members', 'plan_steps', 'plan_comments',
    'unread_plan_badges', 'user_badge_state'
  ];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
