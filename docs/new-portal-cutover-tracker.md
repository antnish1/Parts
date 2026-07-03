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
- Order Detail comments with private staging attachment upload and signed download links

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
supabase functions deploy comment-attachment-upload-action
supabase functions deploy comment-attachment-link-action
```

## Staging migrations to confirm

- `010_add_test_comment_attachments_storage.sql` has been applied.
- Private bucket `test_order_comment_attachments` exists.
- Table `test_order_comment_attachments` exists.

## Final smoke test

1. Create a multi-item order.
2. Review item quantities in Approvals.
3. Approve the order.
4. Process it with a final order number.
5. Dispatch selected item rows.
6. Receive the dispatched rows.
7. Add one user comment on Order Detail.
8. Attach one small PDF or JPG to that comment.
9. Download that attachment using the signed link.
10. Upload one status report.
11. Upload one inventory file.
12. Check Track Orders, Manager Dashboard, Reports, and Developer Workspace.
13. Run `docs/comment-attachments-staging-smoke-test.md`.

## Cutover rule

Do not use live production table names until the full smoke test passes on `test_*` tables. After passing, the old root `index.html` should be treated as historical reference only.
