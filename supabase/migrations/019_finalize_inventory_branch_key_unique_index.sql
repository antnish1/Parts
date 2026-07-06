-- Use a non-partial unique index so portal_upload_inventory can upsert on (branch_key, item_code).
-- PostgreSQL allows multiple nulls in a unique index, but new uploads require mapped branch_key.

drop index if exists public.uq_portal_inventory_current_branch_key_item;

create unique index if not exists uq_portal_inventory_current_branch_key_item
on public.portal_inventory_current(branch_key, item_code);
