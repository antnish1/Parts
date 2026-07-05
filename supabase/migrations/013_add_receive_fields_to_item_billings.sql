alter table public.test_order_item_billings
add column if not exists received_qty numeric(14, 2) not null default 0,
add column if not exists received_at timestamptz,
add column if not exists received_by uuid references public.test_profiles(id);

create index if not exists idx_test_item_billings_received_at
on public.test_order_item_billings(received_at);
