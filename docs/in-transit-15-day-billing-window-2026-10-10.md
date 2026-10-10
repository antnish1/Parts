# In Transit dispatched quantity — 15-day billing window

## Decision
For DISPATCHED and PARTIALLY DISPATCHED rows (either item or order status), calculate calendar day age = current_date - bill date; count only ages 0 through 14. At 15 days do not count. Leave APPROVED, PROCESSED and PARTIALLY RECEIVED semantics unchanged unless the parent order itself is dispatched/partially dispatched.

## Date and quantity policy
- For items having billing chunks in `portal_order_item_billings`, each chunk contributes `greatest(billed_qty-received_qty, 0)` when its `billing_date` is current date through previous 14 days. Old, undated or future chunks contribute zero.
- Cap the sum to the original item's unreceived effective quantity, avoiding overcount from duplicate/overbilling records.
- Use `portal_order_items.dbms_invoice_date`, then `portal_orders.dbms_invoice_date`, **only if no billing chunks exist**. Do not use the fallback to rescue undated chunks.
- Neither the order-registration date nor the order-created date counts as bill date.
- Existing canonical branch filtering, pending/rejected/received/issued exclusions, and edited-qty semantics stay in place.
- Both public RPCs use the same conditional expression to keep the popup and aggregate aligned.
- No historical rows or permissions are changed.

## Verification before deployment
1. App CI must pass. SQL migrations cannot be validated by the frontend build.
2. Apply migration only after merge approval, to the intended Parts project, and inspect the target function definitions.
3. Check 0-, 14-, 15-, and 16-day billing dates and missing/future dates; test chunks mixing eligible and old dates, as well as multiple chunks and partial receipts.
4. Verify `sum(popup.qty) = summary qty` for a matching branch/part.
5. Confirm processed/approved orders still count as previously and cross-branch rows stay excluded.
6. Check that any existing invoice-date fallback aligns with live legacy records.

## Reversal
Run `supabase/rollback/20261010_restore_in_transit_before_15_day_window.sql` on the same Supabase project. This restores the previous two function definitions. Do not revert data. Git revert alone does not roll back database functions.
