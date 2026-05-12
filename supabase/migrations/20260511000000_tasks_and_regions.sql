create table if not exists public.tasks (
  id text primary key,
  owner_uid text not null references public.profiles(uid) on delete cascade,
  title text not null default 'Untitled Task',
  memo text,
  date text,
  end_date text,
  repeat text,
  repeat_end_date text,
  repeat_group_id text,
  is_repeat_master boolean not null default false,
  is_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.regions (
  id text primary key,
  owner_uid text not null references public.profiles(uid) on delete cascade,
  name text not null,
  address text,
  lat double precision,
  lon double precision,
  page_index integer not null default 0,
  sort_order integer not null default 0,
  inactive boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasks enable row level security;
alter table public.regions enable row level security;

create index if not exists idx_tasks_owner_uid on public.tasks(owner_uid);
create index if not exists idx_regions_owner_uid on public.regions(owner_uid);

drop trigger if exists trg_tasks_touch on public.tasks;
create trigger trg_tasks_touch before update on public.tasks
for each row execute function public.touch_updated_at();

drop trigger if exists trg_regions_touch on public.regions;
create trigger trg_regions_touch before update on public.regions
for each row execute function public.touch_updated_at();

create policy "Users can manage their own tasks" on public.tasks
  for all using (auth.uid()::text = owner_uid);

create policy "Users can manage their own regions" on public.regions
  for all using (auth.uid()::text = owner_uid);
