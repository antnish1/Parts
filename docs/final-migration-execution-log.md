# Final Migration Execution Log

This log records the safe production migration checkpoints from legacy `requests`/test workflow to the new `portal_` production workflow.

## Step 001 - Portal production schema

Status: completed by Nishant in Supabase SQL Editor.

Created/confirmed tables:

- `portal_inventory_changes`
- `portal_inventory_current`
- `portal_inventory_staging`
- `portal_inventory_uploads`
- `portal_order_comment_attachments`
- `portal_order_comments`
- `portal_order_events`
- `portal_order_item_billings`
- `portal_order_items`
- `portal_orders`
- `portal_profiles`

## Step 000 - Backup before import

Status: completed by Nishant in Supabase SQL Editor.

Verified counts:

| source_table | source_rows |
| --- | ---: |
| public.requests | 3567 |
| backup.requests | 3567 |
| public.part_master | 85150 |
| backup.part_master | 85150 |
| public.machine_master | 4305 |
| backup.machine_master | 4305 |

Result: backup successful. No manual copy required.

## Step 002 - Legacy requests import

Status: completed by Nishant in Supabase SQL Editor.

Import metrics:

| metric | value |
| --- | ---: |
| legacy_requests | 3567 |
| portal_orders_imported | 622 |
| portal_items_imported | 3567 |
| portal_billing_chunks_imported | 1878 |

Final go/no-go summary:

| legacy_request_rows | imported_item_rows | legacy_order_count | imported_order_count | imported_billing_chunks |
| ---: | ---: | ---: | ---: | ---: |
| 3567 | 3567 | 622 | 622 | 1878 |

Result: import count reconciliation passed.

## Billing reconciliation total

Status: received from Nishant after script 003 billing total query.

| billing_chunk_count | total_billed_qty | total_received_qty |
| ---: | ---: | ---: |
| 1878 | 30272.00 | 22651.00 |

Observation:

- Billing chunk count matches the import count of 1878.
- Total billed quantity is greater than total received quantity, which is expected because not every dispatched/billed part has been received yet.
- Difference between billed and received quantity: 7621.00.

## Docket reconciliation sample

Status: received from Nishant after script 003 docket sample query.

Important observations:

- Docket-wise import is working: one docket can contain many billing rows, which matches the real plant dispatch workflow.
- Example: docket `501546374571` has 60 imported rows, billed qty 1326.00, received qty 737.00. This is a good test docket for partial receiving.
- Example: docket `501546419821` has 31 imported rows, billed qty 410.00, received qty 410.00. This is a good test docket for fully received rows.
- Example: docket `225051275` has 14 imported rows, billed qty 492.00, received qty 0.00. This is a good test docket for not-yet-received rows.
- Docket value `0` appeared in the sample with 10 rows. This should be treated as invalid/placeholder unless Nishant confirms it is a real docket number.

Recommendation before cutover:

- Docket Scan should ignore blank docket numbers and placeholder docket `0`.
- Legacy import data does not need to be deleted for docket `0`; the scanner/search UI can simply exclude it.

## Date reconciliation

Status: completed by Nishant after running final date fix scripts.

Results:

| check | result |
| --- | ---: |
| remaining_dot_format_order_reg_dates | 0 |

Final date failure verification returned no rows.

Observation:

- Excel serial dates such as `46122` were fixed.
- Dot-format dates such as `12.05.2026` were fixed.
- Legacy order registration date parsing is now clear for imported rows.

## Current status

The database has passed the first critical migration checks:

- Every legacy `requests` row was imported as one `portal_order_items` row.
- Distinct legacy orders match imported `portal_orders`.
- Billing chunks were imported into `portal_order_item_billings`.
- Billing totals were received and recorded.
- Docket-wise billing chunks are available for scanner verification.
- Date reconciliation is complete.

## Next required checks before app switch

Before changing frontend/services/Edge Functions from `test_` tables to `portal_` tables, run the remaining read-only reconciliation checks from:

`supabase/final_migration_scripts/003_post_migration_reconciliation_checks.sql`

Especially verify:

1. Missing rows after import returns zero rows.
2. Imported items without matching legacy request returns zero rows.
3. Portal item status distribution looks correct.
4. Portal order status distribution looks correct.

Only after these checks pass should the app code and Edge Functions be switched to `portal_` tables.
