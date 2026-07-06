-- FINAL MIGRATION SCRIPT 005
-- Fix legacy date formats after importing old requests into portal_* tables.
--
-- Why this exists:
-- Some legacy request date columns store dates in mixed formats:
-- - Excel serial dates such as 46122
-- - Dot dates such as 12.05.2026
-- - Slash dates such as 12/05/2026
-- - Dash dates such as 12-05-2026
-- Script 002 imported the raw value correctly, but some formats could not be parsed into real dates.
-- This script converts supported raw values into PostgreSQL dates.
--
-- Safety:
-- - This script only updates portal_* imported legacy rows where parsed date is currently NULL.
-- - It does not modify public.requests.
-- - It does not delete anything.
-- - It is safe to re-run.

-- 1) Improve the shared parser for future use.
create or replace function public.portal_try_date(raw_value text)
returns date
language plpgsql
immutable
as $$
declare
  v text := nullif(trim(raw_value), '');
  d date;
begin
  if v is null then return null; end if;

  -- Excel serial date, for example 46122.
  -- Excel's practical serial-date base for imported spreadsheet values is 1899-12-30.
  begin
    if v ~ '^\d{4,6}(\.0+)?$' and split_part(v, '.', 1)::int between 30000 and 80000 then
      d := date '1899-12-30' + split_part(v, '.', 1)::int;
      return d;
    end if;
  exception when others then
  end;

  -- ISO/date-time style, for example 2026-05-12 or 2026-05-12T10:30:00.
  begin
    if v ~ '^\d{4}-\d{2}-\d{2}' then
      d := left(v, 10)::date;
      return d;
    end if;
  exception when others then
  end;

  -- Indian slash date, for example 12/05/2026.
  begin
    if v ~ '^\d{2}/\d{2}/\d{4}' then
      d := to_date(left(v, 10), 'DD/MM/YYYY');
      return d;
    end if;
  exception when others then
  end;

  -- Indian dash date, for example 12-05-2026.
  begin
    if v ~ '^\d{2}-\d{2}-\d{4}' then
      d := to_date(left(v, 10), 'DD-MM-YYYY');
      return d;
    end if;
  exception when others then
  end;

  -- Indian dot date, for example 12.05.2026.
  begin
    if v ~ '^\d{2}\.\d{2}\.\d{4}' then
      d := to_date(left(v, 10), 'DD.MM.YYYY');
      return d;
    end if;
  exception when others then
  end;

  return null;
end;
$$;

-- 2) Preview how many item order registration dates will be fixed.
select
  count(*) as item_order_reg_dates_to_fix
from public.portal_order_items
where legacy_source = 'requests'
  and order_reg_date is null
  and nullif(trim(coalesce(order_reg_date_raw, '')), '') is not null
  and public.portal_try_date(order_reg_date_raw) is not null;

-- 3) Fix portal item order registration dates.
update public.portal_order_items
set
  order_reg_date = public.portal_try_date(order_reg_date_raw),
  updated_at = now()
where legacy_source = 'requests'
  and order_reg_date is null
  and nullif(trim(coalesce(order_reg_date_raw, '')), '') is not null
  and public.portal_try_date(order_reg_date_raw) is not null;

-- 4) Preview how many order processed dates will be fixed.
select
  count(*) as order_processed_dates_to_fix
from public.portal_orders
where legacy_source = 'requests'
  and processed_date is null
  and nullif(trim(coalesce(processed_date_raw, '')), '') is not null
  and public.portal_try_date(processed_date_raw) is not null;

-- 5) Fix portal order processed dates.
update public.portal_orders
set
  processed_date = public.portal_try_date(processed_date_raw),
  updated_at = now()
where legacy_source = 'requests'
  and processed_date is null
  and nullif(trim(coalesce(processed_date_raw, '')), '') is not null
  and public.portal_try_date(processed_date_raw) is not null;

-- 6) Verification: these should ideally return zero rows, or only non-date bad values.
select i.legacy_request_id, o.order_no, i.part_no, i.order_reg_date_raw
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
