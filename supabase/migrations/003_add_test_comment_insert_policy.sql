-- Staging-only write policy for adding comments to test orders.
-- Touches only test_order_comments and keeps production tables unchanged.

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
