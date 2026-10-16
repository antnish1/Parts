-- In Transit: preserve 15-day branch-wide inclusion, including legacy dispatch rows
-- whose imported row_status incorrectly says PROCESSED.
-- Normalize historical Excel-serial and DD.MM.YYYY billing dates on read.
-- Do not change physical stock, receipt quantities, order history or permissions.
-- Function signatures and existing grants preserved by CREATE OR REPLACE.
-- Deployment requires production read-only before/after comparison.
-- Reversible: Git history contains preceding pg_get_functiondef definitions.

CREATE OR REPLACE FUNCTION public.portal_get_in_transit_details(p_branch text, p_part_no text)
 RETURNS TABLE(order_id uuid, order_no text, branch text, order_type text, order_date timestamp with time zone, order_for text, status text, qty numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with requested_part as (
    select regexp_replace(upper(trim(coalesce(p_part_no, ''))), '\s+', '', 'g') as part_no
  ),
  target_branch as (
    select public.resolve_portal_branch(p_branch) as branch_key
  ),
  received as (
    select
      b.item_id,
      coalesce(sum(greatest(coalesce(b.received_qty, 0), 0)), 0) as received_qty
    from public.portal_order_item_billings b
    group by b.item_id
  ),
  billing_window as (
    select b.item_id,
      count(*) as billing_rows,
      sum(
        case
          when b.effective_billing_date >= current_date - 14
           and b.effective_billing_date <= current_date
          then greatest(coalesce(b.billed_qty, 0) - coalesce(b.received_qty, 0), 0)
          else 0
        end
      ) as recent_unreceived_qty
    from (
      select b.*,
        coalesce(b.billing_date,
          case
            when trim(coalesce(b.billing_date_raw,'')) ~ '^[0-9]{4,5}$'
              and (case when trim(b.billing_date_raw) ~ '^[0-9]{4,5}$' then trim(b.billing_date_raw)::integer end) between 35000 and 60000
              then date '1899-12-30' + trim(b.billing_date_raw)::integer
            when trim(coalesce(b.billing_date_raw,'')) ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{4}$'
              then to_date(trim(b.billing_date_raw),'DD.MM.YYYY')
            else null
          end
        ) as effective_billing_date
      from public.portal_order_item_billings b
    ) b
    group by b.item_id
  ),
  candidates as (
    select
      o.id as order_id,
      coalesce(nullif(trim(o.final_order_no), ''), nullif(trim(o.processing_reference), ''), o.order_no)::text as order_no,
      o.branch::text as branch,
      o.order_type::text as order_type,
      o.created_at as order_date,
      o.order_for::text as order_for,
      greatest(coalesce(i.edited_qty, i.qty, 0), 0) as effective_qty,
      coalesce(r.received_qty, 0) as received_qty,
      bw.billing_rows,
      coalesce(bw.recent_unreceived_qty, 0) as recent_unreceived_qty,
      coalesce(i.dbms_invoice_date, o.dbms_invoice_date) as invoice_date,
      upper(regexp_replace(replace(replace(trim(coalesce(i.row_status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as item_status,
      upper(regexp_replace(replace(replace(trim(coalesce(i.dispatch_status_legacy, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as legacy_dispatch_status,
      upper(regexp_replace(replace(replace(trim(coalesce(o.status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as order_status,
      upper(regexp_replace(replace(replace(trim(coalesce(o.approval_status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as approval_status
    from public.portal_order_items i
    join public.portal_orders o on o.id = i.order_id
    left join received r on r.item_id = i.id
    left join billing_window bw on bw.item_id = i.id
    cross join target_branch tb
    cross join requested_part rp
    where tb.branch_key is not null
      and rp.part_no <> ''
      and public.resolve_portal_branch(o.branch) = tb.branch_key
      and regexp_replace(upper(trim(i.part_no)), '\s+', '', 'g') = rp.part_no
  ),
  resolved as (
    select
      order_id,
      order_no,
      branch,
      order_type,
      order_date,
      order_for,
      effective_qty,
      received_qty,
      billing_rows,
      recent_unreceived_qty,
      invoice_date,
      legacy_dispatch_status,
      order_status,
      approval_status,
      case
        when item_status = 'PROCESSED' and legacy_dispatch_status in ('DISPATCHED', 'PARTIALLY DISPATCHED') then legacy_dispatch_status
        when item_status <> '' then item_status
        when order_status <> '' then order_status
        else approval_status
      end as status
    from candidates
  )
  select
    order_id,
    order_no,
    branch,
    order_type,
    order_date,
    order_for,
    status,
    (case
      when status in ('DISPATCHED', 'PARTIALLY DISPATCHED', 'PARTIALLY RECEIVED')
        or legacy_dispatch_status in ('DISPATCHED', 'PARTIALLY DISPATCHED')
        or (order_status in ('DISPATCHED', 'PARTIALLY DISPATCHED') and status <> 'PROCESSED')
      then least(
        greatest(effective_qty - received_qty, 0),
        case
          when billing_rows is not null then recent_unreceived_qty
          when invoice_date between current_date - 14 and current_date
            then greatest(effective_qty - received_qty, 0)
          else 0
        end
      )
      else greatest(effective_qty - received_qty, 0)
    end)::numeric as qty
  from resolved
  where status in (
    'APPROVED',
    'PROCESSED',
    'PARTIALLY DISPATCHED',
    'DISPATCHED',
    'PARTIALLY RECEIVED'
  )
    and order_status not in ('REJECTED', 'RECEIVED', 'ISSUED')
    and approval_status not in ('REJECTED', 'RECEIVED', 'ISSUED')
    and order_status not like 'PENDING%'
    and approval_status not like 'PENDING%'
    and (case
      when status in ('DISPATCHED', 'PARTIALLY DISPATCHED', 'PARTIALLY RECEIVED')
        or legacy_dispatch_status in ('DISPATCHED', 'PARTIALLY DISPATCHED')
        or (order_status in ('DISPATCHED', 'PARTIALLY DISPATCHED') and status <> 'PROCESSED')
      then least(
        greatest(effective_qty - received_qty, 0),
        case
          when billing_rows is not null then recent_unreceived_qty
          when invoice_date between current_date - 14 and current_date
            then greatest(effective_qty - received_qty, 0)
          else 0
        end
      )
      else greatest(effective_qty - received_qty, 0)
    end) > 0
  order by order_date desc, order_no;
$function$

CREATE OR REPLACE FUNCTION public.portal_get_in_transit_qty(p_branch text, p_part_nos text[])
 RETURNS TABLE(part_no text, in_transit_qty numeric)
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with requested_parts as (
    select distinct regexp_replace(upper(trim(parts.value)), '\s+', '', 'g') as part_no
    from unnest(coalesce(p_part_nos, array[]::text[])) as parts(value)
    where nullif(trim(parts.value), '') is not null
  ),
  target_branch as (
    select public.resolve_portal_branch(p_branch) as branch_key
  ),
  received as (
    select b.item_id, coalesce(sum(greatest(coalesce(b.received_qty, 0), 0)), 0) as received_qty
    from public.portal_order_item_billings b
    group by b.item_id
  ),
  billing_window as (
    select b.item_id,
      count(*) as billing_rows,
      sum(
        case
          when b.effective_billing_date >= current_date - 14
           and b.effective_billing_date <= current_date
          then greatest(coalesce(b.billed_qty, 0) - coalesce(b.received_qty, 0), 0)
          else 0
        end
      ) as recent_unreceived_qty
    from (
      select b.*,
        coalesce(b.billing_date,
          case
            when trim(coalesce(b.billing_date_raw,'')) ~ '^[0-9]{4,5}$'
              and (case when trim(b.billing_date_raw) ~ '^[0-9]{4,5}$' then trim(b.billing_date_raw)::integer end) between 35000 and 60000
              then date '1899-12-30' + trim(b.billing_date_raw)::integer
            when trim(coalesce(b.billing_date_raw,'')) ~ '^[0-9]{2}[.][0-9]{2}[.][0-9]{4}$'
              then to_date(trim(b.billing_date_raw),'DD.MM.YYYY')
            else null
          end
        ) as effective_billing_date
      from public.portal_order_item_billings b
    ) b
    group by b.item_id
  ),
  candidates as (
    select
      regexp_replace(upper(trim(i.part_no)), '\s+', '', 'g') as normalized_part_no,
      greatest(coalesce(i.edited_qty, i.qty, 0), 0) as effective_qty,
      coalesce(r.received_qty, 0) as received_qty,
      bw.billing_rows,
      coalesce(bw.recent_unreceived_qty, 0) as recent_unreceived_qty,
      coalesce(i.dbms_invoice_date, o.dbms_invoice_date) as invoice_date,
      upper(regexp_replace(replace(replace(trim(coalesce(i.row_status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as item_status,
      upper(regexp_replace(replace(replace(trim(coalesce(i.dispatch_status_legacy, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as legacy_dispatch_status,
      upper(regexp_replace(replace(replace(trim(coalesce(o.status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as order_status,
      upper(regexp_replace(replace(replace(trim(coalesce(o.approval_status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as approval_status
    from public.portal_order_items i
    join public.portal_orders o on o.id = i.order_id
    left join received r on r.item_id = i.id
    left join billing_window bw on bw.item_id = i.id
    cross join target_branch tb
    where tb.branch_key is not null
      and public.resolve_portal_branch(o.branch) = tb.branch_key
      and regexp_replace(upper(trim(i.part_no)), '\s+', '', 'g') in (select part_no from requested_parts)
  ),
  resolved as (
    select
      normalized_part_no,
      effective_qty,
      received_qty,
      billing_rows,
      recent_unreceived_qty,
      invoice_date,
      legacy_dispatch_status,
      order_status,
      approval_status,
      case
        when item_status = 'PROCESSED' and legacy_dispatch_status in ('DISPATCHED', 'PARTIALLY DISPATCHED') then legacy_dispatch_status
        when item_status <> '' then item_status
        when order_status <> '' then order_status
        else approval_status
      end as status
    from candidates
  )
  select
    normalized_part_no as part_no,
    sum(case
      when status in ('DISPATCHED', 'PARTIALLY DISPATCHED', 'PARTIALLY RECEIVED')
        or legacy_dispatch_status in ('DISPATCHED', 'PARTIALLY DISPATCHED')
        or (order_status in ('DISPATCHED', 'PARTIALLY DISPATCHED') and status <> 'PROCESSED')
      then least(
        greatest(effective_qty - received_qty, 0),
        case
          when billing_rows is not null then recent_unreceived_qty
          when invoice_date between current_date - 14 and current_date
            then greatest(effective_qty - received_qty, 0)
          else 0
        end
      )
      else greatest(effective_qty - received_qty, 0)
    end)::numeric as in_transit_qty
  from resolved
  where status in (
    'APPROVED',
    'PROCESSED',
    'PARTIALLY DISPATCHED',
    'DISPATCHED',
    'PARTIALLY RECEIVED'
  )
    and order_status not in ('REJECTED', 'RECEIVED', 'ISSUED')
    and approval_status not in ('REJECTED', 'RECEIVED', 'ISSUED')
    and order_status not like 'PENDING%'
    and approval_status not like 'PENDING%'
  group by normalized_part_no
  order by normalized_part_no;
$function$
