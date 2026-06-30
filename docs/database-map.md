# Database migration map

This document maps the current single-table style implementation toward a production-grade normalized Supabase schema.

The current legacy implementation should remain operational until the new schema and app workflows are tested.

## Current database areas inferred from the legacy app

Current app references these Supabase tables or concepts:

```txt
users
requests
part_master
branch_mapping
inventory_staging
inventory_current
inventory_changes
```

Additional current concepts:

```txt
OrderNo
Branch
OrderType
OrderFor
EmployeeName
ApprovedBy
ApprovedBySuper
WarrantyStatus
CallID
MachineNo
CustomerName
PartNo
Qty
30dQty
Description
DNP
Value
editedqty
editedvalue
BilledQty
ProcessedDate
Status
ApprovalStatus
OrderComments
created_at
```

## Recommended production schema

### profiles

Replaces unsafe frontend user/password access.

```sql
create table profiles (
  id uuid primary key references auth.users(id),
  full_name text not null,
  branch text not null,
  role text not null check (role in ('branch','admin','super','manager','viewer','developer')),
  is_active boolean default true,
  created_at timestamptz default now()
);
```

Migration notes:

- Migrate current `users.Name` to `profiles.full_name`.
- Migrate current `users.Branch` to `profiles.branch`.
- Migrate current `users.Role` to `profiles.role`.
- Do not migrate readable passwords into the new frontend-accessible profile table.
- Create real Supabase Auth users for each active user.

### orders

Stores one row per order number.

```sql
create table orders (
  id uuid primary key default gen_random_uuid(),
  order_no text unique not null,
  branch text not null,
  order_type text not null,
  order_for text not null,
  employee_id uuid references profiles(id),
  approver_id uuid references profiles(id),
  approved_by_name text,
  machine_no text,
  customer_name text,
  call_id text,
  warranty_status text,
  status text not null,
  approval_status text not null,
  processed_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Mapping from current `requests`:

```txt
requests.OrderNo          -> orders.order_no
requests.Branch           -> orders.branch
requests.OrderType        -> orders.order_type
requests.OrderFor         -> orders.order_for
requests.EmployeeName     -> profiles/full_name lookup or orders legacy field
requests.ApprovedBy       -> approver_id or approved_by_name
requests.MachineNo        -> orders.machine_no
requests.CustomerName     -> orders.customer_name
requests.CallID           -> orders.call_id
requests.WarrantyStatus   -> orders.warranty_status
requests.Status           -> orders.status
requests.ApprovalStatus   -> orders.approval_status
requests.ProcessedDate    -> orders.processed_date
requests.created_at       -> orders.created_at
```

### order_items

Stores one row per part item in an order.

```sql
create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  part_no text not null,
  description text,
  dnp numeric,
  qty numeric not null,
  edited_qty numeric,
  billed_qty numeric,
  value numeric,
  edited_value numeric,
  previous_30d_qty numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Mapping from current `requests`:

```txt
requests.PartNo       -> order_items.part_no
requests.Description  -> order_items.description
requests.DNP          -> order_items.dnp
requests.Qty          -> order_items.qty
requests.editedqty    -> order_items.edited_qty
requests.BilledQty    -> order_items.billed_qty
requests.Value        -> order_items.value
requests.editedvalue  -> order_items.edited_value
requests.30dQty       -> order_items.previous_30d_qty
```

### order_events

Stores audit history.

```sql
create table order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  event_type text not null,
  old_status text,
  new_status text,
  actor_id uuid references profiles(id),
  notes text,
  metadata jsonb,
  created_at timestamptz default now()
);
```

Migration notes:

- Convert existing system comments/action comments into events where possible.
- New app should insert events through backend workflow functions only.

### order_comments

Stores user comments separately from system events.

```sql
create table order_comments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id),
  author_id uuid references profiles(id),
  comment_type text default 'user',
  body text,
  attachment_path text,
  created_at timestamptz default now()
);
```

Migration notes:

- Parse existing `requests.OrderComments` JSON where possible.
- User comments go to `order_comments`.
- System action comments go to `order_events`.
- Attachments should move to Supabase Storage.

### part_master

Can remain mostly as-is initially.

Recommended minimum fields:

```sql
part_master (
  part_no text primary key,
  description text,
  dnp numeric,
  cat1 text,
  cat2 text,
  updated_at timestamptz
)
```

Current app fields:

```txt
PartNo
Description
DNP
Cat1
```

### branch_mapping

Can remain as-is initially, but normalize names.

Recommended fields:

```sql
branch_mapping (
  id uuid primary key default gen_random_uuid(),
  branch_name text not null,
  branch_code text not null unique,
  is_active boolean default true
)
```

Current app supports aliases such as:

```txt
branchname
branch_name
branchcode
branch_code
```

The rebuild should use consistent snake_case fields.

### inventory_staging

Temporary inventory import table.

Recommended fields:

```sql
inventory_staging (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid references inventory_uploads(id),
  report_date date not null,
  item_code text not null,
  item_name text,
  item_group text,
  branch_code text not null,
  rec_flag text,
  nsp_flag text,
  uom text,
  dnp numeric,
  opening_balance numeric,
  opening_inv_val numeric,
  received_qty numeric,
  issued_qty numeric,
  qty numeric,
  inv_value numeric,
  created_at timestamptz default now()
)
```

### inventory_current

Latest stock position.

```sql
inventory_current (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  branch_code text not null,
  item_code text not null,
  item_name text,
  item_group text,
  uom text,
  dnp numeric,
  qty numeric,
  inv_value numeric,
  updated_at timestamptz default now(),
  unique(branch_code, item_code)
)
```

### inventory_changes

Inventory change history.

```sql
inventory_changes (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  branch_code text not null,
  item_code text not null,
  prev_qty numeric,
  new_qty numeric,
  delta_qty numeric,
  created_at timestamptz default now()
)
```

### inventory_uploads

Upload audit/history.

```sql
inventory_uploads (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid references profiles(id),
  report_date date not null,
  filename text,
  total_rows int,
  valid_rows int,
  failed_rows int,
  status text,
  error_summary text,
  created_at timestamptz default now()
)
```

## Recommended views

### v_order_summary

One row per order with aggregated item totals.

Should include:

```txt
order_id
order_no
branch
order_type
order_for
customer_name
machine_no
status
approval_status
created_at
item_count
total_qty
total_value
comment_count
```

### v_branch_order_summary

Branch-wise dashboard summary.

### v_status_order_summary

Status-wise dashboard summary.

### v_inventory_availability_summary

Inventory availability by branch/item.

## Recommended RPC / backend functions

```txt
create_order
approve_order
reject_order
forward_to_manager
manager_approve_order
manager_reject_order
process_order
update_order_status
add_order_comment
upload_inventory_batch
lookup_inventory_availability
```

## Migration sequence

1. Keep legacy `requests` table and current `index.html` working.
2. Create new tables beside existing tables.
3. Backfill `profiles` from existing users.
4. Backfill `orders` and `order_items` from `requests` grouped by `OrderNo`.
5. Backfill comments/events from `OrderComments` if possible.
6. Build new app reads from new views/tables.
7. Run both systems in parallel for testing.
8. Switch writes to new backend functions.
9. Freeze old `requests` writes.
10. Keep old table read-only temporarily for rollback/reference.

## Important warning

Do not drop or rename existing production tables until the new application has been tested end-to-end and all historical reports are verified.
