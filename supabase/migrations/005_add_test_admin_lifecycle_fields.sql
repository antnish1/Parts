alter table public.test_orders
add column if not exists final_order_no text,
add column if not exists dbms_invoice_no text,
add column if not exists dbms_invoice_date date,
add column if not exists received_date timestamptz,
add column if not exists docket_no text,
add column if not exists transport_name text;

create index if not exists idx_test_orders_final_order_no
on public.test_orders(final_order_no);

create index if not exists idx_test_orders_invoice_no
on public.test_orders(dbms_invoice_no);

create index if not exists idx_test_orders_docket_no
on public.test_orders(docket_no);
