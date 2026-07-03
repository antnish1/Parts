create table if not exists public.test_inventory_changes (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  branch_code text not null,
  item_code text not null,
  old_qty numeric(14, 2),
  new_qty numeric(14, 2),
  qty_delta numeric(14, 2),
  created_at timestamptz not null default now()
);

create index if not exists idx_test_inventory_changes_branch_item
on public.test_inventory_changes(branch_code, item_code);

create index if not exists idx_test_inventory_changes_report_date
on public.test_inventory_changes(report_date desc);

alter table public.test_inventory_changes enable row level security;

drop policy if exists test_inventory_changes_read_all on public.test_inventory_changes;
create policy test_inventory_changes_read_all on public.test_inventory_changes for select using (true);

drop policy if exists test_inventory_changes_insert_all on public.test_inventory_changes;
create policy test_inventory_changes_insert_all on public.test_inventory_changes for insert with check (true);

drop policy if exists test_inventory_current_upsert_policy on public.test_inventory_current;
create policy test_inventory_current_upsert_policy on public.test_inventory_current
for insert with check (true);

drop policy if exists test_inventory_current_update_policy on public.test_inventory_current;
create policy test_inventory_current_update_policy on public.test_inventory_current
for update using (true) with check (true);

drop policy if exists test_inventory_uploads_insert_policy on public.test_inventory_uploads;
create policy test_inventory_uploads_insert_policy on public.test_inventory_uploads
for insert with check (true);

drop policy if exists test_inventory_uploads_update_policy on public.test_inventory_uploads;
create policy test_inventory_uploads_update_policy on public.test_inventory_uploads
for update using (true) with check (true);
