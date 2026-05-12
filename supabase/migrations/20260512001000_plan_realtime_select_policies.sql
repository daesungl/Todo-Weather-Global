-- Add SELECT policies so Supabase Realtime Postgres Changes can deliver
-- events to authenticated clients (including anonymous users).
--
-- All write operations go through the plan-api Edge Function with
-- service_role (bypasses RLS). These SELECT-only policies are purely
-- to enable real-time subscriptions on the client side.

-- Plan members can read their own membership rows
-- (needed as the anchor for all other plan-scoped policies)
create policy "Members can read own membership"
  on public.plan_members for select
  using (auth.uid()::text = uid);

-- Plan members can read plans they belong to
create policy "Plan members can read plans"
  on public.plans for select
  using (
    exists (
      select 1 from public.plan_members
      where plan_members.plan_id = plans.id
        and plan_members.uid = auth.uid()::text
    )
  );

-- Plan members can read steps of plans they belong to
create policy "Plan members can read steps"
  on public.plan_steps for select
  using (
    exists (
      select 1 from public.plan_members
      where plan_members.plan_id = plan_steps.plan_id
        and plan_members.uid = auth.uid()::text
    )
  );

-- Plan members can read comments of plans they belong to
create policy "Plan members can read comments"
  on public.plan_comments for select
  using (
    exists (
      select 1 from public.plan_members
      where plan_members.plan_id = plan_comments.plan_id
        and plan_members.uid = auth.uid()::text
    )
  );

-- Members can read unread badge rows they own
create policy "Members can read own unread badges"
  on public.unread_plan_badges for select
  using (auth.uid()::text = uid);

-- Members can read their own badge state
create policy "Members can read own badge state"
  on public.user_badge_state for select
  using (auth.uid()::text = uid);
