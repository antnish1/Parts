create table if not exists public.test_order_item_billings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.test_orders(id) on delete cascade,
  item_id uuid not null references public.test_order_items(id) on delete cascade,
  order_no text not null,
  part_no text not null,
  billed_qty numeric(14, 2) not null default 0,
  billing_date date,
  order_reg_date date,
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
  created_by uuid references public.test_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_test_item_billings_order_id
on public.test_order_item_billings(order_id);

create index if not exists idx_test_item_billings_item_id
on public.test_order_item_billings(item_id);

create index if not exists idx_test_item_billings_part_no
on public.test_order_item_billings(part_no);

create index if not exists idx_test_item_billings_invoice_no
on public.test_order_item_billings(invoice_no);

create index if not exists idx_test_item_billings_docket_no
on public.test_order_item_billings(docket_no);

alter table public.test_order_item_billings enable row level security;

drop policy if exists test_order_item_billings_read_all on public.test_order_item_billings;
create policy test_order_item_billings_read_all
on public.test_order_item_billings
for select
using (true);
