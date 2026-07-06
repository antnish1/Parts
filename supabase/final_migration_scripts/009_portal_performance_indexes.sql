-- FINAL MIGRATION SCRIPT 009
-- Performance indexes for portal cutover screens.
-- Safe to re-run.

create index if not exists idx_portal_orders_approval_created
on public.portal_orders (approval_status, created_at desc);

create index if not exists idx_portal_orders_approver_approval_created
on public.portal_orders (approver_id, approval_status, created_at desc);

create index if not exists idx_portal_orders_branch_created
on public.portal_orders (branch, created_at desc);

create index if not exists idx_portal_items_order_created
on public.portal_order_items (order_id, created_at);

create index if not exists idx_portal_items_order_part_created
on public.portal_order_items (order_id, part_no, created_at);

create index if not exists idx_portal_billings_order_created
on public.portal_order_item_billings (order_id, created_at);

create index if not exists idx_portal_billings_item_created
on public.portal_order_item_billings (item_id, created_at);

create index if not exists idx_portal_comments_order_type_created
on public.portal_order_comments (order_id, comment_type, created_at desc);

create index if not exists idx_portal_events_order_created
on public.portal_order_events (order_id, created_at desc);
