# Parts Connect Portal — Handover

Date: 2026-07-06  
Repo: `antnish1/Parts`  
Frontend root: `app`  
Frontend hosting: Cloudflare Pages  
Backend: Supabase database + Supabase Edge Functions

Use this file to continue work in a new chat. It captures the final migration, portal cutover, Cloudflare move, and recent fixes.

---

## 1. Current state

The portal has been moved from old/test workflow tables to production `portal_*` tables.

Primary production tables:

```text
portal_profiles
portal_orders
portal_order_items
portal_order_item_billings
portal_order_events
portal_order_comments
portal_order_comment_attachments
portal_inventory_uploads
portal_inventory_staging
portal_inventory_current
portal_inventory_changes
```

Legacy data table remains:

```text
public.requests
```

Old/test tables may still exist for rollback/reference. Do not delete them yet:

```text
test_profiles
test_orders
test_order_items
test_order_item_billings
test_order_events
```

Backups also must not be deleted:

```text
migration_backup_20260706_pre_import
```

---

## 2. Cloudflare Pages deployment

Vercel hit usage limit, so the frontend was moved to Cloudflare Pages.

Correct Cloudflare settings:

```text
Production branch: main
Root directory / Path: app
Build command: npm run build
Build output directory: dist
Framework preset: Vite, or None if Vite is not available
Deploy command: blank
Node version: 20 or 22
```

Cloudflare frontend environment variables:

```text
VITE_SUPABASE_URL=<Supabase URL>
VITE_SUPABASE_ANON_KEY=<Supabase anon public key>
```

Do not put any server-only Supabase admin secret in Cloudflare Pages.

Files added for Cloudflare:

```text
app/public/_redirects
app/public/_headers
docs/cloudflare-pages-deployment.md
```

`app/public/_redirects` supports React Router refresh:

```text
/* /index.html 200
```

Old GitHub Pages URL redirects to Cloudflare through root `index.html` and `404.html`.

Redirect target used:

```text
https://parts-3s6.pages.dev
```

Old URL:

```text
https://antnish1.github.io/Parts/
```

---

## 3. Supabase Edge Functions

Cloudflare deploys only the frontend. Backend functions must be deployed separately from Supabase.

Common deploy commands:

```bash
supabase functions deploy create-order-action
supabase functions deploy approval-order-action
supabase functions deploy approval-qty-review-action
supabase functions deploy order-item-qty-action
supabase functions deploy status-report-action
supabase functions deploy docket-receive-action
supabase functions deploy inventory-upload-action
supabase functions deploy comment-attachment-upload-action
supabase functions deploy comment-attachment-link-action
supabase functions deploy create-portal-user
supabase functions deploy update-portal-user
supabase functions deploy admin-order-action
```

Edge Functions need Supabase URL, anon key, and the server-only admin secret configured in Supabase Function secrets.

---

## 4. Final migration scripts

Known final migration scripts:

```text
supabase/final_migration_scripts/000_backup_before_legacy_import.sql
supabase/final_migration_scripts/001_create_portal_production_schema.sql
supabase/final_migration_scripts/002_migrate_legacy_requests_to_portal.sql
supabase/final_migration_scripts/003_post_migration_reconciliation_checks.sql
supabase/final_migration_scripts/005_fix_excel_serial_dates_after_import.sql
supabase/final_migration_scripts/006_fix_dot_format_order_reg_dates.sql
supabase/final_migration_scripts/007_copy_test_profiles_to_portal_profiles.sql
supabase/final_migration_scripts/008_portal_cutover_compatibility_columns.sql
supabase/final_migration_scripts/009_portal_performance_indexes.sql
supabase/final_migration_scripts/010_order_tracking_totals.sql
```

There is no confirmed `004_cutover_readiness_checks.sql` file.

Important scripts:

- `008` adds compatibility columns including `portal_orders.order_reg_date` and inventory staging fields.
- `009` adds performance indexes.
- `010` adds and backfills `portal_orders.total_qty`, `portal_orders.total_value`, and `portal_orders.comment_count`, with triggers to keep them updated.

If Track Orders Qty/Value show `0`, confirm script `010_order_tracking_totals.sql` has been run.

---

## 5. Migration reconciliation status

Migration passed these checks:

```text
legacy_request_rows = 3567
imported_item_rows = 3567
legacy_order_count = 622
imported_order_count = 622
imported_billing_chunks = 1878
```

Billing totals:

```text
billing_chunk_count = 1878
total_billed_qty = 30272.00
total_received_qty = 22651.00
difference = 7621 qty billed/dispatched but not received
```

Date fixes:

- Excel serial dates fixed by script 005.
- DD.MM.YYYY dates fixed by script 006.
- `remaining_dot_format_order_reg_dates = 0`.

Portal order status distribution after import:

```text
received             244
partially_received   104
pending_approval      75
rejected              63
dispatched            49
processed             36
issued                33
partially_dispatched  18
```

Portal item status distribution after import:

```text
received             1413
pending_approval      805
processed             483
rejected              454
dispatched            313
issued                 52
partially_dispatched   47
```

Profile copy check passed:

```text
test_profiles = 8
portal_profiles_after = 8
```

---

## 6. Business rules

Status meanings:

```text
received = part received into our store
issued = part issued to customer after receiving; later/closed stage
rejected = closed
```

Do not treat `issued` as `received`. It is later than received.

Open/in-transit calculations must exclude:

```text
received
issued
rejected
```

Full billed qty means `dispatched`, not `issued`.

Docket receive is billing-chunk based:

- One docket can include rows from multiple orders.
- Docket scan searches by docket only.
- Receiving a row updates only the matching billing chunk.
- Item becomes `partially_received` until received qty reaches ordered/effective qty.
- Blank docket and docket `0` are invalid placeholders and should be ignored.

Known docket examples:

```text
501546374571: 60 rows, billed 1326.00, received 737.00, partial
501546419821: 31 rows, billed 410.00, received 410.00, full
225051275: 14 rows, billed 492.00, received 0.00, not received
0: placeholder; ignore
```

---

## 7. Role/workflow summary

Roles:

```text
branch
super
manager
admin
viewer
developer
```

Branch users create/track own branch orders. Super users approve assigned orders. Manager users give final approval. Admin users process approved orders with final DBMS order number. Developer can manage users and perform technical/admin tasks.

Workflow:

1. Branch creates order.
2. If approver is super, status starts `pending_approval`.
3. Super approval sends to `pending_manager_approval`.
4. Manager approval sends to `approved`.
5. Admin processes approved order to `processed` with final order number.
6. Status upload creates billing chunks and moves item/order to dispatched/partially dispatched.
7. Docket receive updates billing chunks and moves item/order to partially received/received.
8. Issued is a later customer issue stage and should remain closed.

---

## 8. Important recent fixes

### Track Orders

Fixed issues:

- Slow loading after portal cutover.
- Only 200 orders showing; limit increased to 1000.
- Continuous “Scanning Orders” section removed.
- Customer column removed because it duplicated Order For.
- First column changed to Date & Time.
- Action/View column removed; clicking the row opens order detail.
- Qty/Value now intended to read from `portal_orders.total_qty` / `total_value`.

Files involved:

```text
app/src/features/tracking/TrackOrdersPage.tsx
app/src/services/orderList.service.ts
app/src/services/testTrackingMeta.service.ts
app/scripts/apply-track-order-total-columns.cjs
supabase/final_migration_scripts/010_order_tracking_totals.sql
```

### Order Detail

Fixed issues:

- Order For should show `Stock` / `Customer`, not customer name.
- Employee should read legacy/profile values.
- Approved By should read legacy/profile values.

Files/scripts involved:

```text
app/src/features/orders/OrderDetailPage.tsx
app/src/services/testOrderView.service.ts
app/scripts/order-summary-fields.cjs
```

### Admin order processing

Issue: Admin could not process orders because `admin-order-action` was still using old `test_` tables and filtering `TEST-%` orders.

Fixed function:

```text
supabase/functions/admin-order-action/index.ts
```

It now uses:

```text
portal_profiles
portal_orders
portal_order_items
portal_order_events
```

Deploy required:

```bash
supabase functions deploy admin-order-action
```

### Branch user login profile

Issue: new branch user `KATNI1` logged in as viewer/unassigned and showed email instead of name.

Cause: frontend profile lookup still fell back instead of resolving the `portal_profiles` row.

Fixed files:

```text
app/src/auth/useAuth.ts
app/src/services/branchScope.service.ts
```

Verified database row:

```text
full_name: UMA SHANKAR MEHTA
branch: KATNI
role: branch
is_active: true
legacy_user_id: KATNI1
auth_user_id: d7f24b0a-24fc-463c-bce4-4c1484850534
email: katni1@portal.local
```

After deployment, user must logout, hard refresh, and login again.

---

## 9. Key code files

Frontend:

```text
app/src/auth/useAuth.ts
app/src/auth/LoginPage.tsx
app/src/auth/roleGuards.ts
app/src/routes/AppRouter.tsx
app/src/services/branchScope.service.ts
app/src/services/orderList.service.ts
app/src/services/orderStatusMap.service.ts
app/src/services/testData.service.ts
app/src/services/testOrderView.service.ts
app/src/services/testDocket.service.ts
app/src/services/testTrackingMeta.service.ts
app/src/services/testProfile.service.ts
app/src/services/testAdmin.service.ts
app/src/services/managerInventory.service.ts
app/src/features/tracking/TrackOrdersPage.tsx
app/src/features/orders/OrderDetailPage.tsx
app/src/features/approvals/ApprovalsPage.tsx
app/src/features/admin/AdminPage.tsx
```

Backend functions:

```text
supabase/functions/create-order-action/index.ts
supabase/functions/approval-order-action/index.ts
supabase/functions/approval-qty-review-action/index.ts
supabase/functions/order-item-qty-action/index.ts
supabase/functions/status-report-action/index.ts
supabase/functions/docket-receive-action/index.ts
supabase/functions/inventory-upload-action/index.ts
supabase/functions/comment-attachment-upload-action/index.ts
supabase/functions/comment-attachment-link-action/index.ts
supabase/functions/create-portal-user/index.ts
supabase/functions/update-portal-user/index.ts
supabase/functions/admin-order-action/index.ts
```

---

## 10. Build-time patch scripts caution

`app/package.json` runs several scripts in `predev` and `prebuild`. These can modify source during Cloudflare build.

Known scripts include:

```text
apply-approval-review-page.cjs
apply-order-detail-table-patch.cjs
remove-order-totals.cjs
apply-docket-portal-tables.cjs
apply-approval-performance-patch.cjs
apply-order-detail-performance-patch.cjs
order-summary-fields.cjs
apply-track-order-total-columns.cjs
```

If a source change does not appear after deployment, check whether one of these scripts overwrote it.

Long-term improvement: apply patches permanently and delete redundant patch scripts.

---

## 11. Known remaining technical debt

Some user-management code may still reference `test_profiles`.

Known caution areas:

```text
app/src/services/testProfile.service.ts
supabase/functions/update-portal-user/index.ts
```

A tool attempt to update these during this chat was blocked, so inspect and fix manually if Developer Workspace user edit/list behavior still points to old profiles.

Search for remaining production references:

```text
test_profiles
test_orders
test_order_items
test_order_item_billings
test_order_events
```

Only docs, migrations, seeds, and backups should keep old references. Production app and Edge Functions should use `portal_` tables.

---

## 12. Smoke test checklist

After any deploy, test:

1. Login as developer.
2. Login as branch user `KATNI1`.
3. Sidebar shows actual name, branch, and role.
4. Track Orders shows 622 imported orders plus new orders.
5. Track Orders Qty/Value show non-zero after script 010.
6. Clicking Track Orders row opens order detail.
7. Order Detail summary shows Stock/Customer, Employee, Approved By.
8. Manager approval page loads quickly.
9. Admin can process an approved order.
10. Docket Scan searches by docket and shows row-wise chunks.
11. Status upload updates billing chunks/status.
12. Inventory upload writes to `portal_inventory_*`.
13. Comment and attachment flow works.
14. Refreshing `/orders/:id` on Cloudflare does not 404.
15. Old GitHub Pages URL redirects to Cloudflare.

---

## 13. Important commits

Important known commits from this migration/cutover period:

```text
0b7cebb88931117a0c07d49e54fae568589a2e5e - added direct DD.MM.YYYY fix script
218cf0c4b27e3f38729ddf5dd8d77f2c3ffb2fd3 - restored full status-report workflow on portal tables
10929f309b0a93e95d3d08f1a9585851f1afbef6 - performance deploy trigger
4a9df0c5d86b45e5cb4eaca4f09340029f0747c4 - order detail summary fields deploy
44e5e0ce167907a6cef56bc0aacbee35e94d7050 - track order totals deploy
ba4289323a64db161bfb2e097dbc66224c582fe2 - Cloudflare redirects
556930144bbabba54ba5339dd83e8f607327017f - Cloudflare headers
dd76c729f0cd8121d4557c3e0f94f4f4ff442eda - Cloudflare deployment docs
d11fac47c858aa6662ddc26e7de94fa3a7bdd0b3 - GitHub Pages redirect index
93bf0ad85e83eb8471facb6ec7313d4198854390 - GitHub Pages redirect 404
3a5bfd1813b6fe1769927a415361d763f8d4df9c - create-portal-user switched to portal_profiles
dc1802481ebd3798dc645776d2fd021aa7845f42 - admin-order-action switched to portal tables
05520a2c43669b86639ee32e4dbececf4c1d3809 - auth lookup uses portal_profiles
f79ee6c462d52afe01a21bd402de24550142d03e - branch scope portal login fallback
3e7629d9919966876dff3e539480159255441202 - deploy marker for login profile lookup
```

---

## 14. Instruction for the next chat

Start the next chat with:

```text
Please read docs/HANDOVER_2026-07-06_PORTAL_CUTOVER_AND_CLOUDFLARE.md in repo antnish1/Parts. Continue from the current portal cutover state. The app is on Cloudflare Pages, Supabase is backend, production tables are portal_*, and remaining priority is to finish any user-management references to test_profiles and continue improvements safely.
```
