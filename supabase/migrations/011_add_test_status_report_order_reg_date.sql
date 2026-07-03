alter table public.test_orders
add column if not exists order_reg_date date;

alter table public.test_order_items
add column if not exists order_reg_date date;

create index if not exists idx_test_orders_order_reg_date
on public.test_orders(order_reg_date);

create index if not exists idx_test_order_items_order_reg_date
on public.test_order_items(order_reg_date);
