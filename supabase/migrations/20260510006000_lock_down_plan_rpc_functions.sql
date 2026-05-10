-- Security Advisor cleanup:
-- These helper RPCs are called by the Edge Function with the service role, or
-- by triggers. They should not be executable directly by anon/authenticated
-- clients.

alter function public.touch_updated_at()
  set search_path = public;

revoke all on function public.create_unread_plan_badge(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) from public, anon, authenticated;

revoke all on function public.refresh_unread_plan_badge_count(text)
  from public, anon, authenticated;

revoke all on function public.decrement_unread_plan_badge_count(text)
  from public, anon, authenticated;

revoke all on function public.increment_plan_member_count(text)
  from public, anon, authenticated;

revoke all on function public.decrement_plan_member_count(text)
  from public, anon, authenticated;

revoke all on function public.refresh_plan_member_count(text)
  from public, anon, authenticated;

revoke all on function public.increment_plan_comment_count(text, text, text)
  from public, anon, authenticated;

revoke all on function public.decrement_plan_comment_count(text, text)
  from public, anon, authenticated;

grant execute on function public.create_unread_plan_badge(
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to service_role;

grant execute on function public.refresh_unread_plan_badge_count(text)
  to service_role;

grant execute on function public.decrement_unread_plan_badge_count(text)
  to service_role;

grant execute on function public.increment_plan_member_count(text)
  to service_role;

grant execute on function public.decrement_plan_member_count(text)
  to service_role;

grant execute on function public.refresh_plan_member_count(text)
  to service_role;

grant execute on function public.increment_plan_comment_count(text, text, text)
  to service_role;

grant execute on function public.decrement_plan_comment_count(text, text)
  to service_role;
