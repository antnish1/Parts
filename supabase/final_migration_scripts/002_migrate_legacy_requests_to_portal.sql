-- FINAL MIGRATION SCRIPT 002
-- Import all old public.requests history into portal_* production tables.
-- Review in SQL Editor before running.
-- Requires script 001_create_portal_production_schema.sql to be applied first.

-- Business rule confirmed by Nishant:
-- RECEIVED = part received into store.
-- Issued = part issued to customer after receiving; later stage than received.
-- received, issued, rejected are closed/non-active for live dashboard/in-transit counts.

create or replace function public.portal_legacy_status(raw_status text)
returns text
language sql
immutable
as $$
  select case upper(regexp_replace(trim(coalesce(raw_status, '')), '\s+', ' ', 'g'))
    when 'RECEIVED' then 'received'
    when 'ISSUED' then 'issued'
    when 'REJECTED' then 'rejected'
    when 'PENDING APPROVAL' then 'pending_approval'
    when 'PROCESSED' then 'processed'
    when 'DISPATCHED' then 'dispatched'
    when 'PARTIALLY DISPATCHED' then 'partially_dispatched'
    else 'pending_approval'
  end;
$$;

create or replace function public.portal_legacy_approval_status(raw_status text)
returns text
language sql
immutable
as $$
  select case upper(regexp_replace(trim(coalesce(raw_status, '')), '\s+', ' ', 'g'))
    when 'APPROVED' then 'approved'
    when 'PENDINGAPPROVAL' then 'pending'
    when 'PENDING MANAGER APPROVAL' then 'pending_manager_approval'
    when 'PENDINGMANAGERAPPROVAL' then 'pending_manager_approval'
    when 'REJECTED' then 'rejected'
    else 'pending'
  end;
$$;

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

  begin
    if v ~ '^\d{4}-\d{2}-\d{2}' then
      d := left(v, 10)::date;
      return d;
    end if;
  exception when others then
  end;

  begin
    if v ~ '^\d{2}/\d{2}/\d{4}' then
      d := to_date(left(v, 10), 'DD/MM/YYYY');
      return d;
    end if;
  exception when others then
  end;

  begin
    if v ~ '^\d{2}-\d{2}-\d{4}' then
      d := to_date(left(v, 10), 'DD-MM-YYYY');
      return d;
    end if;
  exception when others then
  end;

  return null;
end;
$$;

create or replace function public.portal_order_status_from_items(statuses text[])
returns text
language plpgsql
immutable
as $$
declare
  s text[] := array_remove(statuses, null);
begin
  if array_length(s, 1) is null then return 'pending_approval'; end if;

  if not exists (select 1 from unnest(s) x where x <> 'rejected') then return 'rejected'; end if;
  if not exists (select 1 from unnest(s) x where x <> 'issued') then return 'issued'; end if;
  if not exists (select 1 from unnest(s) x where x not in ('issued', 'received')) then
    if exists (select 1 from unnest(s) x where x = 'issued') then return 'issued'; end if;
    return 'received';
  end if;
  if exists (select 1 from unnest(s) x where x in ('issued', 'received', 'partially_received')) then return 'partially_received'; end if;
  if not exists (select 1 from unnest(s) x where x <> 'dispatched') then return 'dispatched'; end if;
  if exists (select 1 from unnest(s) x where x in ('dispatched', 'partially_dispatched')) then return 'partially_dispatched'; end if;
  if not exists (select 1 from unnest(s) x where x <> 'processed') then return 'processed'; end if;
  if exists (select 1 from unnest(s) x where x = 'processed') then return 'processed'; end if;
  if exists (select 1 from unnest(s) x where x = 'pending_approval') then return 'pending_approval'; end if;

  return s[1];
end;
$$;

-- 1) Import one portal order per legacy OrderNo.
with source_rows as (
  select
    r.*,
    coalesce(nullif(trim(r."OrderNo"), ''), 'LEGACY-REQ-' || r.id::text) as normalized_order_no,
    public.portal_legacy_status(r."Status") as normalized_status,
    public.portal_legacy_approval_status(r."ApprovalStatus") as normalized_approval_status
  from public.requests r
), grouped as (
  select
    normalized_order_no,
    count(*) as request_count,
    min(created_at) as first_created_at,
    max(created_at) as last_created_at,
    (array_agg("Branch" order by created_at desc) filter (where nullif(trim(coalesce("Branch", '')), '') is not null))[1] as branch,
    (array_agg("OrderType" order by created_at desc) filter (where nullif(trim(coalesce("OrderType", '')), '') is not null))[1] as order_type,
    (array_agg("OrderFor" order by created_at desc) filter (where nullif(trim(coalesce("OrderFor", '')), '') is not null))[1] as order_for,
    (array_agg("WarrantyStatus" order by created_at desc) filter (where nullif(trim(coalesce("WarrantyStatus", '')), '') is not null))[1] as warranty_status,
    (array_agg("EmployeeName" order by created_at desc) filter (where nullif(trim(coalesce("EmployeeName", '')), '') is not null))[1] as employee_name,
    (array_agg("ApprovedBy" order by created_at desc) filter (where nullif(trim(coalesce("ApprovedBy", '')), '') is not null))[1] as approved_by,
    (array_agg("ApprovedBySuper" order by created_at desc) filter (where nullif(trim(coalesce("ApprovedBySuper", '')), '') is not null))[1] as approved_by_super,
    (array_agg("CallID" order by created_at desc) filter (where nullif(trim(coalesce("CallID", '')), '') is not null))[1] as call_id,
    (array_agg("MachineNo" order by created_at desc) filter (where nullif(trim(coalesce("MachineNo", '')), '') is not null))[1] as machine_no,
    (array_agg("CustomerName" order by created_at desc) filter (where nullif(trim(coalesce("CustomerName", '')), '') is not null))[1] as customer_name,
    (array_agg("ContactNo" order by created_at desc) filter (where nullif(trim(coalesce("ContactNo", '')), '') is not null))[1] as contact_no,
    (array_agg("ProcessedDate" order by created_at desc) filter (where nullif(trim(coalesce("ProcessedDate", '')), '') is not null))[1] as processed_date_raw,
    (array_agg("DBMSinvoiceNo" order by created_at desc) filter (where nullif(trim(coalesce("DBMSinvoiceNo", '')), '') is not null))[1] as dbms_invoice_no,
    (array_agg("DBMSinvoiceDate" order by created_at desc) filter (where "DBMSinvoiceDate" is not null))[1] as dbms_invoice_date,
    (array_agg("Docket" order by created_at desc) filter (where nullif(trim(coalesce("Docket", '')), '') is not null))[1] as docket_no,
    (array_agg("TransportName" order by created_at desc) filter (where nullif(trim(coalesce("TransportName", '')), '') is not null))[1] as transport_name,
    (array_agg("receivedDate" order by created_at desc) filter (where "receivedDate" is not null))[1] as received_date,
    (array_agg("Status" order by created_at desc) filter (where nullif(trim(coalesce("Status", '')), '') is not null))[1] as legacy_status,
    (array_agg("ApprovalStatus" order by created_at desc) filter (where nullif(trim(coalesce("ApprovalStatus", '')), '') is not null))[1] as legacy_approval_status,
    public.portal_order_status_from_items(array_agg(normalized_status)) as derived_order_status,
    (array_agg(normalized_approval_status order by created_at desc))[1] as derived_approval_status
  from source_rows
  group by normalized_order_no
)
insert into public.portal_orders (
  order_no, branch, order_type, order_for, warranty_status,
  employee_name_legacy, approved_by_name, approved_by_super_name,
  call_id, machine_no, customer_name, contact_no,
  status, approval_status, processed_date, processed_date_raw,
  dbms_invoice_no, dbms_invoice_date, received_date, docket_no, transport_name,
  legacy_source, legacy_order_no, legacy_status, legacy_approval_status, legacy_created_at, legacy_request_count, imported_at,
  created_at, updated_at
)
select
  normalized_order_no,
  coalesce(nullif(trim(branch), ''), 'UNKNOWN'),
  coalesce(nullif(trim(order_type), ''), 'SOP'),
  coalesce(nullif(trim(order_for), ''), 'Stock'),
  warranty_status,
  employee_name,
  approved_by,
  approved_by_super,
  call_id,
  machine_no,
  customer_name,
  contact_no,
  derived_order_status,
  derived_approval_status,
  public.portal_try_date(processed_date_raw),
  processed_date_raw,
  dbms_invoice_no,
  dbms_invoice_date,
  received_date,
  docket_no,
  transport_name,
  'requests',
  normalized_order_no,
  legacy_status,
  legacy_approval_status,
  first_created_at,
  request_count,
  now(),
  first_created_at,
  now()
from grouped
on conflict (order_no) do update set
  branch = excluded.branch,
  order_type = excluded.order_type,
  order_for = excluded.order_for,
  warranty_status = excluded.warranty_status,
  employee_name_legacy = excluded.employee_name_legacy,
  approved_by_name = excluded.approved_by_name,
  approved_by_super_name = excluded.approved_by_super_name,
  call_id = excluded.call_id,
  machine_no = excluded.machine_no,
  customer_name = excluded.customer_name,
  contact_no = excluded.contact_no,
  status = excluded.status,
  approval_status = excluded.approval_status,
  processed_date = excluded.processed_date,
  processed_date_raw = excluded.processed_date_raw,
  dbms_invoice_no = excluded.dbms_invoice_no,
  dbms_invoice_date = excluded.dbms_invoice_date,
  received_date = excluded.received_date,
  docket_no = excluded.docket_no,
  transport_name = excluded.transport_name,
  legacy_status = excluded.legacy_status,
  legacy_approval_status = excluded.legacy_approval_status,
  legacy_created_at = excluded.legacy_created_at,
  legacy_request_count = excluded.legacy_request_count,
  imported_at = now(),
  updated_at = now();

-- 2) Import one portal item per legacy requests.id.
with source_rows as (
  select
    r.*,
    coalesce(nullif(trim(r."OrderNo"), ''), 'LEGACY-REQ-' || r.id::text) as normalized_order_no,
    public.portal_legacy_status(r."Status") as normalized_status,
    public.portal_legacy_approval_status(r."ApprovalStatus") as normalized_approval_status
  from public.requests r
)
insert into public.portal_order_items (
  order_id, part_no, description, dnp, qty, edited_qty, billed_qty, value, edited_value,
  previous_30d_qty, pending_qty_legacy, dispatch_status_legacy,
  order_reg_date, order_reg_date_raw,
  dbms_invoice_no, dbms_invoice_date, docket_no, transport_name, received_date, row_status,
  legacy_source, legacy_request_id, legacy_status, legacy_approval_status, imported_at,
  created_at, updated_at
)
select
  o.id,
  coalesce(nullif(trim(s."PartNo"), ''), 'UNKNOWN'),
  s."Description",
  s."DNP",
  coalesce(s."Qty"::numeric, 0),
  s.editedqty,
  coalesce(nullif(s.billed_qty_total, 0), s."BilledQty", 0),
  s."Value",
  s.editedvalue,
  coalesce(s."30dQty", 0),
  s.pending_qty,
  s.dispatch_status,
  public.portal_try_date(s."OrderRegDt"),
  s."OrderRegDt",
  coalesce(nullif(trim(s."DBMSinvoiceNo"), ''), nullif(trim(s."BillNo"), '')),
  coalesce(s."DBMSinvoiceDate", public.portal_try_date(s."BillingDt")),
  s."Docket",
  s."TransportName",
  s."receivedDate",
  s.normalized_status,
  'requests',
  s.id::text,
  s."Status",
  s."ApprovalStatus",
  now(),
  s.created_at,
  now()
from source_rows s
join public.portal_orders o on o.order_no = s.normalized_order_no
on conflict (legacy_request_id) where legacy_request_id is not null do update set
  order_id = excluded.order_id,
  part_no = excluded.part_no,
  description = excluded.description,
  dnp = excluded.dnp,
  qty = excluded.qty,
  edited_qty = excluded.edited_qty,
  billed_qty = excluded.billed_qty,
  value = excluded.value,
  edited_value = excluded.edited_value,
  previous_30d_qty = excluded.previous_30d_qty,
  pending_qty_legacy = excluded.pending_qty_legacy,
  dispatch_status_legacy = excluded.dispatch_status_legacy,
  order_reg_date = excluded.order_reg_date,
  order_reg_date_raw = excluded.order_reg_date_raw,
  dbms_invoice_no = excluded.dbms_invoice_no,
  dbms_invoice_date = excluded.dbms_invoice_date,
  docket_no = excluded.docket_no,
  transport_name = excluded.transport_name,
  received_date = excluded.received_date,
  row_status = excluded.row_status,
  legacy_status = excluded.legacy_status,
  legacy_approval_status = excluded.legacy_approval_status,
  imported_at = now(),
  updated_at = now();

-- 3) Import billing/docket chunks from legacy rows.
with source_rows as (
  select
    r.*,
    coalesce(nullif(trim(r."OrderNo"), ''), 'LEGACY-REQ-' || r.id::text) as normalized_order_no,
    public.portal_legacy_status(r."Status") as normalized_status,
    coalesce(r."BilledQty", nullif(r.billed_qty_total, 0), case when public.portal_legacy_status(r."Status") in ('received', 'issued') then coalesce(r.editedqty, r."Qty"::numeric, 0) else 0 end) as chunk_qty
  from public.requests r
), chunkable as (
  select * from source_rows
  where coalesce(chunk_qty, 0) <> 0
     or nullif(trim(coalesce("BillNo", '')), '') is not null
     or nullif(trim(coalesce("BillingDt", '')), '') is not null
     or nullif(trim(coalesce("DeliveryNo", '')), '') is not null
     or nullif(trim(coalesce("Docket", '')), '') is not null
     or nullif(trim(coalesce("TransportName", '')), '') is not null
     or nullif(trim(coalesce("TransportMode", '')), '') is not null
     or nullif(trim(coalesce("PackingDetail", '')), '') is not null
     or nullif(trim(coalesce("EWayBillNo", '')), '') is not null
     or nullif(trim(coalesce("GSTInvoiceNo", '')), '') is not null
     or nullif(trim(coalesce("DBMSinvoiceNo", '')), '') is not null
)
insert into public.portal_order_item_billings (
  order_id, item_id, order_no, part_no, billed_qty, received_qty,
  billing_date, billing_date_raw, order_reg_date, order_reg_date_raw,
  delivery_no, invoice_no, docket_no, transport_name, transport_mode, packing_detail,
  eway_bill_no, gst_invoice_no, raw_status, source, idempotency_key,
  received_at, legacy_request_id, imported_at, created_at, updated_at
)
select
  o.id,
  i.id,
  c.normalized_order_no,
  coalesce(nullif(trim(c."PartNo"), ''), 'UNKNOWN'),
  coalesce(c.chunk_qty, 0),
  case when c.normalized_status in ('received', 'issued') then coalesce(c.chunk_qty, 0) else 0 end,
  coalesce(public.portal_try_date(c."BillingDt"), c."DBMSinvoiceDate"),
  c."BillingDt",
  public.portal_try_date(c."OrderRegDt"),
  c."OrderRegDt",
  c."DeliveryNo",
  coalesce(nullif(trim(c."BillNo"), ''), nullif(trim(c."DBMSinvoiceNo"), '')),
  c."Docket",
  c."TransportName",
  c."TransportMode",
  c."PackingDetail",
  c."EWayBillNo",
  c."GSTInvoiceNo",
  c."Status",
  'legacy_requests_import',
  concat_ws('|', 'legacy_requests', c.id::text, c.normalized_order_no, coalesce(c."PartNo", ''), coalesce(c."BillNo", ''), coalesce(c."Docket", ''), coalesce(c."DeliveryNo", ''), coalesce(c.chunk_qty::text, '0')),
  case when c.normalized_status in ('received', 'issued') then c."receivedDate" else null end,
  c.id::text,
  now(),
  c.created_at,
  now()
from chunkable c
join public.portal_orders o on o.order_no = c.normalized_order_no
join public.portal_order_items i on i.legacy_request_id = c.id::text
on conflict (idempotency_key) do update set
  billed_qty = excluded.billed_qty,
  received_qty = excluded.received_qty,
  billing_date = excluded.billing_date,
  billing_date_raw = excluded.billing_date_raw,
  order_reg_date = excluded.order_reg_date,
  order_reg_date_raw = excluded.order_reg_date_raw,
  delivery_no = excluded.delivery_no,
  invoice_no = excluded.invoice_no,
  docket_no = excluded.docket_no,
  transport_name = excluded.transport_name,
  transport_mode = excluded.transport_mode,
  packing_detail = excluded.packing_detail,
  eway_bill_no = excluded.eway_bill_no,
  gst_invoice_no = excluded.gst_invoice_no,
  raw_status = excluded.raw_status,
  received_at = excluded.received_at,
  imported_at = now(),
  updated_at = now();

-- 4) Preserve raw JSON comments without trying to guess comment structure yet.
insert into public.portal_order_comments (order_id, comment_type, body, legacy_request_id, legacy_payload, created_at)
select
  o.id,
  'legacy_json',
  'Legacy OrderComments JSON preserved from requests.id ' || r.id::text,
  r.id::text,
  r."OrderComments",
  r.created_at
from public.requests r
join public.portal_orders o on o.order_no = coalesce(nullif(trim(r."OrderNo"), ''), 'LEGACY-REQ-' || r.id::text)
where r."OrderComments" is not null
  and not exists (
    select 1 from public.portal_order_comments c
    where c.legacy_request_id = r.id::text
      and c.comment_type = 'legacy_json'
  );

-- 5) Create one import event per legacy order.
insert into public.portal_order_events (order_id, event_type, old_status, new_status, notes, metadata, created_at)
select
  o.id,
  'LEGACY_IMPORTED',
  null,
  o.status,
  'Imported from legacy requests table.',
  jsonb_build_object(
    'legacy_order_no', o.legacy_order_no,
    'legacy_request_count', o.legacy_request_count,
    'legacy_status', o.legacy_status,
    'legacy_approval_status', o.legacy_approval_status
  ),
  coalesce(o.legacy_created_at, now())
from public.portal_orders o
where o.legacy_source = 'requests'
  and not exists (
    select 1 from public.portal_order_events e
    where e.order_id = o.id
      and e.event_type = 'LEGACY_IMPORTED'
  );

-- 6) Recalculate item billed_qty from imported chunks where chunks exist.
with totals as (
  select item_id, sum(billed_qty) as billed_total, sum(received_qty) as received_total
  from public.portal_order_item_billings
  group by item_id
)
update public.portal_order_items i
set billed_qty = coalesce(t.billed_total, 0),
    received_date = case when coalesce(t.received_total, 0) > 0 then coalesce(i.received_date, now()) else i.received_date end,
    updated_at = now()
from totals t
where t.item_id = i.id;

-- 7) Recalculate order statuses from item rows after import.
with per_order as (
  select order_id, public.portal_order_status_from_items(array_agg(row_status)) as next_status
  from public.portal_order_items
  group by order_id
)
update public.portal_orders o
set status = p.next_status,
    updated_at = now()
from per_order p
where p.order_id = o.id;

-- 8) Final quick counts. Run script 003 for full reconciliation.
select 'legacy_requests' as metric, count(*)::text as value from public.requests
union all
select 'portal_orders_imported', count(*)::text from public.portal_orders where legacy_source = 'requests'
union all
select 'portal_items_imported', count(*)::text from public.portal_order_items where legacy_source = 'requests'
union all
select 'portal_billing_chunks_imported', count(*)::text from public.portal_order_item_billings where source = 'legacy_requests_import';
