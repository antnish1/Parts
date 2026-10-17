# Credit Dispatch manager-first rollout (versioned, production-safe)

## Invariants
- Existing 131 Credit Dispatch records are version 1 and MUST NOT be reclassified or updated in bulk.
- V1: Branch -> Accounts -> Manager -> Approved/payment recovery. V1 corrections return to Accounts.
- V2: Branch -> Manager -> Accounts -> Approved/payment recovery. V2 corrections return to Manager.
- All review writes remain within `portal_review_credit_dispatch`, checked by the version-aware transition guard.
- Final `approved_by` and `approved_at` represent the final reviewing stage (Manager for V1; Accounts for V2).
- Rejected and approved requests stay final. Payment recovery only begins when status is Approved.
- Preserve signatures, events, payments, customer records, and access policies.

## Current state and production baseline
Read-only production snapshot on 2026-10-17: 112 Approved, 16 Pending Accounts Approval, 2 Correction Requested by Manager, 1 Rejected by Manager; 84 Approved records already have payments.

## Coordinated release sequence
1. Merge PRs only after App CI / Mobile CI and migration SQL review.
2. Publish website and Android OTA clients for manager-first BEFORE activating the new database default. Old database accepts these clients only if new submissions are temporarily paused: avoid user submission during this tiny window, or stage release in a controlled maintenance window.
3. Apply `20261017_credit_dispatch_versioned_manager_first.sql` atomically after compatible clients are available. Verify all existing rows have approval_flow_version 1 and statuses unchanged, and new table default is 2.
4. Reopen submissions and test new Manager -> Accounts -> Approved flow using controlled authorized accounts. Test role rejection, correction restart, old records, payments, and website/Android parity.
5. Watch error logs and pending approval counts after release. Do not run unguarded test INSERTs on production.

## Compatibility caveat
An older mobile app or cached website can send a new status of Pending Accounts Approval. The database insert trigger normalizes its status to Pending Manager Approval in version 2, but its legacy client-side activity message may still say Accounts. Upgrade/publish both clients and invalidate cached website assets as part of release.

## Rollback
If problems arise, first revert clients to the previous release, then execute `supabase/rollbacks/20261017_credit_dispatch_disable_manager_first.sql` to set version-1 default for **future** requests only. Do **not** drop version-aware functions or the column, as active version-2 requests must still complete safely. Never rewrite current status, events, or histories as part of rollback.

## Verification read-only SQL
```sql
select approval_flow_version,approval_status,count(*)
from public.portal_credit_dispatches
group by 1,2 order by 1,2;
select column_default from information_schema.columns
where table_schema='public' and table_name='portal_credit_dispatches'
and column_name='approval_flow_version';
```
