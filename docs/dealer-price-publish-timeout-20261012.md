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

## Follow-up validation on 2026-10-12 (read-only production queries)
- GitHub App CI #1972 passed.
- Query planner for optimized comparison shows a merge join with index scans on both `idx_part_master_part_no_normalized` and `portal_part_master_staging_upload_id_part_no_normalized_key`.
- October staged rows: **87,666**. Active physical rows: **85,152**, including **4 duplicate normalized keys**.
- Matching physical rows: **85,143**; all **85,143 require an update** under full-field comparison. New staged rows **2,527**; active physical rows absent from staging **9**.
- Per-column differences across matching rows: HSN **85,143**, GST **85,143**, Cat2 **84,675**, DNP **14,266**, RTL **14,259**, MRP **14,258**, Description **1,331**, Cat1 **6**, PartNo **6**.
- **Important caveat:** unchanged-row elimination provides little/no benefit for October because every matched row changes in HSN and GST. Faster indexed matching alone has NOT been proven sufficient to resolve the two-minute publication timeout. Do not call this PR production-ready yet.
- Remaining required gate: isolated transaction test at realistic volume with actual schema/indexes, verifying execution time, atomic rollback, history correctness and concurrent read behavior. Do not test by publishing real production data.
- Check whether HSN/GST differences are intended before the October publication. Do not silently drop these fields to improve speed.

## Production-environment safe tests (2026-10-12)
- App CI #1974: **success**.
- Confirmed upload status remains `previewed`, staged rows **87,666**, active rows **85,152** and global timeout **2 minutes**.
- Bounded `EXPLAIN (ANALYZE, BUFFERS, TIMING OFF)` of read-only production October join/update-selection predicate in a `BEGIN READ ONLY` transaction with `SET LOCAL statement_timeout='20s'`: **1,454.527 ms**. Query plan used parallel hash join with a staging index scan and part-master sequential scan. This validates selection cost, **not the write path**.
- Temporary-table update test within an explicit transaction using 500 actual normalized-key matched samples, with `SET LOCAL statement_timeout='15s'`: **500 updated temporary rows**. `ROLLBACK` executed; no permanent business tables were changed.
- Production October upload was NOT published and RPC was NOT invoked. No migration applied.
- **Release gate unresolved:** full 85k-row production update, index maintenance, history insertion, locking and rollback behavior have not been benchmarked together. Neither a 1.45-second SELECT nor a 500-row TEMP update predicts whole-publication duration.

## User-approved monthly upload approach — 2026-10-12
- User accepts heavier once-monthly publication workload; chooses higher timeout and visible upload progress.
- SQL migration now sets **function-scoped** `statement_timeout = '10min'` for `portal_publish_part_master_upload(uuid)`. This does not change global role/database timeouts. Rollback explicitly resets the function timeout and restores original body.
- Frontend displays **actual completed/total staging rows and percentage** from successful chunk RPC acknowledgements. Publishing shows a separate atomic database phase with elapsed timer and indeterminate indicator. It deliberately does not invent an exact percentage for a one-transaction server-side publish. Completion is shown only after RPC acknowledgement.
- Supabase documentation supports function-scoped timeout configuration for REST API RPCs (https://supabase.com/docs/guides/database/postgres/timeouts). API gateways/client/proxy request durations may still have distinct limits; end-to-end 10-minute REST availability **not yet established**.
- Do not silently split publication into committed batches; doing so would change atomicity. True server-reported granular publish progress would require a different orchestration/reporting architecture.
- No migration applied, no merge/deploy, no October publication initiated.
