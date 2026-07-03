alter table public.test_order_items
add column if not exists dbms_invoice_no text,
add column if not exists dbms_invoice_date date,
add column if not exists docket_no text,
add column if not exists transport_name text,
add column if not exists received_date timestamptz,
add column if not exists row_status text;

create index if not exists idx_test_order_items_invoice_no
on public.test_order_items(dbms_invoice_no);

create index if not exists idx_test_order_items_docket_no
on public.test_order_items(docket_no);
