# Dealer Price List publish timeout — 2026-10-12

## Scope
The October upload (87,666 validated and staged parts) remains previewed, not published. This PR **does not execute any database migration**, deploy, modify production rows, or publish a price list.

## Cause and evidence
A PostgreSQL `statement timeout` was logged around the October upload. The original publish RPC updates all 85k existing matched rows, normalizes `PartNo` per comparison in its update and delete predicates, and writes ~88k history rows in one atomic transaction. The database has a B-tree on `part_master."PartNoNormalized"` and a unique composite staging index on `(upload_id,part_no_normalized)`. Production inspection found 85,152 active physical rows, zero null normalized keys, and zero differences between normalized keys and the current normalization expression. Existing publication status is `previewed`.

## Changes
- Match on the indexed `PartNoNormalized` column directly.
- Skip updates for rows whose business fields are identical (`IS DISTINCT FROM`, including NULL-safe values).
- Deduplicate by the stored normalized key, preserving original `ctid` tie-break.
- Keep transactional lock, insert, removal, history, status, permissions and outcome atomic.

## Safe verification before applying migration
1. Confirm normalized-key invariant still holds and record current index definitions. If either invariant fails, **do not apply**.
2. Run SQL syntax and smoke tests against a disposable database populated with a synthetic master and staging data: changed, unchanged, newly added, removed and duplicate existing part cases. Check role denial, invalid staging counts, rollback behavior, published snapshot completeness and double-publish prevention.
3. Compare `EXPLAIN (without ANALYZE)` plans for original versus replacement on a test database. No actual publish against production.
4. Run repository CI checks and review PR. Applying the migration to production requires separate approval.
5. After deployment approval, perform controlled publication and audit counts only on explicit approval.

## Rollback
Use `supabase/rollback/20261012_restore_part_master_publish_function.sql` to restore the previous RPC definition. This reverses **code**, not already-published snapshots. Never replay a historical snapshot automatically.

## Boundaries
No global `statement_timeout` increase. No changes to browser uploader, preview code, tables, RLS, or production records. If the optimized publication is still slow, benchmark and consider a second separate change rather than lifting the global timeout.
