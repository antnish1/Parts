# Edge Functions Deployment Checklist

Critical write operations in the React rebuild now go through Supabase Edge Functions. The browser should only call functions; server-side functions perform the protected database writes.

## Functions to deploy

Deploy these functions before staging testing:

```bash
supabase functions deploy create-portal-user
supabase functions deploy admin-order-action
supabase functions deploy approval-order-action
supabase functions deploy order-item-qty-action
supabase functions deploy docket-receive-action
supabase functions deploy inventory-upload-action
```

## Required function environment

Each function must have access to the Supabase project URL, anon key, and service role key from Supabase function secrets. The service role value must stay server-side only.

Do not place the service role value in Vercel, frontend environment files, browser code, or client logs.

## Frontend service mapping

| Frontend service | Edge Function | Purpose |
|---|---|---|
| `testProfile.service.ts` | `create-portal-user` | Create Auth user and matching staging profile |
| `testAdmin.service.ts` | `admin-order-action` | Admin process, reject, issue |
| `testApproval.service.ts` | `approval-order-action` | Approve, reject, forward to manager, manager approve/reject |
| `testApproval.service.ts` | `order-item-qty-action` | Set or reset edited item quantity |
| `testDocket.service.ts` | `docket-receive-action` | Receive item rows by docket or invoice |
| `inventoryUploadWriter.ts` | `inventory-upload-action` | Stage inventory, log changes, upsert current stock, save upload summary |

## Role checks

| Function | Allowed active roles |
|---|---|
| `create-portal-user` | `developer` |
| `admin-order-action` | `admin`, `developer` |
| `approval-order-action` | `super`, `manager`, `developer` |
| `order-item-qty-action` | `super`, `manager`, `developer` |
| `docket-receive-action` | `admin`, `developer` |
| `inventory-upload-action` | `admin`, `developer` |

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
- `test_inventory_current`
- `test_inventory_staging`
- `test_inventory_changes`
- `test_inventory_uploads`

## Smoke test sequence

1. Login as an active developer profile.
2. Create one staging order.
3. Approve it.
4. Process it with a final DBMS or SAP order number.
5. Issue it with invoice, docket, and transport.
6. Receive it from Docket Scanner.
7. Upload one small inventory Excel file.
8. Confirm Developer Workspace profile and comments tools still load.

## Production safety notes

- These functions are wired to staging tables until final cutover.
- Live production tables must remain untouched until migration approval.
- Function errors about authentication usually mean the user session or `auth_user_id` profile link is missing.
- Function errors about role access usually mean `role` or `is_active` in `test_profiles` needs correction.
