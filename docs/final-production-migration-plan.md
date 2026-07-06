# Final Production Migration Plan

This document is the safe cutover plan for making the React Parts Connect Portal the main workplace without losing legacy data or current workflow.

## Approved migration decisions

These decisions are now approved by Nishant:

1. Migrate **all old `requests` history**, not only open/live orders.
2. Use safer production workflow names with the `portal_` prefix.
3. Create new `portal_inventory_*` tables instead of writing directly into existing inventory tables.
4. Move all users fully to Supabase Auth email/password login.
5. Keep the old portal **read-only** after cutover.
6. Existing master tables remain the master source where compatible:
   - `part_master`
   - `machine_master`
   - `branch_mapping`
7. Legacy closed/completed statuses are:
   - `RECEIVED`
   - `Issued`
8. Legacy closed/rejected statuses are:
   - `Rejected`
   - `REJECTED`

## Approved legacy status mapping

The old `requests` table has 3,566 rows by status count. The approval-status count also totals 3,566 rows, so the status discovery is consistent.

### Legacy `requests.Status` mapping

All imports should trim whitespace and normalize case before mapping.

| Raw legacy status | Count | New portal status | Closed? | Import note |
|---|---:|---|---|---|
| `RECEIVED` | 1447 | `received` | Yes | Completed history. Do not count as active/in-transit. |
| `PENDING APPROVAL` | 804 | `pending_approval` | No | Still approval workflow. |
| `Rejected` | 453 | `rejected` | Yes | Rejected history. Do not count as active/in-transit. |
| `Processed` | 413 | `processed` | No | Processed but not closed. |
| `DISPATCHED` | 316 | `dispatched` | No | Dispatched but not confirmed received. |
| `Issued` | 52 | `received` | Yes | Legacy issued is considered completed/closed by business rule. Preserve raw legacy status as `Issued`. |
| `PARTIALLY DISPATCHED` | 48 | `partially_dispatched` | No | Active dispatch history. |
| `PROCESSED` | 32 | `processed` | No | Same as `Processed`. |
| `REJECTED` | 1 | `rejected` | Yes | Same as `Rejected`. |

Important rule for `Issued`:

- In the new portal workflow, `issued` and `dispatched` are separate stages.
- But for old `requests` history, Nishant confirmed `Issued` means closed/completed.
- Therefore, during historical import, old `Issued` should be imported as workflow status `received` so it does not remain active.
- The original raw status should still be preserved in a legacy/audit field such as `legacy_status` or event metadata.

### Legacy `requests.ApprovalStatus` mapping

All imports should trim whitespace and normalize case before mapping. The raw value `Approved\n              ` must be treated as `Approved`.

| Raw approval status | Count | New portal approval status | Import note |
|---|---:|---|---|
| `Approved` | 2311 | `approved` | Normal approved. |
| `PendingApproval` | 800 | `pending` | Pending super/admin approval. |
| `Rejected` | 448 | `rejected` | Rejected approval. |
| `PendingManagerApproval` | 4 | `pending_manager_approval` | Manager approval pending. |
| `REJECTED` | 1 | `rejected` | Same as `Rejected`. |
| `Approved\n              ` | 1 | `approved` | Trim whitespace/newline. |
| `APPROVED` | 1 | `approved` | Same as `Approved`. |

### Import status normalization SQL idea

Final migration SQL should use a status-normalization expression like this, then map values:

```sql
upper(regexp_replace(trim(coalesce("Status", '')), '\s+', ' ', 'g'))
```

Recommended raw status mapping expression:

```sql
case upper(regexp_replace(trim(coalesce("Status", '')), '\s+', ' ', 'g'))
  when 'RECEIVED' then 'received'
  when 'ISSUED' then 'received'
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

## Current understanding

The React portal is currently running mostly on staging/test tables:

- `test_profiles`
- `test_orders`
- `test_order_items`
- `test_order_events`
- `test_order_comments`
- `test_order_comment_attachments`
- `test_order_item_billings`
- `test_inventory_current`
- `test_inventory_staging`
- `test_inventory_changes`
- `test_inventory_uploads`

The live legacy system already has important production tables:

- `requests`
- `users`
- `part_master`
- `machine_master`
- `branch_mapping`
- `inventory_current`
- `inventory_staging`
- `inventory_changes`

The React portal is already using/depending on production master data for `part_master` and `machine_master` in some places, but the order lifecycle is still on `test_` tables.

## Main migration principle

Do not overwrite, rename, or delete existing live tables during the first cutover.

The safest approach is to create a new clean production schema for the portal order workflow while continuing to use the existing master tables:

- Keep existing `part_master` as the production part master.
- Keep existing `machine_master` as the production machine/customer lookup.
- Keep existing `branch_mapping` after checking column compatibility.
- Create new `portal_inventory_*` tables.
- Create new `portal_` workflow tables.

Reason: this avoids destroying or corrupting `requests`, gives rollback safety, and keeps the old portal available in read-only mode.

## Why not directly use `requests` for the new portal

The old `requests` table is row-based and stores order header and item data together. The new portal now needs normalized workflow behavior:

- one order header
- multiple item rows
- multiple invoice/docket chunks per item
- comments as separate rows
- attachments as separate rows
- events/audit as separate rows
- row-level status and order-level status recalculation

Trying to force all of this into `requests` will create risk and hidden bugs. The old `requests` table should be treated as legacy source data, not the main write table for the new workflow.

## Target production table map

| Current test table | Production target | Notes |
|---|---|---|
| `test_profiles` | `portal_profiles` | Connects Supabase Auth users with portal roles/branches. |
| `test_orders` | `portal_orders` | One row per order. |
| `test_order_items` | `portal_order_items` | One row per ordered part. |
| `test_order_item_billings` | `portal_order_item_billings` | Multiple invoice/docket chunks under one part row. |
| `test_order_events` | `portal_order_events` | Audit log for status changes and system actions. |
| `test_order_comments` | `portal_order_comments` | User comments only. |
| `test_order_comment_attachments` | `portal_order_comment_attachments` | Comment attachment metadata. |
| `test_inventory_current` | `portal_inventory_current` | New portal inventory snapshot table. |
| `test_inventory_staging` | `portal_inventory_staging` | New portal inventory staging table. |
| `test_inventory_changes` | `portal_inventory_changes` | New portal inventory change log. |
| `test_inventory_uploads` | `portal_inventory_uploads` | New portal upload audit table. |
| `test_part_master` | `part_master` | Use original production table. |
| `test_machine_master` | `machine_master` | Use original production table. |
| `test_branch_mapping` | `branch_mapping` | Use original if columns match. |
| legacy `requests` | import source only | Keep as read-only legacy archive after cutover. |
| legacy `users` | user import source only | Do not use for new login after cutover. |

## Required new production tables

These are required because the legacy project does not safely have equivalent normalized tables:

1. `portal_profiles`
2. `portal_orders`
3. `portal_order_items`
4. `portal_order_item_billings`
5. `portal_order_events`
6. `portal_order_comments`
7. `portal_order_comment_attachments`
8. `portal_inventory_current`
9. `portal_inventory_staging`
10. `portal_inventory_changes`
11. `portal_inventory_uploads`

## Recommended legacy/audit fields for production tables

Because all old history will be migrated, production portal tables should keep legacy source references:

### `portal_orders`

Recommended extra fields:

- `legacy_source text default 'portal'`
- `legacy_order_no text`
- `legacy_status text`
- `legacy_approval_status text`
- `legacy_created_at timestamptz`
- `legacy_request_count int default 0`
- `imported_at timestamptz`

### `portal_order_items`

Recommended extra fields:

- `legacy_request_id text`
- `legacy_status text`
- `legacy_approval_status text`
- `imported_at timestamptz`

These fields allow the new portal to use clean workflow status while preserving the original old-system wording for audit/reference.

## Production order status rules to preserve

### Row/item status

- ordered qty = total approved quantity for that part row
- billed qty = sum of all billing chunks under that item
- received qty = sum of all received chunks under that item

Rules:

- rejected remains `rejected`
- received qty >= ordered qty -> `received`
- received qty > 0 and received qty < ordered qty -> `partially_received`
- billed qty >= ordered qty -> `dispatched`
- billed qty > 0 and billed qty < ordered qty -> `partially_dispatched`
- approved/processed but no billing -> `processed`

Important:

- `partially_received` is not closed.
- Future DBMS status uploads can add new billing chunks to the same item row.
- Only exactly `received` and `rejected` are closed item states.
- Historical legacy `Issued` is an exception during import only and maps to `received` because business confirmed it is closed/completed.

### Order status

Order status is derived from all item rows:

- all rows received -> `received`
- any row received/partially_received -> `partially_received`
- all rows dispatched -> `dispatched`
- any row dispatched/partially_dispatched -> `partially_dispatched`
- all rows processed -> `processed`
- pending approval/manager approval remains approval workflow status before fulfillment starts
- rejected logic applies only if fulfillment has not started

## Migration phases

### Phase 0: Freeze further feature changes

Before final migration, pause new feature development except critical fixes. The workflow is now complex and should stabilize before table switching.

### Phase 1: Production schema discovery

Run read-only SQL to document exact live production columns:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'requests', 'users', 'part_master', 'machine_master', 'branch_mapping',
    'inventory_current', 'inventory_staging', 'inventory_changes', 'inventory_uploads'
  )
order by table_name, ordinal_position;
```

Also export row counts:

```sql
select 'requests' as table_name, count(*) from public.requests
union all select 'users', count(*) from public.users
union all select 'part_master', count(*) from public.part_master
union all select 'machine_master', count(*) from public.machine_master
union all select 'branch_mapping', count(*) from public.branch_mapping
union all select 'inventory_current', count(*) from public.inventory_current;
```

Also export status values:

```sql
select coalesce("Status", 'NULL') as status, count(*)
from public.requests
group by coalesce("Status", 'NULL')
order by count(*) desc;
```

### Phase 2: Full backup before touching anything

Export these to CSV/SQL backup:

- `requests`
- `users`
- `part_master`
- `machine_master`
- `branch_mapping`
- `inventory_current`
- `inventory_staging`
- `inventory_changes`
- all `test_` tables
- storage bucket contents for attachments if used

No destructive SQL until these backups are verified.

### Phase 3: Create production portal tables without deleting legacy tables

Create `portal_` tables using the current tested `test_` schema, including all added columns:

- final order no
- processing reference
- invoice and docket fields
- billing chunk received fields
- comments and attachment fields
- legacy source/audit fields
- indexes
- RLS policies

This is an additive migration only. Existing legacy tables stay untouched.

### Phase 4: Migrate users/profile mapping

- Do not use the old `users` table for new login.
- Create Supabase Auth users for active portal users.
- Create `portal_profiles` with:
  - auth user id
  - full name
  - branch
  - role
  - active flag

Need manual verification for role mapping:

- branch
- admin
- super
- manager
- developer
- viewer if needed

### Phase 5: Migrate all legacy requests history

Decision approved: migrate **all old `requests` history**.

For each unique legacy `OrderNo`:

- create one `portal_orders` header
- create multiple `portal_order_items` rows from legacy request rows
- move legacy comments into `portal_order_comments` where possible
- create status/audit seed event in `portal_order_events`
- preserve original creation/processed dates where possible
- preserve original order number, final order number, branch, order type, order for, customer, machine, call id and warranty status
- preserve raw `requests.Status` and `requests.ApprovalStatus` in legacy fields or event metadata

Important:

- Closed historical orders will still be imported.
- Closed historical orders should not be counted as active in-transit/workflow after import.
- Use the approved mapping table above when writing final import SQL.

### Phase 6: Migrate billing/docket history

If legacy `requests` has invoice/docket/billed qty fields:

- create one `portal_order_item_billings` row per legacy request row where billed qty/invoice/docket exists
- idempotency key should prevent duplicate import
- recalculate billed qty and received qty from chunks after import
- recalculate row and order statuses

### Phase 7: Switch code from `test_` to production table layer

Do not manually replace strings everywhere blindly.

Recommended code structure:

Create a table-name config file:

```ts
export const TABLES = {
  profiles: 'portal_profiles',
  orders: 'portal_orders',
  orderItems: 'portal_order_items',
  orderEvents: 'portal_order_events',
  orderComments: 'portal_order_comments',
  orderCommentAttachments: 'portal_order_comment_attachments',
  orderItemBillings: 'portal_order_item_billings',
  partMaster: 'part_master',
  machineMaster: 'machine_master',
  branchMapping: 'branch_mapping',
  inventoryCurrent: 'portal_inventory_current',
  inventoryStaging: 'portal_inventory_staging',
  inventoryChanges: 'portal_inventory_changes',
  inventoryUploads: 'portal_inventory_uploads',
};
```

Then update services and edge functions to use this mapping or equivalent server-side constants.

### Phase 8: Edge Function migration

All Edge Functions must be reviewed and changed from test tables to portal production tables:

- `create-portal-user`
- `create-order-action`
- `approval-order-action`
- `order-item-qty-action`
- `admin-order-action`
- `status-report-action`
- `docket-receive-action`
- `inventory-upload-action`

Do not deploy these production functions until the production tables exist.

### Phase 9: Parallel testing in production database

Before real cutover, use a small group of test production rows:

- create a new order
- approve
- manager approve if required
- process with DBMS number
- upload status report for partial dispatch
- receive one docket row
- check partial received status
- add future dispatch chunk to same item
- receive final chunk
- confirm order becomes received
- test inventory lookup and in-transit calculation
- verify imported legacy `Issued` rows are not counted as active work

### Phase 10: Cutover window

During the final cutover:

1. Announce freeze.
2. Stop old portal order entry.
3. Export final backups.
4. Run migration SQL.
5. Run row counts and reconciliation reports.
6. Deploy production Edge Functions.
7. Deploy Vercel production frontend.
8. Run smoke test.
9. Release users.
10. Keep old portal read-only.

### Phase 11: Post-cutover monitoring

For first 3-7 days:

- daily backup of `portal_orders`, `portal_order_items`, `portal_order_item_billings`
- monitor failed status uploads
- monitor docket receive errors
- compare new portal order counts with old expected reports
- keep old portal read-only for reference

## Rollback plan

If anything fails seriously:

1. Roll Vercel back to previous deployment.
2. Re-enable old portal writes only if absolutely required.
3. Keep all new portal rows; do not delete.
4. Export new portal rows written during failed cutover.
5. Reconcile manually before next attempt.

## Decisions still needed before final SQL writing

1. Exact `requests` column names for invoice, docket, billing date, transport, billed qty, edited qty and comments.
2. Whether legacy attachments exist and where they are stored.
3. Final go-live date/time and freeze window.
4. Final user list with email addresses for Supabase Auth creation.

## Recommended next action

Run the read-only schema discovery SQL and paste the `requests` column list into ChatGPT. After that, write the final production migration SQL in three scripts:

1. `create_portal_production_schema.sql`
2. `migrate_legacy_requests_to_portal.sql`
3. `post_migration_reconciliation_checks.sql`
