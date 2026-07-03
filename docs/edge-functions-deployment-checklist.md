# Edge Functions Deployment Checklist

Critical write operations in the React rebuild now go through Supabase Edge Functions. The browser should only call functions; server-side functions perform the protected database writes.

## Functions to deploy

Deploy these functions before staging testing:

```bash
supabase functions deploy create-portal-user
supabase functions deploy create-order-action
supabase functions deploy admin-order-action
supabase functions deploy admin-item-issue-action
supabase functions deploy approval-order-action
supabase functions deploy approval-qty-review-action
supabase functions deploy order-item-qty-action
supabase functions deploy status-report-action
supabase functions deploy docket-receive-action
supabase functions deploy inventory-upload-action
supabase functions deploy comment-attachment-upload-action
supabase functions deploy comment-attachment-link-action
```

## Required function environment

Each function must have access to the Supabase project URL, anon key, and service role key from Supabase function secrets. The service role value must stay server-side only.

Do not place the service role value in Vercel, frontend environment files, browser code, or client logs.

## Frontend service mapping

| Frontend service | Edge Function | Purpose |
|---|---|---|
| `testProfile.service.ts` | `create-portal-user` | Create Auth user and matching staging profile |
| `testData.service.ts` | `create-order-action` | Create new staging order and item rows |
| `testAdmin.service.ts` | `admin-order-action` | Admin process, reject, legacy issue action |
| `testDispatch.service.ts` | `admin-item-issue-action` | Dispatch selected item rows with invoice, docket, and transport |
| `testApproval.service.ts` | `approval-order-action` | Approve, reject, forward to manager, manager approve/reject |
| `testApproval.service.ts` | `approval-qty-review-action` | Accept edited quantities, approve original quantities, set review quantity to zero |
| `testApproval.service.ts` | `order-item-qty-action` | Set or reset edited item quantity |
| `statusReport.service.ts` | `status-report-action` | Apply DBMS status report rows server-side |
| `testDocket.service.ts` | `docket-receive-action` | Receive item rows by docket or invoice |
| `inventoryUploadWriter.ts` | `inventory-upload-action` | Stage inventory, log changes, upsert current stock, save upload summary |
| `commentAttachment.service.ts` | `comment-attachment-upload-action` | Upload one comment attachment to private staging storage |
| `commentAttachment.service.ts` | `comment-attachment-link-action` | Generate a short-lived signed download URL |

## Role checks

| Function | Allowed active roles |
|---|---|
| `create-portal-user` | `developer` |
| `create-order-action` | `branch`, `admin`, `super`, `manager`, `developer` |
| `admin-order-action` | `admin`, `developer` |
| `admin-item-issue-action` | `admin`, `developer` |
| `approval-order-action` | `super`, `manager`, `developer` |
| `approval-qty-review-action` | `super`, `manager`, `developer` |
| `order-item-qty-action` | `super`, `manager`, `developer` |
| `status-report-action` | `admin`, `developer` |
| `docket-receive-action` | `admin`, `developer` |
| `inventory-upload-action` | `admin`, `developer` |
| `comment-attachment-upload-action` | `branch`, `super`, `admin`, `manager`, `developer` |
| `comment-attachment-link-action` | `branch`, `super`, `admin`, `manager`, `viewer`, `developer` with order access |

Each function checks that the logged-in user has an active row in `test_profiles` linked through `auth_user_id`.

## Required staging database objects

Confirm these exist before testing:

- `test_profiles.auth_user_id`
- `test_orders`
- `test_order_items.row_status`
- `test_order_items.dbms_invoice_no`
- `test_order_items.dbms_invoice_date`
- `test_order_items.docket_no`
- `test_order_items.transport_name`
- `test_order_items.received_date`
- `test_order_events`
- `test_order_comments`
- `test_order_comment_attachments`
- Private Storage bucket `test_order_comment_attachments`
- `test_inventory_current`
- `test_inventory_staging`
- `test_inventory_changes`
- `test_inventory_uploads`

## Smoke test sequence

1. Login as an active developer profile.
2. Create one staging order from New Order.
3. Review edited quantities in Approvals.
4. Approve it or forward it to manager.
5. Process it with a final DBMS or SAP order number.
6. Dispatch selected item rows with invoice, docket, and transport.
7. Receive the dispatched item rows from Docket Scanner.
8. Upload one small DBMS status report.
9. Upload one small inventory Excel file.
10. Add a comment on Order Detail.
11. Attach one small PDF or JPG to the comment.
12. Download the attachment using the generated signed URL.
13. Confirm Developer Workspace profile and comments tools still load.

## Production safety notes

- These functions are wired to staging tables until final cutover.
- Live production tables must remain untouched until migration approval.
- Comment attachments currently use the private staging bucket `test_order_comment_attachments`.
- Function errors about authentication usually mean the user session or `auth_user_id` profile link is missing.
- Function errors about role access usually mean `role` or `is_active` in `test_profiles` needs correction.
- After deploying new functions, run the smoke test before connecting the workflow to any production table names.
