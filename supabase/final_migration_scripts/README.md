# Final Production Migration Scripts

These scripts are prepared for the final migration from legacy `requests`/test tables to production `portal_` tables.

## Safety rule

Do **not** run these directly on production until:

1. Full backup is exported and verified.
2. Old portal write access is frozen.
3. User list for Supabase Auth is finalized.
4. The scripts are reviewed in Supabase SQL Editor.
5. A rollback deployment is ready in Vercel.

## Script order

1. `001_create_portal_production_schema.sql`
   - Creates new `portal_` production tables only.
   - Does not delete, rename, or overwrite old tables.

2. `002_migrate_legacy_requests_to_portal.sql`
   - Imports all old `requests` history.
   - Preserves raw legacy status/approval status.
   - Maps `Issued` to `issued`, not `received`.
   - Treats `received`, `issued`, and `rejected` as closed/non-active.

3. `003_post_migration_reconciliation_checks.sql`
   - Read-only validation queries.
   - Compares legacy counts with imported portal counts.

## Important

The app code and Edge Functions must not be switched to `portal_` tables until script 001 has been applied and script 003 checks pass after import.
