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
    select distinct regexp_replace(upper(trim(value)), '\s+', '', 'g') as part_no
    from unnest(coalesce(p_part_nos, array[]::text[])) as value
    where nullif(trim(value), '') is not null
  ),
  target_branch as (
    select public.resolve_portal_branch(p_branch) as branch_key
  ),
  received as (
    select b.item_id, coalesce(sum(greatest(coalesce(b.received_qty, 0), 0)), 0) as received_qty
    from public.portal_order_item_billings b
    group by b.item_id
  ),
  candidates as (
    select
      regexp_replace(upper(trim(i.part_no)), '\s+', '', 'g') as normalized_part_no,
      greatest(coalesce(i.edited_qty, i.qty, 0), 0) as effective_qty,
      coalesce(r.received_qty, 0) as received_qty,
      upper(regexp_replace(replace(replace(trim(coalesce(i.row_status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as item_status,
      upper(regexp_replace(replace(replace(trim(coalesce(o.status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as order_status,
      upper(regexp_replace(replace(replace(trim(coalesce(o.approval_status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as approval_status
    from public.portal_order_items i
    join public.portal_orders o on o.id = i.order_id
    left join received r on r.item_id = i.id
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
      case
        when item_status <> '' then item_status
        when order_status <> '' then order_status
        else approval_status
      end as status
    from candidates
  )
  select
    normalized_part_no as part_no,
    sum(greatest(effective_qty - received_qty, 0))::numeric as in_transit_qty
  from resolved
  where status in (
    'APPROVED',
    'PROCESSED',
    'PARTIALLY DISPATCHED',
    'DISPATCHED',
    'PARTIALLY RECEIVED'
  )
  group by normalized_part_no
  order by normalized_part_no;
$$;

grant execute on function public.portal_get_in_transit_qty(text, text[]) to authenticated;
