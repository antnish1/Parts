# Production Table Mapping Plan

This document is a planning reference only. It does not change any production table. Use it before writing final migration SQL.

## Purpose

The React rebuild currently uses staging tables with `test_` prefixes. Before cutover, each staging object must be mapped to a production object and reviewed for column compatibility, constraints, RLS policies, and rollback safety.

## Tables that must not be touched before cutover approval

Current live/legacy production tables remain protected until explicit approval:

- `requests`
- `users`
- `part_master`
- `branch_mapping`
- `inventory_current`
- `inventory_staging`
- `inventory_changes`
- `machine_master`

## Recommended production naming

For the new React production app, use clean production names rather than reusing legacy table names blindly. Recommended names:

| Staging table | Recommended production table |
|---|---|
| `test_profiles` | `profiles` |
| `test_branch_mapping` | `branch_mapping` |
| `test_part_master` | `part_master` |
| `test_machine_master` | `machine_master` |
| `test_orders` | `orders` |
| `test_order_items` | `order_items` |
| `test_order_events` | `order_events` |
| `test_order_comments` | `order_comments` |
| `test_inventory_current` | `inventory_current` |
| `test_inventory_staging` | `inventory_staging` |
| `test_inventory_changes` | `inventory_changes` |
| `test_inventory_uploads` | `inventory_uploads` |

If the existing legacy names conflict with old behavior, create new production tables with versioned names such as `portal_orders` and `portal_order_items` instead of overwriting legacy tables.

## Core column requirements

### Profiles

Required fields:

- `id`
- `auth_user_id`
- `full_name`
- `branch`
- `role`
- `is_active`
- `created_at`

`auth_user_id` must reference Supabase Auth users and should be unique or functionally unique.

### Orders

Required fields:

- `id`
- `order_no`
- `final_order_no`
- `processing_reference`
- `branch`
- `order_type`
- `order_for`
- `machine_no`
- `customer_name`
- `status`
- `approval_status`
- `processed_notes`
- `processed_date`
- `created_at`
- `updated_at`

### Order items

Required fields:

- `id`
- `order_id`
- `item_code`
- `item_name`
- `qty`
- `edited_qty`
- `billed_qty`
- `dnp`
- `row_status`
- `dbms_invoice_no`
- `dbms_invoice_date`
- `docket_no`
- `transport_name`
- `received_date`
- `created_at`
- `updated_at`

Item-level invoice and docket fields are mandatory for the rebuilt workflow.

### Order events

Required fields:

- `id`
- `order_id`
- `event_type`
- `old_status`
- `new_status`
- `notes`
- `metadata`
- `created_at`

### Order comments

Required fields:

- `id`
- `order_id`
- `comment`
- `created_by`
- `created_at`

### Inventory current

Required fields:

- `id`
- `branch_code`
- `branch_name`
- `item_code`
- `item_name`
- `item_group`
- `uom`
- `dnp`
- `qty`
- `inv_value`
- `report_date`
- `updated_at`

Recommended unique key:

```sql
unique (branch_code, item_code)
```

### Inventory staging

Required fields:

- `id`
- `upload_batch_id`
- `report_date`
- `branch_code`
- `branch_name`
- `item_code`
- `item_name`
- `item_group`
- `uom`
- `dnp`
- `closing_balance`
- `closing_value`
- `source_filename`
- `created_at`

### Inventory changes

Required fields:

- `id`
- `report_date`
- `branch_code`
- `item_code`
- `old_qty`
- `new_qty`
- `old_value`
- `new_value`
- `change_type`
- `source_filename`
- `created_at`

### Inventory uploads

Required fields:

- `id`
- `report_date`
- `filename`
- `total_rows`
- `valid_rows`
- `failed_rows`
- `status`
- `created_at`

## Migration strategy options

### Option A: Rename staging tables after approval

This is fast but risky if staging contains test data. Only use if staging data is clean and approved.

High-level sequence:

1. Backup existing production tables.
2. Backup staging tables.
3. Stop writes.
4. Rename existing production tables to archive names.
5. Rename staging tables to production names.
6. Rebuild indexes and policies.
7. Switch frontend environment to production.

### Option B: Create fresh production tables and copy selected data

This is safer and recommended.

High-level sequence:

1. Create clean production tables from reviewed schema.
2. Copy approved master data only.
3. Recreate required indexes.
4. Recreate RLS policies.
5. Deploy Edge Functions against production tables after code switch.
6. Run smoke test.
7. Release users.

### Option C: Keep legacy production tables and adapt app queries

Use this only if legacy tables already have compatible fields. This has the highest risk of hidden legacy behavior conflicts.

## RLS policy requirements

Minimum policies should support:

- Active branch users can create and view their own branch orders.
- Super and manager roles can view/approve assigned approval workflows.
- Admin can process, issue, receive, and upload inventory.
- Developer can perform diagnostics and controlled support actions.
- Service-role Edge Functions can perform protected writes.

## Edge Function table references

Before production cutover, every Edge Function must be reviewed to replace staging table names if production names differ.

Functions to review:

- `create-portal-user`
- `admin-order-action`
- `approval-order-action`
- `order-item-qty-action`
- `docket-receive-action`
- `inventory-upload-action`

## Pre-migration SQL review checklist

Before running any SQL on production:

- Confirm exact source and target table names.
- Confirm no test rows are being copied accidentally.
- Confirm primary keys and foreign keys.
- Confirm unique constraints.
- Confirm RLS policies.
- Confirm indexes for search fields.
- Confirm backups are downloadable and restorable.
- Confirm rollback SQL is prepared.

## Final decision needed before SQL writing

Choose one production naming approach:

1. Use existing legacy names where compatible.
2. Archive legacy names and reuse clean production names.
3. Use new versioned names such as `portal_orders`, `portal_order_items`, and related tables.

No production SQL should be written until this naming decision is approved.
