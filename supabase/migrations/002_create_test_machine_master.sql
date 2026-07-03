-- Safe migration for machine/customer lookup during rebuild testing.
-- Creates only a test_ table and does not touch live machine_master.

create table if not exists public.test_machine_master (
  id uuid primary key default gen_random_uuid(),
  machine_no text not null unique,
  customer_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_test_machine_master_machine_no on public.test_machine_master(machine_no);

alter table public.test_machine_master enable row level security;

drop policy if exists test_machine_master_read_all on public.test_machine_master;
create policy test_machine_master_read_all on public.test_machine_master for select using (true);

drop policy if exists test_machine_master_insert_all on public.test_machine_master;
create policy test_machine_master_insert_all on public.test_machine_master for insert with check (true);
