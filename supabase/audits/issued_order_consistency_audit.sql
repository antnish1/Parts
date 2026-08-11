-- Read-only audit for historical Issued-order consistency.
-- Safe to run in production: SELECT statements only.
--
-- Purpose:
-- 1) Find orders whose header says ISSUED but issued_at is NULL.
-- 2) Find orders with issued_at populated but header status is not ISSUED.
-- 3) Find orders whose item rows say ISSUED while the header does not.
-- 4) Find orders with an order_issued audit event but missing issued_at.
-- 5) Surface likely Pending Issue false-positives caused by legacy metadata.

with item_status as (
  select
    i.order_id,
    count(*) as item_count,
    count(*) filter (
      where upper(regexp_replace(coalesce(i.row_status, ''), '[^A-Z0-9]+', '_', 'g')) = 'ISSUED'
    ) as issued_item_count,
    count(*) filter (
      where upper(regexp_replace(coalesce(i.row_status, ''), '[^A-Z0-9]+', '_', 'g')) in ('RECEIVED', 'FULLY_RECEIVED')
    ) as received_item_count
  from public.portal_order_items i
  group by i.order_id
),
issued_events as (
  select
    e.order_id,
    max(e.created_at) filter (
      where lower(coalesce(e.event_type, '')) = 'order_issued'
         or upper(regexp_replace(coalesce(e.new_status, ''), '[^A-Z0-9]+', '_', 'g')) = 'ISSUED'
    ) as latest_issued_event_at,
    count(*) filter (
      where lower(coalesce(e.event_type, '')) = 'order_issued'
         or upper(regexp_replace(coalesce(e.new_status, ''), '[^A-Z0-9]+', '_', 'g')) = 'ISSUED'
    ) as issued_event_count
  from public.portal_order_events e
  group by e.order_id
),
resolved as (
  select
    o.id,
    o.order_no,
    o.final_order_no,
    o.branch,
    o.order_for,
    o.status,
    o.received_date,
    o.issued_at,
    o.issued_document_type,
    o.issued_document_no,
    coalesce(s.item_count, 0) as item_count,
    coalesce(s.issued_item_count, 0) as issued_item_count,
    coalesce(s.received_item_count, 0) as received_item_count,
    coalesce(ev.issued_event_count, 0) as issued_event_count,
    ev.latest_issued_event_at,
    upper(regexp_replace(coalesce(o.status, ''), '[^A-Z0-9]+', '_', 'g')) as normalized_header_status
  from public.portal_orders o
  left join item_status s on s.order_id = o.id
  left join issued_events ev on ev.order_id = o.id
)
select
  id,
  order_no,
  final_order_no,
  branch,
  order_for,
  status,
  received_date,
  issued_at,
  issued_document_type,
  issued_document_no,
  item_count,
  issued_item_count,
  received_item_count,
  issued_event_count,
  latest_issued_event_at,
  case
    when normalized_header_status = 'ISSUED' and issued_at is null
      then 'HEADER_ISSUED_BUT_ISSUED_AT_NULL'
    when issued_at is not null and normalized_header_status <> 'ISSUED'
      then 'ISSUED_AT_SET_BUT_HEADER_NOT_ISSUED'
    when issued_item_count > 0 and normalized_header_status <> 'ISSUED'
      then 'ITEMS_ISSUED_BUT_HEADER_NOT_ISSUED'
    when issued_event_count > 0 and issued_at is null
      then 'ISSUED_EVENT_EXISTS_BUT_ISSUED_AT_NULL'
    when lower(coalesce(order_for, '')) = 'customer'
      and issued_at is null
      and normalized_header_status = 'ISSUED'
      and item_count > 0
      and received_item_count = item_count
      then 'PENDING_ISSUE_FALSE_POSITIVE_RISK'
    else 'OTHER'
  end as inconsistency
from resolved
where
     (normalized_header_status = 'ISSUED' and issued_at is null)
  or (issued_at is not null and normalized_header_status <> 'ISSUED')
  or (issued_item_count > 0 and normalized_header_status <> 'ISSUED')
  or (issued_event_count > 0 and issued_at is null)
order by
  case
    when lower(coalesce(order_for, '')) = 'customer'
      and issued_at is null
      and normalized_header_status = 'ISSUED'
      then 0
    else 1
  end,
  coalesce(latest_issued_event_at, received_date) desc nulls last,
  order_no;
