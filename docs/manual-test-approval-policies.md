# Manual test approval policies

Use this only for the rebuild test tables.

These policies allow test status changes only for orders whose order number starts with TEST-.

Run this in Supabase SQL Editor after the test tables exist.

```sql
create policy test_orders_update_policy
on public.test_orders
for update
using (order_no like 'TEST-%')
with check (order_no like 'TEST-%');

create policy test_order_events_read_policy
on public.test_order_events
for select
using (true);
```

Rollback:

```sql
drop policy if exists test_orders_update_policy on public.test_orders;
drop policy if exists test_order_events_read_policy on public.test_order_events;
```

This does not affect the live requests table.
