# New Portal Cutover Tracker

Use this tracker before stopping day-to-day use of the old root `index.html` workflow.

## Completed replacement areas

- Supabase Auth login and profile loading
- New Order through `create-order-action`
- Track Orders through paged `getOrderList()`
- Approvals through Edge Functions
- Admin process and selected item dispatch
- Docket Receive through `docket-receive-action`
- Status Report Upload through `status-report-action`
- Inventory Upload through `inventory-upload-action`
- Manager Dashboard with inventory lookup and exports
- Reports with paged orders
- Developer Workspace with paged orders and user tools

## Functions to deploy

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
```

## Final smoke test

1. Create a multi-item order.
2. Review item quantities in Approvals.
3. Approve the order.
4. Process it with a final order number.
5. Dispatch selected item rows.
6. Receive the dispatched rows.
7. Upload one status report.
8. Upload one inventory file.
9. Check Track Orders, Manager Dashboard, Reports, and Developer Workspace.

## Cutover rule

Do not use live production table names until the full smoke test passes on `test_*` tables. After passing, the old root `index.html` should be treated as historical reference only.
