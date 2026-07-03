create table if not exists public.test_inventory_staging (
  id uuid primary key default gen_random_uuid(),
  upload_batch_id uuid not null default gen_random_uuid(),
  report_date date not null,
  branch_code text not null,
  branch_name text,
  item_code text not null,
  item_name text,
  item_group text,
  uom text,
  dnp numeric default 0,
  opening_balance numeric default 0,
  opening_value numeric default 0,
  received_qty numeric default 0,
  issued_qty numeric default 0,
  closing_balance numeric default 0,
  closing_value numeric default 0,
  source_filename text,
  created_at timestamptz default now()
);

alter table public.test_inventory_staging enable row level security;

drop policy if exists test_inventory_staging_select_policy on public.test_inventory_staging;
create policy test_inventory_staging_select_policy
on public.test_inventory_staging
for select
using (true);

drop policy if exists test_inventory_staging_insert_policy on public.test_inventory_staging;
create policy test_inventory_staging_insert_policy
on public.test_inventory_staging
for insert
with check (true);

drop policy if exists test_inventory_staging_delete_policy on public.test_inventory_staging;
create policy test_inventory_staging_delete_policy
on public.test_inventory_staging
for delete
using (true);

create index if not exists idx_test_inventory_staging_batch on public.test_inventory_staging(upload_batch_id);
create index if not exists idx_test_inventory_staging_item on public.test_inventory_staging(branch_code, item_code);
