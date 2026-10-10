# Reversible release notes — 2026-10-10

## Scope
- Active manager users can process an already-approved order and supply its DBMS order number, without gaining admin rejection or issue actions.
- Adds SEONI / TUSHAR PATLE to service engineer data when the migration is applied.
- Adds part 448/15701 (DRIVEHEADADCASING) to part_master if missing. DNP intentionally NULL until verified against JCB pricing; SAP inventory valuation is not proven to be DNP.

## Deployment
1. Run repository CI and examine changes.
2. Merge only with explicit user approval.
3. Apply the additive migration to the correctly identified Parts production Supabase project after approval; do not run it on Insureit.
4. Deploy updated `admin-order-action` Supabase Edge Function alongside the frontend. A frontend-only deployment will not grant managers backend authorization.
5. Test a manager processing an approved order, non-approved order rejection, non-manager denial, admin processing, and manager denial for reject/issue.

## Rollback
- Revert the PR to restore the previous frontend and Edge Function source, then redeploy both.
- Data additions are **not** automatically undone by a Git revert. Only if unused, manually remove the exact newly created rows with:
```sql
-- Inspect dependencies and current records before any deletion.
-- delete from public.portal_service_engineers where branch_key='SEONI' and engineer_name='TUSHAR PATLE';
-- delete from public.part_master where "PartNo"='448/15701';
```
- Never remove an engineer already referenced by a TA/DA SVR or a part used in an order.
