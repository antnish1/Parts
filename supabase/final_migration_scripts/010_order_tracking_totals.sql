-- FINAL MIGRATION SCRIPT 010
-- Add, backfill, and maintain order-level tracking totals for fast Track Orders display.
-- Safe to re-run.

alter table public.portal_orders
add column if not exists total_qty numeric(14, 2) not null default 0,
add column if not exists total_value numeric(14, 2) not null default 0,
add column if not exists comment_count int not null default 0;

create or replace function public.portal_refresh_order_tracking_totals(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.portal_orders o
  set
    total_qty = coalesce((
      select sum(coalesce(i.edited_qty, i.qty, 0))
      from public.portal_order_items i
      where i.order_id = p_order_id
    ), 0),
    total_value = coalesce((
      select sum(coalesce(i.edited_value, i.value, coalesce(i.dnp, 0) * coalesce(i.edited_qty, i.qty, 0), 0))
      from public.portal_order_items i
      where i.order_id = p_order_id
    ), 0),
    comment_count = coalesce((
      select count(*)::int
      from public.portal_order_comments c
      where c.order_id = p_order_id
        and c.comment_type = 'user'
    ), 0),
    updated_at = now()
  where o.id = p_order_id;
end;
$$;

create or replace function public.portal_refresh_order_tracking_totals_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.portal_refresh_order_tracking_totals(old.order_id);
    return old;
  end if;

  perform public.portal_refresh_order_tracking_totals(new.order_id);
  return new;
end;
$$;

with order_ids as (
  select id from public.portal_orders
)
select public.portal_refresh_order_tracking_totals(id)
from order_ids;

drop trigger if exists trg_portal_items_tracking_totals on public.portal_order_items;
create trigger trg_portal_items_tracking_totals
after insert or update or delete on public.portal_order_items
for each row execute function public.portal_refresh_order_tracking_totals_trigger();

drop trigger if exists trg_portal_comments_tracking_totals on public.portal_order_comments;
create trigger trg_portal_comments_tracking_totals
after insert or update or delete on public.portal_order_comments
for each row execute function public.portal_refresh_order_tracking_totals_trigger();

create index if not exists idx_portal_orders_total_qty on public.portal_orders(total_qty);
create index if not exists idx_portal_orders_total_value on public.portal_orders(total_value);

select
  count(*) as orders,
  sum(total_qty) as total_qty,
  sum(total_value) as total_value
from public.portal_orders;
