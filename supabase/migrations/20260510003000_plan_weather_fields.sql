alter table public.plans add column if not exists address text;
alter table public.plans add column if not exists lat double precision;
alter table public.plans add column if not exists lon double precision;
alter table public.plans add column if not exists weather_temp text;
alter table public.plans add column if not exists weather_cond_key text;
alter table public.plans add column if not exists weather_is_day boolean;
