# Legacy index.html vs React Rebuild Gap Audit

Date: 2026-07-03

This document compares the legacy single-file `index.html` behavior against the current React rebuild. The purpose is to identify the remaining functional gaps before production cutover.

## Audit basis

Legacy reference:

- `index.html`
- `docs/legacy-index-function-logic-map.md`

Current React rebuild reference:

- `app/src/routes/AppRouter.tsx`
- `app/src/features/orders/NewOrderPage.tsx`
- `app/src/features/orders/OrderDetailPage.tsx`
- `app/src/features/tracking/TrackOrdersPage.tsx`
- `app/src/features/approvals/ApprovalsPage.tsx`
- `app/src/features/admin/AdminPage.tsx`
- `app/src/features/manager/ManagerDashboardPage.tsx`
- `app/src/features/inventory/InventoryUploadPage.tsx`
- `app/src/features/reports/ReportsPage.tsx`
- `app/src/features/docket/DocketScannerPage.tsx`
- `app/src/features/developer/DeveloperWorkspacePage.tsx`
- related services and Edge Functions

## Executive summary

The React rebuild now covers most major modules: login, order creation, tracking, order detail, approvals, admin processing, manager dashboard, inventory upload, reports, docket receive, and developer workspace. Critical writes have also been moved to Edge Functions for the main workflows.

However, legacy `index.html` still has several deeper behaviors not fully matched yet:

1. Order creation is still direct browser insert and not yet Edge Function/RPC protected.
2. Status report upload still writes from browser service and is not yet Edge Function protected.
3. Comments still do not support attachments and comment seen/unseen behavior.
4. Approval quantity workflow is incomplete: no accept-edits, approve-with-original, remove-row audit flow, or previous-quantity suggestion logic.
5. Admin issue is still bulk issue for all item rows, not selected item/partial issue workflow.
6. Manager inventory lookup does not yet match latest report date logic or branch transaction view.
7. Inventory upload has no progress/cancel UI and does not clear staging like legacy.
8. Universal search/debug/offline utilities are not fully rebuilt.
9. Production table naming and SQL cutover are still pending approval.

## Legacy function groups and current status

| Legacy area | Legacy functions/working | Current React status | Gap to address |
|---|---|---|---|
| Loader/popup | `showLoader`, `hideLoader`, `showPopup`, `closePopup`, order summary popup | Page-level messages and order summary exist | Need shared toast/modal, loader failsafe, reusable action popups |
| Debug tools | `PartsDebug`, debug snapshot, online/offline/error logging | Not rebuilt as full utility | Add `?debug=1`, local debug log, route/auth/query snapshot |
| Login/session | Branch/password from `users` in browser | Replaced with Supabase Auth and `test_profiles.auth_user_id` | Better default landing per role and route guard tightening |
| Routing/nav | Role-specific landing and menu visibility | Routes exist for all modules | Current index redirects to New Order for all; should land by role |
| New Order | VOR/SOP/ZMAC/ZSPL/LUBES validations, approver, machine, customer, part rows | Strong scaffold exists with validations, bulk upload, machine lookup/save, 30D qty | Move create order to Edge Function/RPC; add duplicate/recent order warnings; align temp order format if required |
| Part master | Normalize part no, lookup, DNP/category, 30D usage | Part lookup and 30D service exist | Need category display and stronger duplicate/recent order warning UX |
| Machine/customer | Lookup machine; manual customer save if missing | Lookup/save exists inline | Need modal/popup UX and permission-protected backend write |
| Bulk parts upload | Header choice, duplicate merge, progress, cancel | Header checkbox and duplicate merge exist | Missing progress panel, cancel, preview before apply |
| Track Orders | Loads all pages, groups rows, search, date/status filters, pagination, sort, comment count | Search/date/status/pagination/sort/comment count exist | `getTestOrders` currently limits to 50; needs paginated/full dataset loading and branch/role filtering |
| Status logic | Normalizes many status variants, effective qty/value, printable labels | Shared `orderLogic` exists and item-row derived status exists | Need old spelling/variant compatibility checked for production/imports |
| Order detail | Metadata, items, previous qty, inventory, billed/pending, comments/logs, print/export/actions | Detail page exists with metadata, inventory, billed/pending, comments, events, print, actions | Missing previous quantity selector, order-level Excel download, attachment comments, hide/show logs |
| Approval workflow | Approve/reject/forward, manager approval, edit qty, accept edits, approve original, remove rows, change approver | Approve/reject/forward/manager actions and edit/reset qty exist via Edge Functions | Missing accept edited qty, approve original qty, remove row audit, auto suggestion from previous qty, change approver |
| Admin processing | Approved queue, processed queue, final order no duplicate check, reject, issue | Admin page exists and uses Edge Function for process/reject/issue | Issue is bulk all item rows; need item-level selected issue, partial dispatch, per-row billed qty |
| Docket scanner | BarcodeDetector, camera cleanup, manual lookup, receive row, audit | Camera scanner, manual lookup, receive matching rows via Edge Function exist | Access currently admin/developer in Edge Function; legacy allowed branch access. Decide final role rule |
| Status report upload | XLSX mapping, careful received locks, updated/skipped/failed, status logs | Reports page parses/applies status report | Move writes to Edge Function; add lock rules verification; add upload progress/cancel |
| Inventory upload | Report date, broad column mapping, clear staging, batch insert, current upsert, change log | Inventory upload parses, calls Edge Function, stages/logs/upserts | Need progress/cancel, clear-staging policy decision, branch mapping fallback verification, received/issued transaction fields display |
| Manager dashboard | Date/branch/card filters, drilldown, Excel export, branch/status/value/qty summaries | Dashboard has date/branch/status filters, cards, filtered table, CSV, inventory lookup | Need Excel export, table toggle, latest-date inventory lookup, branch transaction rows, branch directory mapping |
| Developer workspace | Dashboard, users, requests editor, comments inbox, inventory, reports, docket, new/track | Workspace has diagnostics, create user, edit/deactivate profiles, comments inbox, quick nav | Missing requests editor and developer inventory lookup parity; comments seen/unseen tracking missing |
| Comments/logs | JSON comments with system/user distinction, attachment base64, duplicate removal, comment count | Normalized comments/events exist; detail and inbox load them | Missing attachments, duplicate prevention, seen/unseen, comment count only user comments check |
| Print/export | Print order, order Excel, manager filtered Excel | Print exists; reports Excel exists; manager CSV exists | Add order Excel export and manager Excel export |
| Mobile behavior | MutationObserver wraps tables and fixes mobile scroll | Tables use min-width/overflow containers in pages | Need final mobile QA across all pages |

## High-priority differences to address next

### 1. Move Create Order to Edge Function

Legacy inserts directly into `requests`, but production rebuild should not insert order headers/items/events directly from the browser. Current `createTestOrder` still inserts `test_orders`, `test_order_items`, and `test_order_events` from the frontend service. This should become an Edge Function/RPC before production.

Required behavior:

- Validate role/branch server-side.
- Generate temporary order number server-side.
- Insert header, items, and event atomically where possible.
- Enforce VOR/customer/stock rules server-side.
- Prevent duplicate empty/invalid part rows server-side.

### 2. Move Status Report Upload Writes to Edge Function

Current report upload parses and applies rows in frontend service. Legacy status report upload has careful update/skipped/failed behavior and status locking. This needs server-side protection.

Required behavior:

- Parse can remain client-side initially.
- Apply rows server-side.
- Protect received/locked rows.
- Log status events once per touched order.
- Return total/updated/skipped/failed/errors.

### 3. Complete Approval Review Workflow

Current approval has edit/reset qty. Legacy workflow has deeper review controls.

Required behavior:

- Auto-suggest edited qty from previous 30-day usage.
- Accept edited quantities with audit event.
- Approve with original quantities and clear edits.
- Remove row for review by edited qty/value zero with audit event.
- Change approver modal.

### 4. Complete Item-Level Dispatch

Current admin issue still issues all non-received rows together. Legacy was order-row based, but the new requirement is item-level invoice/docket/received. The rebuild should finish this properly.

Required behavior:

- Select item rows to issue.
- Enter invoice/docket/transport per selected row or per batch.
- Support partial dispatch/partial received cleanly.
- Capture billed quantity per item row.
- Recalculate order status from item rows.

### 5. Restore Full Manager Inventory Lookup Behavior

Legacy manager inventory lookup uses latest report date, branch directory, branch display mapping, and branch transaction rows.

Required behavior:

- Load branch directory from branch mapping.
- Use latest report date by default.
- Show received/issued/closing balance/value columns.
- Add branch/date transaction view where received or issued is non-zero.
- Add Excel export.

### 6. Improve Upload UX

Legacy has upload progress, cancellation, metadata badge, and error summaries. Current upload pages are functional but not equal.

Required behavior:

- Progress card for status/inventory uploads.
- Cancel flag or abort controller where possible.
- Preview/validation before final apply.
- Upload metadata badge/history.

### 7. Complete Comments Parity

Current comments are normalized and safer, but legacy supported attachments and special inbox behavior.

Required behavior:

- Supabase Storage attachment upload.
- User comment count excludes system events.
- Duplicate comment prevention.
- Developer seen/unseen marker.
- Hide/show system action logs in order detail.

### 8. Full Dataset Loading and Role Filtering

Current `getTestOrders` limits orders to 50. Legacy loads all records in pages of 1000 and filters by role/branch.

Required behavior:

- Paginated Supabase loading or server-side filtered paging.
- Branch users see own branch only.
- Viewer track-only access.
- Admin/super/manager/developer access rules enforced by RLS/Edge Functions.

## Suggested next implementation sequence

1. Create `create-order-action` Edge Function and wire `createTestOrder` to it.
2. Create `status-report-action` Edge Function and wire Reports upload to it.
3. Replace admin issue-all with item-row selected issue workflow.
4. Add approval accept-edits / original-qty / remove-row / change-approver workflows.
5. Upgrade manager inventory lookup to latest-date + branch transaction view + Excel export.
6. Add upload progress/cancel/metadata badge.
7. Add comment attachments and seen/unseen developer inbox behavior.
8. Replace `getTestOrders` limit 50 with paginated/role-aware query.
9. Add debug utility and role-based default landing.

## Production decision needed

Before touching live production tables, choose production naming:

1. Reuse existing legacy names where compatible.
2. Archive legacy tables and reuse clean names.
3. Use new versioned names such as `portal_orders`, `portal_order_items`, and related tables.

No production SQL should be written until that decision is approved.
