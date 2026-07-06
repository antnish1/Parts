-- FINAL MIGRATION SCRIPT 006
-- Direct fix for legacy order registration dates stored as DD.MM.YYYY.
--
-- Example values fixed by this script:
-- 12.05.2026
-- 09.05.2026
-- 08.05.2026
-- 07.05.2026
--
-- Safety:
-- - Updates only public.portal_order_items imported from public.requests.
-- - Updates only rows where order_reg_date is currently NULL.
-- - Does not modify public.requests.
-- - Does not delete anything.
-- - Safe to re-run.

-- 1) Preview rows that will be fixed.
select
  count(*) as dot_format_order_reg_dates_to_fix
from public.portal_order_items
where legacy_source = 'requests'
  and order_reg_date is null
  and trim(coalesce(order_reg_date_raw, '')) ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{4}$';

-- 2) Fix DD.MM.YYYY order registration dates.
update public.portal_order_items
set
  order_reg_date = to_date(trim(order_reg_date_raw), 'DD.MM.YYYY'),
  updated_at = now()
where legacy_source = 'requests'
  and order_reg_date is null
  and trim(coalesce(order_reg_date_raw, '')) ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{4}$';

-- 3) Verification. This should return zero rows for DD.MM.YYYY values.
select i.legacy_request_id, o.order_no, i.part_no, i.order_reg_date_raw
from public.portal_order_items i
join public.portal_orders o on o.id = i.order_id
where i.legacy_source = 'requests'
  and i.order_reg_date is null
  and trim(coalesce(i.order_reg_date_raw, '')) ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{4}$'
order by i.created_at desc
limit 100;

-- 4) Remaining unparsed order registration dates of any format.
select i.legacy_request_id, o.order_no, i.part_no, i.order_reg_date_raw
from public.portal_order_items i
join public.portal_orders o on o.id = i.order_id
where i.legacy_source = 'requests'
  and nullif(trim(coalesce(i.order_reg_date_raw, '')), '') is not null
  and i.order_reg_date is null
order by i.created_at desc
limit 100;
