# In Transit: include processed orders and rows in same-branch quantities (2026-10-15)

## Approved business rule
- Include **PROCESSED** item rows and orders in **In Transit** for the same canonical branch, regardless of their age, while they still have unreceived effective quantity.
- A processed item must remain eligible when its *parent order* is partially dispatched or dispatched. Do not apply the parent's 15-calendar-day **dispatched** billing window to that undispatched processed item.
- Continue treating genuinely **DISPATCHED** / **PARTIALLY DISPATCHED** rows under the existing billing-date window (today through 14 prior days), respecting billing chunks, actual receipts, and the effective quantity cap.
- Preserve APPROVED and PARTIALLY RECEIVED behavior, and exclude PENDING*, REJECTED, RECEIVED and ISSUED statuses exactly as before.
- Preserve current canonical branch filtering, part normalization, edited quantity fallback, received-quantity deduction, detailed popup navigation to final order number, and security-invoker/RLS behavior. No cross-branch aggregation.
- This rule supersedes the 2026-10-10 document's processed-exclusion decision; that historical document remains as the audit trail.

## Implementation
- New migration: `supabase/migrations/20261015_in_transit_include_processed_same_branch.sql`.
- Reversible rollback: `supabase/rollback/20261015_restore_in_transit_exclude_processed.sql`.
- Both the total (`portal_get_in_transit_qty`) and drill-down (`portal_get_in_transit_details`) apply the same conditional calculation. There is no frontend, order-status, or data change.

## Production data regression cases (read-only, captured 2026-10-15)
- **161319425** (JABALPUR_PARTS), part **400/23424**, item PROCESSED, parent PARTIALLY DISPATCHED, no invoice/billing: should contribute **5**, not 0.
- **1650644138** (JABALPUR_PARTS), same part, PROCESSED and PARTIALLY RECEIVED parent, unreceived 5: should contribute **5**, even though it is older than 15 days.
- **PORTAL-1791973288832-562** (MANDLA), same part, pending manager approval: should contribute **0**. JABALPUR_PARTS items must never leak into MANDLA results.
- With the snapshot above still unchanged, JABALPUR_PARTS should show **10** for 400/23424 and MANDLA **0** after migration. Live values can legitimately change when orders are fulfilled/received/issued.

## Safe deployment / verification
1. Check production `pg_get_functiondef` is equivalent to October 10 baseline before migration. Run GitHub App CI; the web build alone does **not** validate SQL functions.
2. Merge only after PR review and approval. Apply this SQL migration to the verified Parts production Supabase project *after* that approval. No preview database is available, so do not make unrelated production writes.
3. Verify both outputs and consistency for the sample part:

```sql
select * from public.portal_get_in_transit_qty('JABALPUR_PARTS', array['400/23424']);
select order_no, branch, status, qty
from public.portal_get_in_transit_details('JABALPUR_PARTS', '400/23424')
order by order_no;
select * from public.portal_get_in_transit_qty('MANDLA', array['400/23424']);
select * from public.portal_get_in_transit_details('MANDLA', '400/23424');
```

4. For several parts, confirm total equals sum of details; verify same-branch aliases, approved/processed/mixed-status parents, pending/rejected/issued/received exclusions, partial receipts, edited qty, billing-age 0/14/15/16 days, final order numbers and access constraints across user roles.
5. Monitor operational totals after activation, as historic unreceived processed lines will become visible by design.

## Rollback
Apply `supabase/rollback/20261015_restore_in_transit_exclude_processed.sql` to the **same project**. It replaces the two RPC definitions with their prior October 10 logic. Reverting GitHub code without applying database rollback does not roll back production SQL functions.
