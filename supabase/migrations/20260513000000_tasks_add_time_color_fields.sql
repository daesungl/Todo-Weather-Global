alter table public.tasks
  add column if not exists time text,
  add column if not exists end_time text,
  add column if not exists is_all_day boolean not null default false,
  add column if not exists color text,
  add column if not exists notify boolean not null default false,
  add column if not exists notification_id text,
  add column if not exists location_name text,
  add column if not exists weather_region jsonb;
