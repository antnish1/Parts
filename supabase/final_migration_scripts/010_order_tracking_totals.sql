-- FINAL MIGRATION SCRIPT 010
-- Add and backfill order-level tracking totals for fast Track Orders display.
-- Safe to re-run.

alter table public.portal_orders
add column if not exists total_qty numeric(14, 2) not null default 0,
add column if not exists total_value numeric(14, 2) not null default 0,
add column if not exists comment_count int not null default 0;

with item_totals as (
  select
    order_id,
    sum(coalesce(edited_qty, qty, 0)) as total_qty,
    sum(coalesce(edited_value, value, coalesce(dnp, 0) * coalesce(edited_qty, qty, 0), 0)) as total_value
  from public.portal_order_items
  group by order_id
), comment_totals as (
  select order_id, count(*)::int as comment_count
  from public.portal_order_comments
  where comment_type = 'user'
  group by order_id
)
update public.portal_orders o
set
  total_qty = coalesce(i.total_qty, 0),
  total_value = coalesce(i.total_value, 0),
  comment_count = coalesce(c.comment_count, 0),
  updated_at = now()
from item_totals i
left join comment_totals c on c.order_id = i.order_id
where o.id = i.order_id;

update public.portal_orders o
set comment_count = coalesce(c.comment_count, 0),
    updated_at = now()
from comment_totals c
where o.id = c.order_id;

create index if not exists idx_portal_orders_total_qty on public.portal_orders(total_qty);
create index if not exists idx_portal_orders_total_value on public.portal_orders(total_value);

select
  count(*) as orders,
  sum(total_qty) as total_qty,
  sum(total_value) as total_value
from public.portal_orders;
