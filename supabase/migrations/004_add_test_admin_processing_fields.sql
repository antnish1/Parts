alter table public.test_orders
add column if not exists processing_reference text,
add column if not exists processed_notes text;

create index if not exists idx_test_orders_processing_reference
on public.test_orders(processing_reference);
