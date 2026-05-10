-- Plan domain schema for Todo Weather.
-- Firebase Auth remains the app auth in phase 1. Client access should go through
-- Supabase Edge Functions using SUPABASE_SERVICE_ROLE_KEY, so RLS is enabled and
-- direct anon access is denied by default.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  uid text primary key,
  display_name text,
  email text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plans (
  id text primary key,
  owner_uid text not null references public.profiles(uid) on delete cascade,
  title text not null default 'Untitled Plan',
  description text,
  period text,
  location text,
  weather_summary jsonb,
  gradient jsonb,
  progress numeric not null default 0,
  member_count integer not null default 1,
  steps_count integer not null default 0,
  steps_updated_at timestamptz,
  steps_last_uid text,
  comments_updated_at timestamptz,
  comments_last_uid text,
  comments_count integer not null default 0,
  invite_code text,
  invite_role text check (invite_role in ('viewer', 'editor')),
  invite_code_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.plan_members (
  plan_id text not null references public.plans(id) on delete cascade,
  uid text not null references public.profiles(uid) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  permissions jsonb,
  display_name text,
  joined_at timestamptz not null default now(),
  last_read_steps_at timestamptz,
  last_read_comments_at timestamptz,
  sort_order integer not null default 1000000,
  updated_at timestamptz not null default now(),
  primary key (plan_id, uid)
);

create table if not exists public.plan_steps (
  plan_id text not null references public.plans(id) on delete cascade,
  id text not null,
  activity text,
  memo text,
  date text,
  end_date text,
  time text,
  end_time text,
  region jsonb,
  lat double precision,
  lon double precision,
  repeat text,
  repeat_end_date text,
  repeat_group_id text,
  is_repeat_master boolean not null default false,
  notify boolean not null default false,
  order_index integer not null default 0,
  created_by text,
  created_by_name text,
  updated_by text,
  updated_by_name text,
  content_updated_at timestamptz,
  date_updated_at timestamptz,
  time_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb,
  primary key (plan_id, id)
);

create table if not exists public.plan_comments (
  id uuid primary key default gen_random_uuid(),
  plan_id text not null references public.plans(id) on delete cascade,
  step_id text not null,
  uid text not null references public.profiles(uid) on delete cascade,
  display_name text,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.plan_invites (
  code text primary key,
  plan_id text not null references public.plans(id) on delete cascade,
  owner_uid text not null references public.profiles(uid) on delete cascade,
  role text not null check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists public.unread_plan_badges (
  uid text not null references public.profiles(uid) on delete cascade,
  plan_id text not null references public.plans(id) on delete cascade,
  reason text not null check (reason in ('step', 'comment')),
  actor_uid text,
  actor_name text,
  step_id text,
  step_title text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (uid, plan_id)
);

create table if not exists public.user_badge_state (
  uid text primary key references public.profiles(uid) on delete cascade,
  unread_plan_badge_count integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_push_tokens (
  uid text not null references public.profiles(uid) on delete cascade,
  token_id text not null,
  token text not null,
  token_type text not null default 'expo',
  platform text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (uid, token_id)
);

create table if not exists public.plan_step_notification_prefs (
  uid text not null references public.profiles(uid) on delete cascade,
  plan_id text not null references public.plans(id) on delete cascade,
  step_id text not null,
  notify boolean not null default false,
  schedule_key text,
  updated_at timestamptz not null default now(),
  primary key (uid, plan_id, step_id)
);

create index if not exists idx_plan_members_uid_order on public.plan_members(uid, sort_order);
create index if not exists idx_plan_steps_plan_order on public.plan_steps(plan_id, order_index);
create index if not exists idx_plan_comments_plan_step_created on public.plan_comments(plan_id, step_id, created_at);
create index if not exists idx_plan_invites_expires_at on public.plan_invites(expires_at);
create index if not exists idx_unread_plan_badges_uid on public.unread_plan_badges(uid);

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.plan_members enable row level security;
alter table public.plan_steps enable row level security;
alter table public.plan_comments enable row level security;
alter table public.plan_invites enable row level security;
alter table public.unread_plan_badges enable row level security;
alter table public.user_badge_state enable row level security;
alter table public.user_push_tokens enable row level security;
alter table public.plan_step_notification_prefs enable row level security;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.decrement_unread_plan_badge_count(target_uid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_badge_state (uid, unread_plan_badge_count, updated_at)
  values (target_uid, 0, now())
  on conflict (uid) do update
    set unread_plan_badge_count = greatest(public.user_badge_state.unread_plan_badge_count - 1, 0),
        updated_at = now();
end;
$$;

create or replace function public.increment_plan_member_count(target_plan_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.plans
  set member_count = member_count + 1,
      updated_at = now()
  where id = target_plan_id;
end;
$$;

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

drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_plans_touch on public.plans;
create trigger trg_plans_touch before update on public.plans
for each row execute function public.touch_updated_at();

drop trigger if exists trg_plan_members_touch on public.plan_members;
create trigger trg_plan_members_touch before update on public.plan_members
for each row execute function public.touch_updated_at();

drop trigger if exists trg_plan_steps_touch on public.plan_steps;
create trigger trg_plan_steps_touch before update on public.plan_steps
for each row execute function public.touch_updated_at();
