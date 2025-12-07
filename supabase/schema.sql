-- Basic schema for PflegeKI. Run in Supabase SQL editor.
-- Adds patients, workers, plans, and plan assignments with relaxed RLS.

create extension if not exists "pgcrypto";

create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  level text not null default 'Pflegegrad 3',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  role text not null default '—',
  status text not null check (status in ('radnik', 'anarbeitung', 'student', 'externi', 'pocetnik', 'anerkennung')),
  preferred_shifts text[] not null default '{day,night}',
  hours_planned integer not null default 0,
  hours_completed integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  month integer not null check (month between 1 and 12),
  year integer not null check (year >= 2024),
  prompt text,
  summary text,
  status text not null default 'saved',
  created_at timestamptz not null default now(),
  unique(patient_id, month, year)
);

create table if not exists public.plan_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  date date not null,
  shift_type text not null check (shift_type in ('day', 'night')),
  worker_id uuid references public.workers(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists plan_assignments_plan_id_idx on public.plan_assignments(plan_id);
create index if not exists plan_assignments_date_idx on public.plan_assignments(date);
create unique index if not exists plan_assignments_worker_date_shift_uidx
  on public.plan_assignments(date, shift_type, worker_id)
  where worker_id is not null;
create index if not exists plans_patient_idx on public.plans(patient_id);

drop trigger if exists enforce_day_after_night_trigger on public.plan_assignments;

create or replace function public.enforce_day_after_night()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Enforce rest: no day+night same calendar day and minimum 12h rest after a night shift.
  if NEW.worker_id is null then
    return NEW;
  end if;

  -- Block mixing day and night for the same worker on the same date.
  if exists (
    select 1
    from public.plan_assignments pa
    where pa.worker_id = NEW.worker_id
      and pa.date = NEW.date
      and pa.shift_type <> NEW.shift_type
      and (TG_OP = 'INSERT' or pa.id <> NEW.id)
  ) then
    raise exception 'worker % cannot have both day and night shifts on %', NEW.worker_id, NEW.date;
  end if;

  if NEW.shift_type = 'day' then
    if exists (
      select 1
      from public.plan_assignments pa
      where pa.worker_id = NEW.worker_id
        and pa.shift_type = 'night'
        and pa.date = NEW.date - interval '1 day'
        and (TG_OP = 'INSERT' or pa.id <> NEW.id)
    ) then
      raise exception 'worker % cannot work a day shift on % immediately after a night shift', NEW.worker_id, NEW.date;
    end if;
  end if;

  if NEW.shift_type = 'night' then
    if exists (
      select 1
      from public.plan_assignments pa
      where pa.worker_id = NEW.worker_id
        and pa.shift_type = 'day'
        and pa.date = NEW.date + interval '1 day'
        and (TG_OP = 'INSERT' or pa.id <> NEW.id)
    ) then
      raise exception 'worker % cannot work a night shift on % because a day shift is already planned the next day', NEW.worker_id, NEW.date;
    end if;
  end if;

  return NEW;
end;
$$;

create trigger enforce_day_after_night_trigger
  before insert or update on public.plan_assignments
  for each row execute function public.enforce_day_after_night();

alter table public.patients enable row level security;
alter table public.workers enable row level security;
alter table public.plans enable row level security;
alter table public.plan_assignments enable row level security;

-- Relaxed policies so the UI can read/write with anon key; tighten later if needed.
drop policy if exists "Public read patients" on public.patients;
drop policy if exists "Public insert patients" on public.patients;
drop policy if exists "Public read workers" on public.workers;
drop policy if exists "Public insert workers" on public.workers;
drop policy if exists "Public read plans" on public.plans;
drop policy if exists "Public upsert plans" on public.plans;
drop policy if exists "Public read plan assignments" on public.plan_assignments;
drop policy if exists "Public upsert plan assignments" on public.plan_assignments;

create policy "Public read patients" on public.patients for select using (true);
create policy "Public insert patients" on public.patients for insert with check (true);
create policy "Public read workers" on public.workers for select using (true);
create policy "Public insert workers" on public.workers for insert with check (true);
create policy "Public read plans" on public.plans for select using (true);
create policy "Public upsert plans" on public.plans for insert with check (true);
create policy "Public read plan assignments" on public.plan_assignments for select using (true);
create policy "Public upsert plan assignments" on public.plan_assignments for insert with check (true);
