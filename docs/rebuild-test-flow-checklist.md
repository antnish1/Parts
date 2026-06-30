# Rebuild test flow checklist

This checklist is for the React rebuild under the app folder.

All current working screens must use only test tables:

- test_orders
- test_order_items
- test_branch_mapping
- test_part_master
- test_inventory_current

Do not connect these screens to live production tables until cutover approval.

## Required Supabase setup

Run these files in Supabase SQL Editor:

1. supabase/migrations/001_create_rebuild_test_tables.sql
2. supabase/seed/001_seed_rebuild_test_data.sql
3. docs/manual-test-write-policies.md
4. docs/manual-test-approval-policies.md

## Full test flow

1. Open /orders/new
2. Select a branch from the test branch dropdown
3. Select a part from test part lookup
4. Create a TEST order
5. Open /orders/track
6. Search or filter the order
7. Click View and confirm item details
8. Open /approvals/pending
9. Approve or reject a pending TEST order
10. For approved orders, open /admin/approved
11. Process the approved TEST order
12. Open /manager/dashboard
13. Confirm KPI cards, branch summary, and status summary
14. Open /reports
15. Download test CSV
16. Open /inventory/upload
17. Confirm test inventory lookup works

## Safety checks

Before production cutover, confirm that these live tables are not used for writes:

- requests
- users
- part_master
- branch_mapping
- inventory_current
- inventory_staging
- inventory_changes

## Current safe behavior

- New Order writes to test_orders and test_order_items only.
- Tracking reads from test_orders and test_order_items only.
- Approvals update test_orders only.
- Admin processing updates test_orders only.
- Inventory lookup reads test_inventory_current only.
- Reports read test_orders only.
- Dashboard reads test_orders only.
