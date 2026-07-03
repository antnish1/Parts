# Release Readiness Checklist

Use this checklist before marking the React rebuild ready for production cutover. This checklist does not approve production SQL changes by itself.

## 1. Code readiness

- React app builds successfully.
- No TypeScript errors remain.
- Vercel root directory is set to `app`.
- Required frontend environment variables are set.
- No service-role key exists in frontend code or frontend environment.
- Legacy root `index.html` remains unchanged unless explicitly approved.
- Critical writes use Edge Functions, not direct browser table updates.

## 2. Database readiness

- All staging migrations have been applied.
- `test_profiles.auth_user_id` is populated for all login users.
- At least one active developer profile exists.
- Branch mapping is complete.
- Part master is loaded and searchable.
- Machine master lookup works.
- Order item dispatch fields exist.
- Inventory staging, change log, and upload audit tables exist.
- RLS policies have been reviewed.

## 3. Edge Function readiness

Deploy and test:

- `create-portal-user`
- `admin-order-action`
- `approval-order-action`
- `order-item-qty-action`
- `docket-receive-action`
- `inventory-upload-action`

Confirm each function:

- Rejects unauthenticated requests.
- Rejects inactive users.
- Enforces role checks.
- Writes only intended staging tables before cutover.
- Returns readable error messages.

## 4. Functional testing

### Branch user

- Can login.
- Can create order.
- Can upload bulk order Excel.
- Can track own orders.
- Can open order details.
- Cannot access admin-only actions.

### Super user

- Can approve pending orders.
- Can reject pending orders.
- Can forward pending orders to manager.
- Can edit item quantity where allowed.

### Manager user

- Can view dashboard.
- Can approve manager-pending orders.
- Can reject manager-pending orders.
- Can use inventory lookup.
- Can export report data.

### Admin user

- Can process approved orders.
- Can issue item rows with invoice, docket, and transport.
- Can reject approved orders where required.
- Can receive dockets.
- Can upload inventory file.

### Developer user

- Can create portal users.
- Can edit profile name, branch, and role.
- Can activate and deactivate profiles.
- Can view comments inbox.
- Can access diagnostic workspace.

## 5. Order lifecycle testing

Test one complete order with multiple item rows:

1. Branch creates order.
2. Super approves or forwards to manager.
3. Manager approves if forwarded.
4. Admin processes with final order number.
5. Admin issues item rows.
6. Docket scanner receives matching rows.
7. Order status becomes partially received or received correctly.
8. Order events show the full status trail.
9. Comments display correctly.
10. Reports include the order.

## 6. Inventory testing

- Upload valid inventory file.
- Confirm staging rows inserted.
- Confirm current inventory updated.
- Confirm change log entries created only for changed rows.
- Confirm upload summary is saved.
- Confirm manager inventory lookup shows updated stock.

## 7. Reports testing

- Track Orders filters work.
- Reports filters work.
- CSV export works.
- Excel export works.
- Status report upload updates item-level dispatch fields.
- Dashboard KPI counts match filtered orders.

## 8. Cutover prerequisites

- Production naming decision is approved.
- Production table mapping is approved.
- Backup plan is approved.
- Rollback plan is approved.
- Freeze window is scheduled.
- Business users know when the old portal will stop accepting writes.
- Final smoke test users are identified.

## 9. Go / no-go decision

Release is ready only when:

- All critical test cases pass.
- No blocker bugs remain.
- Edge Functions are deployed and verified.
- Backups are complete.
- Rollback path is confirmed.
- Business owner approves cutover.

## 10. Post-release monitoring

After release, monitor:

- Login failures.
- Edge Function errors.
- Failed order creations.
- Approval delays.
- Admin processing errors.
- Docket receive mismatches.
- Inventory upload errors.
- Report/export issues.

Keep the old portal or previous deployment available until production users confirm stable operation.
