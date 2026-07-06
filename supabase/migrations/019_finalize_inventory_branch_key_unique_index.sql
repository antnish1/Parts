-- Use a non-partial unique index so portal_upload_inventory can upsert on (branch_key, item_code).
-- Existing imports may have duplicates after branch alias resolution, so keep only the latest row.

with ranked_inventory as (
  select
    id,
    row_number() over (
      partition by branch_key, item_code
      order by report_date desc nulls last, updated_at desc nulls last, id desc
    ) as rn
  from public.portal_inventory_current
  where branch_key is not null
    and nullif(trim(item_code), '') is not null
)
delete from public.portal_inventory_current c
using ranked_inventory r
where c.id = r.id
  and r.rn > 1;

drop index if exists public.uq_portal_inventory_current_branch_key_item;

create unique index if not exists uq_portal_inventory_current_branch_key_item
on public.portal_inventory_current(branch_key, item_code);
