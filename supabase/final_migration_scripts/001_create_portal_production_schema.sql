-- FINAL MIGRATION SCRIPT 001
-- Create production portal tables.
-- Safe/additive: this script creates only new portal_* tables and indexes.
-- It does not delete, rename, or overwrite legacy tables such as requests, users, part_master, machine_master or inventory_current.

create extension if not exists pgcrypto;

create table if not exists public.portal_profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null,
  branch text not null,
  role text not null check (role in ('branch', 'admin', 'super', 'manager', 'viewer', 'developer')),
  is_active boolean not null default true,
  legacy_user_id text,
  legacy_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  final_order_no text,
  processing_reference text,
  branch text not null,
  order_type text not null default 'SOP',
  order_for text not null default 'Stock',
  employee_id uuid references public.portal_profiles(id),
  approver_id uuid references public.portal_profiles(id),
  employee_name_legacy text,
  approved_by_name text,
  approved_by_super_name text,
  machine_no text,
  customer_name text,
  contact_no text,
  call_id text,
  warranty_status text,
  status text not null default 'pending_approval',
  approval_status text not null default 'pending',
  processed_date date,
  processed_date_raw text,
  processed_notes text,
  dbms_invoice_no text,
  dbms_invoice_date date,
  received_date timestamptz,
  docket_no text,
  transport_name text,
  legacy_source text not null default 'portal',
  legacy_order_no text,
  legacy_status text,
  legacy_approval_status text,
  legacy_created_at timestamptz,
  legacy_request_count int not null default 0,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.portal_orders(id) on delete cascade,
  part_no text not null,
  description text,
  dnp numeric(14, 2),
  qty numeric(14, 2) not null default 0,
  edited_qty numeric(14, 2),
  billed_qty numeric(14, 2) not null default 0,
  value numeric(14, 2),
  edited_value numeric(14, 2),
  previous_30d_qty numeric(14, 2) not null default 0,
  pending_qty_legacy numeric(14, 2),
  dispatch_status_legacy text,
  order_reg_date date,
  order_reg_date_raw text,
  dbms_invoice_no text,
  dbms_invoice_date date,
  docket_no text,
  transport_name text,
  received_date timestamptz,
  row_status text,
  legacy_source text not null default 'portal',
  legacy_request_id text,
  legacy_status text,
  legacy_approval_status text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_order_item_billings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.portal_orders(id) on delete cascade,
  item_id uuid not null references public.portal_order_items(id) on delete cascade,
  order_no text not null,
  part_no text not null,
  billed_qty numeric(14, 2) not null default 0,
  received_qty numeric(14, 2) not null default 0,
  billing_date date,
  billing_date_raw text,
  order_reg_date date,
  order_reg_date_raw text,
  delivery_no text,
  invoice_no text,
  docket_no text,
  transport_name text,
  transport_mode text,
  packing_detail text,
  eway_bill_no text,
  gst_invoice_no text,
  raw_status text,
  source text not null default 'status_report_upload',
  idempotency_key text not null unique,
  created_by uuid references public.portal_profiles(id),
  received_at timestamptz,
  received_by uuid references public.portal_profiles(id),
  legacy_request_id text,
  imported_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.portal_orders(id) on delete cascade,
  event_type text not null,
  old_status text,
  new_status text,
  actor_id uuid references public.portal_profiles(id),
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  legacy_request_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_order_comments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.portal_orders(id) on delete cascade,
  author_id uuid references public.portal_profiles(id),
  comment_type text not null default 'user',
  body text,
  attachment_path text,
  legacy_request_id text,
  legacy_payload jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_order_comment_attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.portal_orders(id) on delete cascade,
  comment_id uuid references public.portal_order_comments(id) on delete cascade,
  storage_bucket text not null default 'portal-comment-attachments',
  storage_path text not null,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references public.portal_profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.portal_inventory_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references public.portal_profiles(id),
  report_date date not null,
  filename text,
  total_rows int not null default 0,
  valid_rows int not null default 0,
  failed_rows int not null default 0,
  status text not null default 'draft',
  error_summary text,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_inventory_current (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  branch_code text not null,
  branch_name text,
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

create table if not exists public.portal_inventory_staging (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.portal_inventory_uploads(id) on delete cascade,
  report_date date not null,
  branch_code text not null,
  branch_name text,
  item_code text not null,
  item_name text,
  item_group text,
  uom text,
  dnp numeric(14, 2),
  closing_balance numeric(14, 2) not null default 0,
  closing_value numeric(14, 2),
  source_filename text,
  row_no int,
  error_text text,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_inventory_changes (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references public.portal_inventory_uploads(id) on delete set null,
  report_date date not null,
  branch_code text not null,
  branch_name text,
  item_code text not null,
  item_name text,
  old_qty numeric(14, 2),
  new_qty numeric(14, 2),
  old_value numeric(14, 2),
  new_value numeric(14, 2),
  change_type text not null,
  source_filename text,
  created_at timestamptz not null default now()
);

create index if not exists idx_portal_profiles_auth_user_id on public.portal_profiles(auth_user_id);
create index if not exists idx_portal_profiles_branch on public.portal_profiles(branch);
create index if not exists idx_portal_profiles_role on public.portal_profiles(role);

create index if not exists idx_portal_orders_branch on public.portal_orders(branch);
create index if not exists idx_portal_orders_order_no on public.portal_orders(order_no);
create index if not exists idx_portal_orders_final_order_no on public.portal_orders(final_order_no);
create index if not exists idx_portal_orders_processing_reference on public.portal_orders(processing_reference);
create index if not exists idx_portal_orders_status on public.portal_orders(status);
create index if not exists idx_portal_orders_approval_status on public.portal_orders(approval_status);
create index if not exists idx_portal_orders_created_at on public.portal_orders(created_at desc);
create index if not exists idx_portal_orders_legacy_order_no on public.portal_orders(legacy_order_no);

create index if not exists idx_portal_items_order_id on public.portal_order_items(order_id);
create index if not exists idx_portal_items_part_no on public.portal_order_items(part_no);
create index if not exists idx_portal_items_row_status on public.portal_order_items(row_status);
create index if not exists idx_portal_items_invoice_no on public.portal_order_items(dbms_invoice_no);
create index if not exists idx_portal_items_docket_no on public.portal_order_items(docket_no);
create unique index if not exists uq_portal_items_legacy_request_id on public.portal_order_items(legacy_request_id) where legacy_request_id is not null;

create index if not exists idx_portal_billings_order_id on public.portal_order_item_billings(order_id);
create index if not exists idx_portal_billings_item_id on public.portal_order_item_billings(item_id);
create index if not exists idx_portal_billings_part_no on public.portal_order_item_billings(part_no);
create index if not exists idx_portal_billings_invoice_no on public.portal_order_item_billings(invoice_no);
create index if not exists idx_portal_billings_docket_no on public.portal_order_item_billings(docket_no);
create index if not exists idx_portal_billings_received_at on public.portal_order_item_billings(received_at);
create index if not exists idx_portal_billings_legacy_request_id on public.portal_order_item_billings(legacy_request_id);

create index if not exists idx_portal_events_order_id on public.portal_order_events(order_id);
create index if not exists idx_portal_events_created_at on public.portal_order_events(created_at desc);
create index if not exists idx_portal_comments_order_id on public.portal_order_comments(order_id);
create index if not exists idx_portal_comment_attachments_order_id on public.portal_order_comment_attachments(order_id);
create index if not exists idx_portal_inventory_current_branch_item on public.portal_inventory_current(branch_code, item_code);
create index if not exists idx_portal_inventory_current_item on public.portal_inventory_current(item_code);
create index if not exists idx_portal_inventory_staging_upload on public.portal_inventory_staging(upload_id);
create index if not exists idx_portal_inventory_changes_upload on public.portal_inventory_changes(upload_id);

alter table public.portal_profiles enable row level security;
alter table public.portal_orders enable row level security;
alter table public.portal_order_items enable row level security;
alter table public.portal_order_item_billings enable row level security;
alter table public.portal_order_events enable row level security;
alter table public.portal_order_comments enable row level security;
alter table public.portal_order_comment_attachments enable row level security;
alter table public.portal_inventory_uploads enable row level security;
alter table public.portal_inventory_current enable row level security;
alter table public.portal_inventory_staging enable row level security;
alter table public.portal_inventory_changes enable row level security;

-- Initial read policies. Write actions should remain controlled by Edge Functions/service role until final RLS is reviewed.
drop policy if exists portal_profiles_read_authenticated on public.portal_profiles;
create policy portal_profiles_read_authenticated on public.portal_profiles for select to authenticated using (true);

drop policy if exists portal_orders_read_authenticated on public.portal_orders;
create policy portal_orders_read_authenticated on public.portal_orders for select to authenticated using (true);

drop policy if exists portal_items_read_authenticated on public.portal_order_items;
create policy portal_items_read_authenticated on public.portal_order_items for select to authenticated using (true);

drop policy if exists portal_billings_read_authenticated on public.portal_order_item_billings;
create policy portal_billings_read_authenticated on public.portal_order_item_billings for select to authenticated using (true);

drop policy if exists portal_events_read_authenticated on public.portal_order_events;
create policy portal_events_read_authenticated on public.portal_order_events for select to authenticated using (true);

drop policy if exists portal_comments_read_authenticated on public.portal_order_comments;
create policy portal_comments_read_authenticated on public.portal_order_comments for select to authenticated using (true);

drop policy if exists portal_attachments_read_authenticated on public.portal_order_comment_attachments;
create policy portal_attachments_read_authenticated on public.portal_order_comment_attachments for select to authenticated using (true);

drop policy if exists portal_inventory_uploads_read_authenticated on public.portal_inventory_uploads;
create policy portal_inventory_uploads_read_authenticated on public.portal_inventory_uploads for select to authenticated using (true);

drop policy if exists portal_inventory_current_read_authenticated on public.portal_inventory_current;
create policy portal_inventory_current_read_authenticated on public.portal_inventory_current for select to authenticated using (true);

drop policy if exists portal_inventory_staging_read_authenticated on public.portal_inventory_staging;
create policy portal_inventory_staging_read_authenticated on public.portal_inventory_staging for select to authenticated using (true);

drop policy if exists portal_inventory_changes_read_authenticated on public.portal_inventory_changes;
create policy portal_inventory_changes_read_authenticated on public.portal_inventory_changes for select to authenticated using (true);
