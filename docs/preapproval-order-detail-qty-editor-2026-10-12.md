# Pre-approval Order Details quantity editing

- Display inline pencil/edit/save/cancel/reset quantity controls only for authorized developer, manager, or selected super approver while both order and approval statuses remain pending.
- Preserve original `qty`; store adjusted values in `edited_qty` and `edited_value` via existing `order-item-qty-action`.
- Enforce pending statuses server-side for both set and reset. Approved and later orders are blocked even if the client is bypassed; selected super approver remains scoped to the order.
- On save, refetch Order Details so row values and summary totals update. Preserve existing approvals and order audit architecture.
- No database migrations or master-data modifications.

## Verification
1. CI App build; manual pending-order edit as manager, selected super, developer.
2. Verify edited quantity and value, original qty, reset, invalid input, and total updates.
3. Verify approved order (including `b7a16da1-c95e-4393-bfe0-128a3b80ee7a`) hides editor and backend denies direct update.
4. Verify other/unauthorized super approver is denied and branch/other user access remains unchanged.
5. Ensure mobile layout is usable and approval actions remain unchanged.

## Deployment
After user-approved merge, deploy the frontend through its configured host AND deploy `supabase/functions/order-item-qty-action/index.ts` as an Edge Function. GitHub merge alone does not change the live backend.

## Reversal
Git revert of this PR plus redeploy of prior `order-item-qty-action` function removes the new pre-approval restriction and editor. Existing edited rows are preserved; no data migration to undo.
