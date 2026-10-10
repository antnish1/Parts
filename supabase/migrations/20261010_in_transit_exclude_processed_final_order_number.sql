-- Exclude processed orders from In Transit and show final DBMS number.\n-- Preserve function signatures, privileges, effective-qty and status semantics.
-- Dispatched / partially dispatched quantities count only when billed within
-- today and 14 previous calendar days. Each billing chunk is evaluated by
-- its own billing_date and net unreceived quantity. Items with no billing
-- chunks use item invoice date, then order invoice date. Missing dates exclude.
-- No order rows, billing rows, or history are modified.
-- Branch-wide live In Transit quantity calculation.
-- Business rule:
-- - Same canonical branch only (branch aliases resolve to the same branch_key).
-- - Count remaining effective quantity for APPROVED / PROCESSED /
--   PARTIALLY DISPATCHED / DISPATCHED / PARTIALLY RECEIVED items.
-- - Exclude pending approval, rejected, received, and issued items.
-- - edited_qty is used when present; otherwise qty.
-- - received quantities are subtracted so partially received lines only contribute
--   the quantity still in transit.

create or replace function public.portal_get_in_transit_qty(
  p_branch text,
  p_part_nos text[]
)
returns table(part_no text, in_transit_qty numeric)
language sql
stable
security invoker
set search_path = public
as $$
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
          when b.billing_date >= current_date - 14
           and b.billing_date <= current_date
          then greatest(coalesce(b.billed_qty, 0) - coalesce(b.received_qty, 0), 0)
          else 0
        end
      ) as recent_unreceived_qty
    from public.portal_order_item_billings b
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
      order_status,
      approval_status,
      case
        when item_status <> '' then item_status
        when order_status <> '' then order_status
        else approval_status
      end as status
    from candidates
  )
  select
    normalized_part_no as part_no,
    sum(case
      when status in ('DISPATCHED', 'PARTIALLY DISPATCHED')
        or order_status in ('DISPATCHED', 'PARTIALLY DISPATCHED')
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
    'PARTIALLY DISPATCHED',
    'DISPATCHED',
    'PARTIALLY RECEIVED'
  )
    and order_status not in ('PROCESSED', 'REJECTED', 'RECEIVED', 'ISSUED')
    and approval_status not in ('REJECTED', 'RECEIVED', 'ISSUED')
    and order_status not like 'PENDING%'
    and approval_status not like 'PENDING%'
  group by normalized_part_no
  order by normalized_part_no;
$$;

grant execute on function public.portal_get_in_transit_qty(text, text[]) to authenticated;


-- Detailed rows behind the branch-wide In Transit quantity shown in Order Details.
-- Keep this logic aligned with portal_get_in_transit_qty from 037_branch_in_transit_qty.sql.

create or replace function public.portal_get_in_transit_details(
  p_branch text,
  p_part_no text
)
returns table(
  order_id uuid,
  order_no text,
  branch text,
  order_type text,
  order_date timestamptz,
  order_for text,
  status text,
  qty numeric
)
language sql
stable
security invoker
set search_path = public
as $$
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
          when b.billing_date >= current_date - 14
           and b.billing_date <= current_date
          then greatest(coalesce(b.billed_qty, 0) - coalesce(b.received_qty, 0), 0)
          else 0
        end
      ) as recent_unreceived_qty
    from public.portal_order_item_billings b
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
      order_status,
      approval_status,
      case
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
      when status in ('DISPATCHED', 'PARTIALLY DISPATCHED')
        or order_status in ('DISPATCHED', 'PARTIALLY DISPATCHED')
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
    'PARTIALLY DISPATCHED',
    'DISPATCHED',
    'PARTIALLY RECEIVED'
  )
    and order_status not in ('PROCESSED', 'REJECTED', 'RECEIVED', 'ISSUED')
    and approval_status not in ('REJECTED', 'RECEIVED', 'ISSUED')
    and order_status not like 'PENDING%'
    and approval_status not like 'PENDING%'
    and (case
      when status in ('DISPATCHED', 'PARTIALLY DISPATCHED')
        or order_status in ('DISPATCHED', 'PARTIALLY DISPATCHED')
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
$$;

grant execute on function public.portal_get_in_transit_details(text, text) to authenticated;
