# Final Production Migration Plan

This document is the safe cutover plan for making the React Parts Connect Portal the main workplace without losing legacy data or current workflow.

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

Do not overwrite or rename existing live tables during the first cutover.

The safest approach is to create a new clean production schema for the portal order workflow while continuing to use the existing master tables:

- Keep existing `part_master` as the production part master.
- Keep existing `machine_master` as the production machine/customer lookup.
- Keep existing `branch_mapping` after checking column compatibility.
- Keep existing inventory tables if their column structure matches the new portal inventory workflow.
- Create new production portal tables for workflows that do not safely exist in the legacy project.

Recommended naming:

- `portal_profiles`
- `portal_orders`
- `portal_order_items`
- `portal_order_events`
- `portal_order_comments`
- `portal_order_comment_attachments`
- `portal_order_item_billings`
- `portal_inventory_uploads` if existing `inventory_uploads` does not exist

Reason: this avoids destroying or corrupting `requests`, and gives rollback safety.

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
| `test_inventory_current` | `inventory_current` or `portal_inventory_current` | Use existing if compatible. |
| `test_inventory_staging` | `inventory_staging` or `portal_inventory_staging` | Use existing if compatible. |
| `test_inventory_changes` | `inventory_changes` or `portal_inventory_changes` | Use existing if compatible. |
| `test_inventory_uploads` | `portal_inventory_uploads` | Create if no production audit table exists. |
| `test_part_master` | `part_master` | Use original production table. |
| `test_machine_master` | `machine_master` | Use original production table. |
| `test_branch_mapping` | `branch_mapping` | Use original if columns match. |

## Required new production tables

These are required because the legacy project likely does not have equivalent normalized tables:

1. `portal_profiles`
2. `portal_orders`
3. `portal_order_items`
4. `portal_order_item_billings`
5. `portal_order_events`
6. `portal_order_comments`
7. `portal_order_comment_attachments`
8. `portal_inventory_uploads` if not already present

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
- indexes
- RLS policies

This is an additive migration only. Existing legacy tables stay untouched.

### Phase 4: Migrate users/profile mapping

- Do not migrate plain-text passwords from legacy `users`.
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

### Phase 5: Migrate open legacy orders only if needed

Decision required: migrate all historical `requests` data, or only open/live orders?

Recommended for first cutover:

- migrate only non-final/open orders from `requests`
- keep historical closed orders in legacy reports until after go-live

Possible final statuses to exclude from first migration:

- received
- rejected
- closed
- cancelled

For each unique legacy `OrderNo`:

- create one `portal_orders` header
- create multiple `portal_order_items` rows from legacy request rows
- move legacy comments into `portal_order_comments` where possible
- create status/audit seed event in `portal_order_events`

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
  inventoryCurrent: 'inventory_current',
  inventoryStaging: 'inventory_staging',
  inventoryChanges: 'inventory_changes',
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
2. Re-enable old portal writes if needed.
3. Keep all new portal rows; do not delete.
4. Export new portal rows written during failed cutover.
5. Reconcile manually before next attempt.

## Questions to answer before SQL writing

1. Do you want old historical `requests` orders imported into the new portal, or only open/live orders?
2. Should the production order tables be named `orders/order_items` or safer `portal_orders/portal_order_items`?
3. Should existing inventory tables be used directly, or should we create `portal_inventory_*` tables too?
4. Are all current users ready to move to Supabase Auth email/password login?
5. Which statuses in old `requests.Status` mean final closed orders?
6. Do you want the old portal to become read-only after cutover, or fully disabled?

## Recommended decision

Use `portal_` production tables for all new workflow tables and keep existing master tables as-is:

- use existing `part_master`
- use existing `machine_master`
- use existing `branch_mapping` if compatible
- use existing inventory tables only after column check
- keep `requests` untouched as legacy archive/source
- create `portal_orders`, `portal_order_items`, `portal_order_item_billings`, comments and events for the new portal

This gives the safest migration because no previous live data is deleted, overwritten, or renamed.
