# Manual test write policies

Use this only after the test tables and seed data are created.

These policies are for the rebuild test tables only. They do not affect the live requests table.

Open Supabase SQL Editor and run this:

```sql
create policy test_orders_insert_policy
on public.test_orders
for insert
with check (order_no like 'TEST-%');

create policy test_order_items_insert_policy
on public.test_order_items
for insert
with check (
  exists (
    select 1
    from public.test_orders
    where test_orders.id = test_order_items.order_id
      and test_orders.order_no like 'TEST-%'
  )
);

create policy test_order_events_insert_policy
on public.test_order_events
for insert
with check (
  exists (
    select 1
    from public.test_orders
    where test_orders.id = test_order_events.order_id
      and test_orders.order_no like 'TEST-%'
  )
);
```

After running this, the rebuild New Order page can create test orders only.

If you need to remove these policies later, run:

```sql
drop policy if exists test_orders_insert_policy on public.test_orders;
drop policy if exists test_order_items_insert_policy on public.test_order_items;
drop policy if exists test_order_events_insert_policy on public.test_order_events;
```
