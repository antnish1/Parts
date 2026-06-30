-- Safe migration for Parts Connect Portal rebuild testing.
-- This file only creates new tables with the test_ prefix.
-- It does not change, delete, rename, or insert into any existing live tables.

create extension if not exists pgcrypto;

create table if not exists public.test_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  full_name text not null,
  branch text not null,
  role text not null check (role in ('branch', 'admin', 'super', 'manager', 'viewer', 'developer')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_branch_mapping (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  branch_code text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.test_part_master (
  part_no text primary key,
  description text,
  dnp numeric(14, 2),
  cat1 text,
  cat2 text,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.test_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  branch text not null,
  order_type text not null,
  order_for text not null,
  employee_id uuid references public.test_profiles(id),
  approver_id uuid references public.test_profiles(id),
  machine_no text,
  customer_name text,
  call_id text,
  warranty_status text,
  status text not null default 'pending_approval',
  approval_status text not null default 'pending',
  processed_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.test_orders(id) on delete cascade,
  part_no text not null,
  description text,
  dnp numeric(14, 2),
  qty numeric(14, 2) not null check (qty > 0),
  edited_qty numeric(14, 2),
  billed_qty numeric(14, 2),
  value numeric(14, 2),
  edited_value numeric(14, 2),
  previous_30d_qty numeric(14, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.test_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.test_orders(id) on delete cascade,
  event_type text not null,
  old_status text,
  new_status text,
  actor_id uuid references public.test_profiles(id),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.test_order_comments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.test_orders(id) on delete cascade,
  author_id uuid references public.test_profiles(id),
  comment_type text not null default 'user',
  body text,
  attachment_path text,
  created_at timestamptz not null default now()
);

create table if not exists public.test_inventory_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references public.test_profiles(id),
  report_date date not null,
  filename text,
  total_rows int not null default 0,
  valid_rows int not null default 0,
  failed_rows int not null default 0,
  status text not null default 'draft',
  error_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.test_inventory_current (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  branch_code text not null,
  item_code text not null,
  item_name text,
  item_group text,
  uom text,
  dnp numeric(14, 2),
  qty numeric(14, 2) not null default 0,
  inv_value numeric(14, 2),
  updated_at timestamptz not null default now(),
  unique (branch_code, item_code)
);

create index if not exists idx_test_profiles_branch on public.test_profiles(branch);
create index if not exists idx_test_profiles_role on public.test_profiles(role);
create index if not exists idx_test_orders_branch on public.test_orders(branch);
create index if not exists idx_test_orders_order_no on public.test_orders(order_no);
create index if not exists idx_test_orders_status on public.test_orders(status);
create index if not exists idx_test_orders_created_at on public.test_orders(created_at desc);
create index if not exists idx_test_order_items_order_id on public.test_order_items(order_id);
create index if not exists idx_test_order_items_part_no on public.test_order_items(part_no);
create index if not exists idx_test_order_events_order_id on public.test_order_events(order_id);
create index if not exists idx_test_order_comments_order_id on public.test_order_comments(order_id);
create index if not exists idx_test_inventory_current_branch_item on public.test_inventory_current(branch_code, item_code);

alter table public.test_profiles enable row level security;
alter table public.test_branch_mapping enable row level security;
alter table public.test_part_master enable row level security;
alter table public.test_orders enable row level security;
alter table public.test_order_items enable row level security;
alter table public.test_order_events enable row level security;
alter table public.test_order_comments enable row level security;
alter table public.test_inventory_uploads enable row level security;
alter table public.test_inventory_current enable row level security;

-- Temporary permissive policies for rebuild testing only.
-- Tighten these before real production cutover.

drop policy if exists test_profiles_read_all on public.test_profiles;
create policy test_profiles_read_all on public.test_profiles for select using (true);

drop policy if exists test_branch_mapping_read_all on public.test_branch_mapping;
create policy test_branch_mapping_read_all on public.test_branch_mapping for select using (true);

drop policy if exists test_part_master_read_all on public.test_part_master;
create policy test_part_master_read_all on public.test_part_master for select using (true);

drop policy if exists test_orders_read_all on public.test_orders;
create policy test_orders_read_all on public.test_orders for select using (true);

drop policy if exists test_order_items_read_all on public.test_order_items;
create policy test_order_items_read_all on public.test_order_items for select using (true);

drop policy if exists test_order_events_read_all on public.test_order_events;
create policy test_order_events_read_all on public.test_order_events for select using (true);

drop policy if exists test_order_comments_read_all on public.test_order_comments;
create policy test_order_comments_read_all on public.test_order_comments for select using (true);

drop policy if exists test_inventory_uploads_read_all on public.test_inventory_uploads;
create policy test_inventory_uploads_read_all on public.test_inventory_uploads for select using (true);

drop policy if exists test_inventory_current_read_all on public.test_inventory_current;
create policy test_inventory_current_read_all on public.test_inventory_current for select using (true);

-- Write policies are intentionally not added yet.
-- During first testing phase, use Supabase dashboard or controlled SQL seed files for sample data.
