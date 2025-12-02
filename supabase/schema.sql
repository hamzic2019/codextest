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
  role text not null,
  city text not null,
  status text not null check (status in ('radnik', 'pocetnik', 'anerkennung')),
  preferred_shifts text[] not null default '{}',
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
  worker_id uuid references public.workers(id),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists plan_assignments_plan_id_idx on public.plan_assignments(plan_id);
create index if not exists plan_assignments_date_idx on public.plan_assignments(date);
create index if not exists plans_patient_idx on public.plans(patient_id);

alter table public.patients enable row level security;
alter table public.workers enable row level security;
alter table public.plans enable row level security;
alter table public.plan_assignments enable row level security;

-- Relaxed policies so the UI can read/write with anon key; tighten later if needed.
create policy "Public read patients" on public.patients for select using (true);
create policy "Public insert patients" on public.patients for insert with check (true);
create policy "Public read workers" on public.workers for select using (true);
create policy "Public insert workers" on public.workers for insert with check (true);
create policy "Public read plans" on public.plans for select using (true);
create policy "Public upsert plans" on public.plans for insert with check (true);
create policy "Public read plan assignments" on public.plan_assignments for select using (true);
create policy "Public upsert plan assignments" on public.plan_assignments for insert with check (true);
