# Final Migration: Legacy Requests Status and Column Mapping

This document is the corrected source of truth for importing old `requests` data into the new production portal tables.

## Correct business meaning of received and issued

Nishant clarified the final meaning:

- `RECEIVED` means the part has been received into our store.
- `Issued` means the part was received first and then issued to a customer.
- Therefore `Issued` is a later stage after `RECEIVED`.
- Both `RECEIVED` and `Issued` are closed/completed for old history.
- But they must remain separate statuses in the new portal.

Important correction:

- Do **not** map old `Issued` to `received`.
- Map old `Issued` to `issued`.
- Treat both `received` and `issued` as closed/non-active statuses for dashboards and in-transit calculations.

## Final legacy status mapping

All imports should trim whitespace and normalize case before mapping.

| Raw legacy `requests.Status` | Count | New portal status | Closed? | Meaning |
|---|---:|---|---|---|
| `RECEIVED` | 1447 | `received` | Yes | Part received into store. |
| `PENDING APPROVAL` | 804 | `pending_approval` | No | Approval pending. |
| `Rejected` | 453 | `rejected` | Yes | Rejected/closed. |
| `Processed` | 413 | `processed` | No | DBMS/processing done, not closed. |
| `DISPATCHED` | 316 | `dispatched` | No | Dispatched from plant/vendor but not yet received. |
| `Issued` | 52 | `issued` | Yes | Part received and then issued to customer. Later stage than received. |
| `PARTIALLY DISPATCHED` | 48 | `partially_dispatched` | No | Partial dispatch active. |
| `PROCESSED` | 32 | `processed` | No | Same as `Processed`. |
| `REJECTED` | 1 | `rejected` | Yes | Same as `Rejected`. |

## Final approval status mapping

All imports should trim whitespace and normalize case before mapping. The raw value with newline/extra spaces must be treated as `Approved`.

| Raw legacy `requests.ApprovalStatus` | Count | New portal approval status |
|---|---:|---|
| `Approved` | 2311 | `approved` |
| `PendingApproval` | 800 | `pending` |
| `Rejected` | 448 | `rejected` |
| `PendingManagerApproval` | 4 | `pending_manager_approval` |
| `REJECTED` | 1 | `rejected` |
| `Approved` with newline/spaces | 1 | `approved` |
| `APPROVED` | 1 | `approved` |

## Status normalization SQL

Recommended legacy status mapping expression:

```sql
case upper(regexp_replace(trim(coalesce("Status", '')), '\s+', ' ', 'g'))
  when 'RECEIVED' then 'received'
  when 'ISSUED' then 'issued'
  when 'REJECTED' then 'rejected'
  when 'PENDING APPROVAL' then 'pending_approval'
  when 'PROCESSED' then 'processed'
  when 'DISPATCHED' then 'dispatched'
  when 'PARTIALLY DISPATCHED' then 'partially_dispatched'
  else 'pending_approval'
end
```

Recommended approval-status mapping expression:

```sql
case upper(regexp_replace(trim(coalesce("ApprovalStatus", '')), '\s+', ' ', 'g'))
  when 'APPROVED' then 'approved'
  when 'PENDINGAPPROVAL' then 'pending'
  when 'PENDING MANAGER APPROVAL' then 'pending_manager_approval'
  when 'PENDINGMANAGERAPPROVAL' then 'pending_manager_approval'
  when 'REJECTED' then 'rejected'
  else 'pending'
end
```

## Active / in-transit exclusion rule

For dashboards and in-transit calculation, these statuses should be treated as closed and excluded from active pending/in-transit work:

- `received`
- `issued`
- `rejected`

These statuses are still imported for full historical record, but they should not inflate live work counts.

## Legacy `requests` column list supplied

| Column | Type | Nullable | Migration target |
|---|---|---|---|
| `id` | bigint | no | `portal_order_items.legacy_request_id`, event metadata |
| `created_at` | timestamptz | no | `portal_orders.created_at`, `portal_order_items.created_at`, legacy audit |
| `Branch` | text | yes | `portal_orders.branch` |
| `OrderType` | text | yes | `portal_orders.order_type` |
| `OrderFor` | text | yes | `portal_orders.order_for` |
| `WarrantyStatus` | text | yes | `portal_orders.warranty_status` |
| `EmployeeName` | text | yes | profile lookup / `portal_orders.employee_name_legacy` |
| `ApprovedBy` | text | yes | profile lookup / `portal_orders.approved_by_name` |
| `CallID` | text | yes | `portal_orders.call_id` |
| `MachineNo` | text | yes | `portal_orders.machine_no` |
| `CustomerName` | text | yes | `portal_orders.customer_name` |
| `ContactNo` | text | yes | `portal_orders.contact_no` |
| `PartNo` | text | yes | `portal_order_items.part_no` |
| `Qty` | bigint | yes | `portal_order_items.qty` |
| `Description` | text | yes | `portal_order_items.description` |
| `OrderNo` | text | yes | `portal_orders.order_no` |
| `Status` | text | yes | normalized status + `legacy_status` |
| `DNP` | numeric | yes | `portal_order_items.dnp` |
| `Value` | numeric | yes | `portal_order_items.value` |
| `ProcessedDate` | text | yes | parse to `portal_orders.processed_date`, also preserve raw if parsing fails |
| `OrderRegDt` | text | yes | `portal_order_items.order_reg_date` / billing chunk order reg date |
| `DeliveryNo` | text | yes | `portal_order_item_billings.delivery_no`, item header summary |
| `BillNo` | text | yes | `portal_order_item_billings.invoice_no`, item header summary |
| `BillingDt` | text | yes | parse to `portal_order_item_billings.billing_date` |
| `TransportName` | text | yes | `portal_order_item_billings.transport_name` |
| `TransportMode` | text | yes | `portal_order_item_billings.transport_mode` |
| `Docket` | text | yes | `portal_order_item_billings.docket_no` |
| `PackingDetail` | text | yes | `portal_order_item_billings.packing_detail` |
| `EWayBillNo` | text | yes | `portal_order_item_billings.eway_bill_no` |
| `GSTInvoiceNo` | text | yes | `portal_order_item_billings.gst_invoice_no` |
| `BilledQty` | numeric | yes | `portal_order_item_billings.billed_qty`, item billed summary |
| `ApprovalStatus` | text | yes | normalized approval status + legacy approval status |
| `ApprovedAt` | timestamp | yes | `portal_order_events.created_at` for approval event / order approved timestamp |
| `ApprovedBySuper` | text | yes | profile lookup / legacy approved by super field |
| `OrderComments` | jsonb | yes | `portal_order_comments` and/or `portal_order_events` after JSON inspection |
| `editedqty` | numeric | yes | `portal_order_items.edited_qty` |
| `editedvalue` | numeric | yes | `portal_order_items.edited_value` |
| `30dQty` | numeric | yes | legacy `previous_30d_qty`; new app may show in-transit instead |
| `billed_qty_total` | numeric | no | verify against sum of billing chunks; optional audit field |
| `pending_qty` | numeric | yes | derived field; do not trust as source of truth after migration |
| `dispatch_status` | text | yes | legacy dispatch audit field / metadata |
| `DBMSinvoiceNo` | text | yes | item/order invoice summary or billing invoice fallback |
| `DBMSinvoiceDate` | date | yes | item/order invoice date summary or billing date fallback |
| `receivedDate` | timestamptz | yes | `portal_order_item_billings.received_at` / item received date when received |

## Import logic by level

### Order header: `portal_orders`

Group legacy rows by `OrderNo`.

Recommended fields:

- `order_no` = legacy `OrderNo`
- `branch` = best non-null `Branch`
- `order_type` = best non-null `OrderType`
- `order_for` = best non-null `OrderFor`
- `warranty_status` = best non-null `WarrantyStatus`
- `employee_name_legacy` = best non-null `EmployeeName`
- `approved_by_name` = best non-null `ApprovedBy`
- `approved_by_super_name` = best non-null `ApprovedBySuper`
- `call_id` = best non-null `CallID`
- `machine_no` = best non-null `MachineNo`
- `customer_name` = best non-null `CustomerName`
- `contact_no` = best non-null `ContactNo`
- `status` = derived from item rows after import, not blindly copied from one row
- `approval_status` = normalized from legacy approval status
- `processed_date` = parsed from `ProcessedDate` where possible
- `legacy_source` = `requests`
- `legacy_order_no` = legacy `OrderNo`
- `legacy_request_count` = count of old rows under this order

### Item row: `portal_order_items`

Create one item row per legacy `requests.id` initially. This is safer than grouping old part rows too early because old rows may represent separate invoice/docket states.

Recommended fields:

- `order_id` = matching `portal_orders.id`
- `part_no` = `PartNo`
- `description` = `Description`
- `qty` = `Qty`
- `edited_qty` = `editedqty`
- `dnp` = `DNP`
- `value` = `Value`
- `edited_value` = `editedvalue`
- `billed_qty` = `billed_qty_total` if reliable, otherwise `BilledQty`
- `previous_30d_qty` = `30dQty`
- `row_status` = normalized legacy `Status`
- `legacy_request_id` = `requests.id`
- `legacy_status` = raw `Status`
- `legacy_approval_status` = raw `ApprovalStatus`

### Billing chunk: `portal_order_item_billings`

Create a billing chunk when any of these fields exist:

- `BilledQty`
- `BillNo`
- `BillingDt`
- `DeliveryNo`
- `Docket`
- `TransportName`
- `TransportMode`
- `PackingDetail`
- `EWayBillNo`
- `GSTInvoiceNo`
- `DBMSinvoiceNo`

Recommended fields:

- `order_id` = matching portal order
- `item_id` = matching portal item row
- `order_no` = legacy `OrderNo`
- `part_no` = legacy `PartNo`
- `billed_qty` = `BilledQty`
- `billing_date` = parsed `BillingDt`, fallback `DBMSinvoiceDate`
- `order_reg_date` = parsed `OrderRegDt`
- `delivery_no` = `DeliveryNo`
- `invoice_no` = `BillNo`, fallback `DBMSinvoiceNo`
- `docket_no` = `Docket`
- `transport_name` = `TransportName`
- `transport_mode` = `TransportMode`
- `packing_detail` = `PackingDetail`
- `eway_bill_no` = `EWayBillNo`
- `gst_invoice_no` = `GSTInvoiceNo`
- `raw_status` = legacy `Status`
- `received_qty` = billed qty only if normalized status is `received` or `issued`; otherwise 0
- `received_at` = `receivedDate` when available and status is `received` or `issued`
- `source` = `legacy_requests_import`
- `idempotency_key` = stable key using legacy request id, order no, part no, invoice, docket, delivery and billed qty

### Comments: `portal_order_comments`

`OrderComments` is JSONB, so inspect its structure before final migration SQL. If it is an array, each user comment should become one row. If it mixes system events and user comments, user-written comments should go to `portal_order_comments` and system actions should go to `portal_order_events`.

## Reconciliation checks after import

Minimum checks:

```sql
-- Legacy request count vs imported item count
select count(*) from public.requests;
select count(*) from public.portal_order_items where legacy_source = 'requests';

-- Unique legacy order count vs portal order count
select count(distinct "OrderNo") from public.requests;
select count(*) from public.portal_orders where legacy_source = 'requests';

-- Status distribution after import
select status, count(*) from public.portal_orders group by status order by count(*) desc;
select row_status, count(*) from public.portal_order_items group by row_status order by count(*) desc;

-- Closed historical rows should not be active/in-transit
select row_status, count(*)
from public.portal_order_items
where row_status in ('received', 'issued', 'rejected')
group by row_status;
```

## Final rule for future code

The new portal must support this lifecycle order:

```text
pending approval -> approved -> processed -> partially dispatched -> dispatched -> partially received -> received -> issued
```

`issued` is a final stage after `received`.

For in-transit quantity:

- include pending/approved/processed/dispatched/partially_dispatched/partially_received according to business rules
- exclude `received`, `issued`, and `rejected`
