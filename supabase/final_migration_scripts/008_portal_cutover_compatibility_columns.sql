-- FINAL MIGRATION SCRIPT 008
-- Portal cutover compatibility columns.
-- Safe to re-run. Adds missing columns only.

alter table public.portal_orders
add column if not exists order_reg_date date;

alter table public.portal_inventory_staging
add column if not exists upload_batch_id uuid,
add column if not exists opening_balance numeric(14, 2) not null default 0,
add column if not exists opening_value numeric(14, 2),
add column if not exists received_qty numeric(14, 2) not null default 0,
add column if not exists issued_qty numeric(14, 2) not null default 0;

create index if not exists idx_portal_inventory_staging_batch on public.portal_inventory_staging(upload_batch_id);
create index if not exists idx_portal_orders_order_reg_date on public.portal_orders(order_reg_date);

with per_order as (
  select
    order_id,
    case when count(distinct order_reg_date) filter (where order_reg_date is not null) = 1
      then min(order_reg_date)
      else null
    end as only_order_reg_date
  from public.portal_order_items
  group by order_id
)
update public.portal_orders o
set order_reg_date = p.only_order_reg_date,
    updated_at = now()
from per_order p
where p.order_id = o.id
  and o.order_reg_date is null
  and p.only_order_reg_date is not null;

select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name in ('portal_orders', 'portal_inventory_staging')
  and column_name in ('order_reg_date', 'upload_batch_id', 'opening_balance', 'opening_value', 'received_qty', 'issued_qty')
order by table_name, column_name;
