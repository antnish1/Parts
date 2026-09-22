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
  candidates as (
    select
      o.id as order_id,
      o.order_no::text as order_no,
      o.branch::text as branch,
      o.order_type::text as order_type,
      o.created_at as order_date,
      o.order_for::text as order_for,
      greatest(coalesce(i.edited_qty, i.qty, 0), 0) as effective_qty,
      coalesce(r.received_qty, 0) as received_qty,
      upper(regexp_replace(replace(replace(trim(coalesce(i.row_status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as item_status,
      upper(regexp_replace(replace(replace(trim(coalesce(o.status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as order_status,
      upper(regexp_replace(replace(replace(trim(coalesce(o.approval_status, '')), '_', ' '), '-', ' '), '\s+', ' ', 'g')) as approval_status
    from public.portal_order_items i
    join public.portal_orders o on o.id = i.order_id
    left join received r on r.item_id = i.id
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
    greatest(effective_qty - received_qty, 0)::numeric as qty
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
    and greatest(effective_qty - received_qty, 0) > 0
  order by order_date desc, order_no;
$$;

grant execute on function public.portal_get_in_transit_details(text, text) to authenticated;
