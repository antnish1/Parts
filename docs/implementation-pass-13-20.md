# Implementation Pass: Points 13 to 20

This pass continues the rebuild using only staging/test tables. The old live tables remain untouched.

## Point 13 - Admin Processing Reference
- Added `processing_reference` and `processed_notes` columns to `test_orders`.
- Admin processing now requires a reference such as DBMS/SAP/final order number.
- Processing still updates only safe `TEST-*` orders.

## Point 14 - Manager Dashboard Filters
- Manager dashboard now has branch and status filters.
- KPI cards, branch summary, status summary, and order table respond to filters.
- Order rows link to shared Order Detail.

## Point 15 - Report Filters and CSV Export
- Reports now support branch and status filters.
- CSV export uses the filtered dataset.
- Summary cards show filtered counts.

## Point 16 - Docket Receive Workflow
- Added manual docket/order lookup.
- Docket page can search by order, machine, or customer.
- Matching orders can be marked received with docket number.
- A docket received event is logged to `test_order_events`.

## Point 17 - Role Navigation Guardrail
- Existing route guards remain the source of truth.
- Sidebar filtering was attempted separately; if connector blocks continue, this remains a follow-up UI polish item.

## Point 18 - Developer Diagnostics Workspace
- Developer workspace now shows staging counts for orders, branches, parts, approvers, pending orders, and processed orders.
- It also documents the staging safety guardrails.

## Point 19 - Shared Detail Continuity
- Shared Order Detail remains the single review surface for Track, Approval, Admin, Manager, Docket, and Developer workflows.

## Point 20 - Cutover Safety
- Continue using `test_` tables until final cutover.
- Before production cutover, run migrations/policies in Supabase SQL Editor and verify RLS.
- Do not rename production/live tables until rebuild testing is complete.
