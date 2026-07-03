# Production Migration and Cutover Plan

This plan explains how to move the React rebuild from staging tables to production safely. Do not start cutover until the staging flow is fully tested and approved.

## Current staging scope

The React rebuild is currently wired to staging/test tables:

- `test_profiles`
- `test_branch_mapping`
- `test_part_master`
- `test_orders`
- `test_order_items`
- `test_order_events`
- `test_order_comments`
- `test_machine_master`
- `test_inventory_current`
- `test_inventory_staging`
- `test_inventory_changes`
- `test_inventory_uploads`

Live production tables must remain untouched until the final migration window.

## Phase 1: Staging validation

Complete these checks in staging first:

1. Login works with Supabase Auth email/password.
2. Profile loads from `test_profiles.auth_user_id`.
3. Branch user can create a multi-item order.
4. Super can approve, reject, and forward to manager.
5. Manager can approve and reject manager-pending orders.
6. Admin can process, reject, and issue item rows.
7. Docket scanner receives matching item rows only.
8. Item row status correctly derives order-level status.
9. Inventory upload stages rows, logs changes, and updates current inventory.
10. Reports CSV and Excel export work.
11. Developer profile edit/deactivate and comments inbox work.
12. All Edge Functions are deployed and tested.

## Phase 2: Data mapping

Map staging table structure to production table structure before migration.

| Staging object | Production target | Notes |
|---|---|---|
| `test_profiles` | production user/profile table | Must include `auth_user_id`, role, branch, active flag |
| `test_branch_mapping` | branch mapping table | Confirm branch codes and names |
| `test_part_master` | part master table | Confirm item code, part number, DNP, MRP, group |
| `test_machine_master` | machine master table | Confirm machine/customer fields |
| `test_orders` | order header table | Keep final order number and workflow fields |
| `test_order_items` | order item table | Must preserve item-level invoice/docket/received fields |
| `test_order_events` | order events/audit table | Keep old/new status and notes |
| `test_order_comments` | comments table | Keep user and order relationship |
| `test_inventory_current` | inventory current table | Unique key should be branch plus item code |
| `test_inventory_changes` | inventory change log table | Keep old/new quantity and value |
| `test_inventory_uploads` | upload audit table | Keep report date and filename |

## Phase 3: Cutover preparation

Before production switch:

1. Export backup of every live production table.
2. Export backup of every staging/test table.
3. Confirm all migrations are applied in the target Supabase project.
4. Confirm Edge Function secrets are configured server-side only.
5. Confirm Vercel environment points to the correct Supabase project.
6. Confirm RLS policies match intended role behavior.
7. Confirm at least one active developer user exists and can login.
8. Confirm rollback branch or previous deployment is available.

## Phase 4: Freeze window

During the cutover window:

1. Stop live users from entering new orders in the old portal.
2. Export final live data backup.
3. Disable old write paths if possible.
4. Apply final production migration scripts.
5. Import or transform required live data into the new schema.
6. Deploy Edge Functions.
7. Deploy frontend with production mode enabled.
8. Run smoke tests before releasing to all users.

## Phase 5: Smoke testing after cutover

Minimum go-live smoke test:

1. Developer login.
2. Admin login.
3. Branch login.
4. Create one test production order.
5. Approve it.
6. Process it.
7. Issue one or more item rows.
8. Receive by docket or invoice.
9. Upload one small inventory file.
10. Export reports.
11. Check Developer comments inbox.
12. Confirm no writes are going to staging tables.

## Rollback plan

Rollback is required if core order creation, approval, admin processing, or docket receive fails after production release.

Rollback steps:

1. Switch Vercel back to previous stable deployment.
2. Re-enable old portal write path if it was disabled.
3. Preserve all data written during failed cutover for reconciliation.
4. Do not delete new production tables until reconciliation is complete.
5. Compare failed writes against order events and comments.
6. Fix issue in staging first, then schedule another cutover window.

## Final go-live checklist

- Production Supabase Auth login confirmed.
- Active profile mapping confirmed.
- All Edge Functions deployed.
- Service-role key not exposed to frontend.
- Vercel production environment reviewed.
- Live tables backed up.
- Staging tables backed up.
- Order lifecycle tested end-to-end.
- Inventory upload tested.
- Reports export tested.
- Rollback deployment confirmed.
- Business owner approval received.

## Important safety rule

Until the final cutover is explicitly approved, keep all development, testing, and rebuild work on staging/test tables only.
