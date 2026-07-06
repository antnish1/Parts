-- FINAL MIGRATION SCRIPT 003
-- Read-only reconciliation checks after importing legacy requests into portal_* tables.
-- This script does not modify data.

-- 1) Basic legacy vs imported count check.
select 'legacy requests rows' as check_name, count(*)::text as result
from public.requests
union all
select 'portal imported item rows', count(*)::text
from public.portal_order_items
where legacy_source = 'requests'
union all
select 'legacy distinct order no', count(distinct coalesce(nullif(trim("OrderNo"), ''), 'LEGACY-REQ-' || id::text))::text
from public.requests
union all
select 'portal imported orders', count(*)::text
from public.portal_orders
where legacy_source = 'requests';

-- 2) Rows missing after import.
select r.id, r."OrderNo", r."PartNo", r."Status"
from public.requests r
left join public.portal_order_items i on i.legacy_request_id = r.id::text
where i.id is null
order by r.id
limit 100;

-- 3) Imported items without matching legacy request. Should normally return zero rows.
select i.id, i.legacy_request_id, i.part_no, i.row_status
from public.portal_order_items i
left join public.requests r on r.id::text = i.legacy_request_id
where i.legacy_source = 'requests'
  and r.id is null
order by i.created_at desc
limit 100;

-- 4) Legacy status distribution.
select coalesce("Status", 'NULL') as legacy_status, count(*)
from public.requests
group by coalesce("Status", 'NULL')
order by count(*) desc;

-- 5) Portal item status distribution after import.
select coalesce(row_status, 'NULL') as portal_item_status, count(*)
from public.portal_order_items
where legacy_source = 'requests'
group by coalesce(row_status, 'NULL')
order by count(*) desc;

-- 6) Portal order status distribution after import.
select coalesce(status, 'NULL') as portal_order_status, count(*)
from public.portal_orders
where legacy_source = 'requests'
group by coalesce(status, 'NULL')
order by count(*) desc;

-- 7) Approval status mapping check.
select coalesce("ApprovalStatus", 'NULL') as legacy_approval_status, count(*)
from public.requests
group by coalesce("ApprovalStatus", 'NULL')
order by count(*) desc;

select coalesce(approval_status, 'NULL') as portal_approval_status, count(*)
from public.portal_orders
where legacy_source = 'requests'
group by coalesce(approval_status, 'NULL')
order by count(*) desc;

-- 8) Closed statuses that must be excluded from active/in-transit calculations.
select row_status, count(*)
from public.portal_order_items
where legacy_source = 'requests'
  and row_status in ('received', 'issued', 'rejected')
group by row_status
order by row_status;

-- 9) Active statuses that may appear in dashboard/in-transit calculations.
select row_status, count(*)
from public.portal_order_items
where legacy_source = 'requests'
  and row_status not in ('received', 'issued', 'rejected')
group by row_status
order by count(*) desc;

-- 10) Billing chunks count and total qty.
select
  count(*) as billing_chunk_count,
  sum(billed_qty) as total_billed_qty,
  sum(received_qty) as total_received_qty
from public.portal_order_item_billings
where source = 'legacy_requests_import';

-- 11) Docket-wise imported row sample for scanner verification.
select docket_no, count(*) as row_count, sum(billed_qty) as billed_qty, sum(received_qty) as received_qty
from public.portal_order_item_billings
where source = 'legacy_requests_import'
  and nullif(trim(coalesce(docket_no, '')), '') is not null
group by docket_no
order by row_count desc
limit 50;

-- 12) Orders with mixed closed and active item rows. Review sample.
select o.order_no, o.status, count(*) as item_count,
       count(*) filter (where i.row_status in ('received', 'issued', 'rejected')) as closed_rows,
       count(*) filter (where i.row_status not in ('received', 'issued', 'rejected')) as active_rows
from public.portal_orders o
join public.portal_order_items i on i.order_id = o.id
where o.legacy_source = 'requests'
group by o.order_no, o.status
having count(*) filter (where i.row_status in ('received', 'issued', 'rejected')) > 0
   and count(*) filter (where i.row_status not in ('received', 'issued', 'rejected')) > 0
order by active_rows desc, item_count desc
limit 100;

-- 13) Date parse failures to review.
select legacy_request_id, order_no, part_no, order_reg_date_raw
from public.portal_order_items i
join public.portal_orders o on o.id = i.order_id
where i.legacy_source = 'requests'
  and nullif(trim(coalesce(i.order_reg_date_raw, '')), '') is not null
  and i.order_reg_date is null
order by i.created_at desc
limit 100;

select id, order_no, processed_date_raw
from public.portal_orders
where legacy_source = 'requests'
  and nullif(trim(coalesce(processed_date_raw, '')), '') is not null
  and processed_date is null
order by created_at desc
limit 100;

-- 14) Duplicate part rows within the same imported order. Expected because migration preserves one row per legacy requests.id.
select o.order_no, i.part_no, count(*) as row_count
from public.portal_orders o
join public.portal_order_items i on i.order_id = o.id
where i.legacy_source = 'requests'
group by o.order_no, i.part_no
having count(*) > 1
order by row_count desc
limit 100;

-- 15) Final go/no-go summary.
select
  (select count(*) from public.requests) as legacy_request_rows,
  (select count(*) from public.portal_order_items where legacy_source = 'requests') as imported_item_rows,
  (select count(distinct coalesce(nullif(trim("OrderNo"), ''), 'LEGACY-REQ-' || id::text)) from public.requests) as legacy_order_count,
  (select count(*) from public.portal_orders where legacy_source = 'requests') as imported_order_count,
  (select count(*) from public.portal_order_item_billings where source = 'legacy_requests_import') as imported_billing_chunks;
