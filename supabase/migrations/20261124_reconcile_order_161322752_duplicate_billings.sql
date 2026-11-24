-- One-time, tightly scoped reconciliation of status-report docket-only duplicate billings.
-- Order 161322752. Preserve a full independent snapshot before deleting 13 duplicate, unreceived rows.
-- Abort on any drift, receipt, or unexpected duplicate pattern.
create table if not exists public.portal_billing_reconciliation_audit (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  reconciliation_tag text not null unique,
  reason text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
revoke all on public.portal_billing_reconciliation_audit from public, anon, authenticated;
alter table public.portal_billing_reconciliation_audit enable row level security;

do $reconcile$
declare
  target uuid := '5ea5bb40-b8b5-4c29-a51a-a3853ac84029';
  tag text := '2026-11-24-order-161322752-docket-reupload';
  existing_total numeric;
  total_rows integer;
  duplicate_count integer;
  duplicate_qty numeric;
  receipt_count integer;
  remaining_total numeric;
  audit_id uuid;
begin
  perform 1 from public.portal_orders where id=target for update;
  if not found then raise exception 'Target order missing'; end if;
  perform 1 from public.portal_order_items where order_id=target for update;
  perform 1 from public.portal_order_item_billings where order_id=target for update;

  if exists (select 1 from public.portal_billing_reconciliation_audit where reconciliation_tag=tag) then
    raise exception 'This reconciliation has already been applied';
  end if;
  select count(*),coalesce(sum(billed_qty),0) into total_rows,existing_total
  from public.portal_order_item_billings where order_id=target;
  if total_rows<>29 or existing_total<>118 then
    raise exception 'Source drift: expected 29 rows and 118 billed, got % and %',total_rows,existing_total;
  end if;

  create temporary table billing_duplicate_candidates on commit drop as
  with ranked as (
    select b.id, b.item_id, b.billed_qty, b.received_qty,b.received_at,b.received_by,
      row_number() over(
        partition by b.item_id,b.invoice_no,b.delivery_no,b.billing_date,b.billed_qty
        order by (nullif(btrim(b.docket_no),'') is not null) desc,b.created_at desc,b.id desc
      ) as rn,
      count(*) over(partition by b.item_id,b.invoice_no,b.delivery_no,b.billing_date,b.billed_qty) as matches
    from public.portal_order_item_billings b
    where b.order_id=target and b.source='status_report_upload'
  ) select * from ranked where rn>1;

  select count(*),coalesce(sum(billed_qty),0),
         count(*) filter(where received_qty<>0 or received_at is not null or received_by is not null)
    into duplicate_count,duplicate_qty,receipt_count
  from billing_duplicate_candidates;

  if duplicate_count<>13 or duplicate_qty<>56 or receipt_count<>0 then
    raise exception 'Unsafe reconciliation: duplicates %, quantity %, received records %',duplicate_count,duplicate_qty,receipt_count;
  end if;
  if exists (
    select 1 from billing_duplicate_candidates c
    join public.portal_order_item_billings b on b.id=c.id
    where nullif(btrim(b.docket_no),'') is not null
  ) then
    raise exception 'Candidate contains nonblank docket; aborting';
  end if;

  insert into public.portal_billing_reconciliation_audit(order_id,reconciliation_tag,reason,snapshot)
  select target,tag,
    'Remove 13 duplicate zero-receipt status-report rows from second docket-enriched upload; retain latest docket rows and all received history',
    jsonb_build_object(
      'order',(select to_jsonb(o) from public.portal_orders o where o.id=target),
      'items',(select jsonb_agg(to_jsonb(i) order by i.part_no) from public.portal_order_items i where i.order_id=target),
      'billings',(select jsonb_agg(to_jsonb(b) order by b.created_at,b.id) from public.portal_order_item_billings b where b.order_id=target),
      'deleted_billing_ids',(select jsonb_agg(id) from billing_duplicate_candidates),
      'expected_deleted_count',duplicate_count,
      'expected_deleted_qty',duplicate_qty
    ) returning id into audit_id;

  delete from public.portal_order_item_billings b
  using billing_duplicate_candidates c where b.id=c.id;
  if (select count(*) from public.portal_order_item_billings where order_id=target)<>16 then
    raise exception 'Unexpected remaining billing row count';
  end if;

  update public.portal_order_items i
    set billed_qty=coalesce((
          select sum(b.billed_qty) from public.portal_order_item_billings b where b.item_id=i.id
        ),0),
        docket_no=(
          select case when count(distinct nullif(btrim(b.docket_no),''))=1
               then max(nullif(btrim(b.docket_no),'')) else null end
          from public.portal_order_item_billings b where b.item_id=i.id
        ),
        updated_at=now()
  where i.order_id=target;

  select coalesce(sum(billed_qty),0) into remaining_total
  from public.portal_order_item_billings where order_id=target;
  if remaining_total<>62
    or (select coalesce(sum(billed_qty),0) from public.portal_order_items where order_id=target)<>62 then
    raise exception 'Reconciliation totals mismatch';
  end if;
  raise notice 'Reconciled order: audit %, removed 13 chunks (56 units), remaining 16 chunks (62 units)',audit_id;
end $reconcile$;
