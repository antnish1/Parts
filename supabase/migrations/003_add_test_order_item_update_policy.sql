drop policy if exists test_order_items_update_policy on public.test_order_items;

create policy test_order_items_update_policy
on public.test_order_items
for update
using (
  exists (
    select 1
    from public.test_orders o
    where o.id = order_id
      and o.order_no like 'TEST-%'
  )
)
with check (
  exists (
    select 1
    from public.test_orders o
    where o.id = order_id
      and o.order_no like 'TEST-%'
  )
);

drop policy if exists test_order_comments_insert_policy on public.test_order_comments;

create policy test_order_comments_insert_policy
on public.test_order_comments
for insert
with check (
  exists (
    select 1
    from public.test_orders o
    where o.id = order_id
      and o.order_no like 'TEST-%'
  )
);
