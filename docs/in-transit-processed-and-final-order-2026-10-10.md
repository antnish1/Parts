# In Transit: processed orders and final order number

## Changes
- `portal_get_in_transit_qty` excludes status `PROCESSED` and any order whose parent status is `PROCESSED`.
- `portal_get_in_transit_details` applies the same exclusion, so popup and total remain aligned.
- Popup `order_no` value prefers `portal_orders.final_order_no`, then `processing_reference`, then the original `order_no` only when no final number is available.
- Existing 15-day dispatched/partially dispatched billing window, RLS/security invoker, branch normalization and original order records remain unchanged.
- Example: order `3d230cac-8ba1-4221-9100-bcbf0e0add5f` has final number `111709390` and status `processed`; it must no longer contribute to In Transit.

## Deployment and checks
1. Merge only after CI validation and user approval.
2. Apply `supabase/migrations/20261010_in_transit_exclude_processed_final_order_number.sql` to the verified Parts Supabase production project.
3. Verify for several parts that `portal_get_in_transit_qty` equals the sum of `portal_get_in_transit_details.qty`.
4. Confirm processed order `3d230cac-8ba1-4221-9100-bcbf0e0add5f` no longer appears for `336/F3127`.
5. Confirm eligible orders with changed final numbers show final DBMS numbers, not temporary PORTAL numbers.
6. Confirm DISPATCHED/PARTIALLY DISPATCHED still observe the under-15-calendar-day billing rule.
7. Regression-test approved, pending, rejected, issued, received and partially received statuses.

## Rollback
- Apply `supabase/rollback/20261010_restore_in_transit_before_processed_exclusion.sql` to revert both PostgreSQL function definitions.
- Revert the PR's source changes if necessary. Git revert alone does not revert a database function deployment.
- No order rows or historical data need to be restored.
