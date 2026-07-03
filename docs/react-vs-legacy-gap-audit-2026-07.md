# React rebuild vs legacy index.html gap audit

This audit compares the current React rebuild with the legacy `index.html` workflow reference. The React rebuild has the core structure, but several legacy business behaviors are still missing or only partially implemented.

## Completed or mostly completed

- Supabase Auth login with profile-based roles.
- Role-based app shell and navigation.
- New Order multi-item flow.
- Order Type / Order For validation basics.
- Part lookup and duplicate part protection.
- 30-day quantity display foundation.
- Machine lookup and manual save foundation.
- New Order bulk parts upload foundation.
- Order placed summary.
- Track Orders with search, filters, status cards, pagination and order detail link.
- Shared Order Detail page with summary, item rows, inventory coverage, comments and logs.
- Approval page with approve/reject and item quantity edit/reset foundation.
- Admin process/reject/issue foundation.
- Docket lookup/receive and camera scanner foundation.
- Inventory lookup and Excel upload foundation.
- Manager dashboard with date filters, KPI drilldown and CSV export foundation.
- Developer workspace with user creation through secure Edge Function.
- Print foundation for Order Detail.
- Item-level invoice/docket/transport/received fields added to `test_order_items`.

## High-priority missing or incomplete items

### 1. Row-level dispatch/receipt workflow is not fully wired

Schema and Order Detail display now support item-level fields, but Admin and Docket workflows still need to write these fields per item row.

Required:
- Admin issue screen must allow invoice no/date per part row, not just once for whole order.
- Docket receive screen must mark one or more item rows as received, not only order-level received.
- Status calculation must derive order status from item rows: Processed, Partially Dispatched, Issued, Partially Received, Received.
- Track Orders and Manager Dashboard must calculate status from item-level row data.

### 2. Status report upload is missing

Legacy upload can process DBMS/status reports and update existing order rows by order number and material/part.

Required:
- Upload Status Report page or tab.
- Excel parser for DBMS report.
- Map final order no, part/material, status, billed quantity, invoice no/date, docket, transport.
- Update matching `test_order_items` rows.
- Keep update/skip/error summary.
- Log status changes.

### 3. Approval workflow is still incomplete

Current React approval supports item review/edit quantity, but legacy has deeper workflow.

Required:
- Forward to manager.
- Pending Manager Approval queue.
- Manager approve/reject finalization.
- Accept edited quantities.
- Approve with original quantities.
- Remove row from approval by setting edited qty/value to zero.
- Change approver modal.
- Complete event logs: SUPER_FORWARDED_MANAGER, MANAGER_APPROVED, MANAGER_REJECTED, SUPER_ACCEPTED_EDITS, SUPER_RESET_TO_ORIGINAL, SUPER_REMOVED_ROW, APPROVER_CHANGED.

### 4. Order Detail toolbar is incomplete

Required:
- Role/status-based action toolbar.
- Edit quantities from Order Detail for approval users.
- Previous quantity days selector, not only default 30 days.
- Show/hide action logs.
- Order Excel download.
- Better printable order format with row-level dispatch fields.

### 5. Inventory upload is incomplete compared with legacy

Current upload parses basic columns and upserts current inventory. Legacy did more.

Required:
- Inventory staging table workflow.
- Clear staging before upload.
- Batch insert with progress/cancel.
- Full column compatibility: branch, code, item, group, BHLHLN, REC, NSP, UOM, DNP, opening balance/value, received, issued, closing balance/value.
- Branch-code fallback from branch mapping.
- Inventory change records when quantity differs.
- Upload history and error samples.
- Manager inventory lookup from latest report date.
- Branch transaction view for received/issued rows.

### 6. Manager dashboard is still below legacy capability

Current dashboard has KPI foundation but legacy has deeper drilldown.

Required:
- Branch filter.
- Toggle detailed filtered table.
- Export to Excel, not only CSV.
- Manager inventory lookup tab.
- Branch transaction view.
- Latest inventory date handling.
- Quantity/value/status calculations from item-level rows.

### 7. Developer workspace is still partial

Current workspace has diagnostics and user creation, but legacy developer area has more.

Required:
- Users list with edit/deactivate/reset role/profile.
- Requests/order inspector.
- Comments inbox with seen/unseen logic.
- Inventory lookup panel.
- Upload/report tools access.
- Debug snapshot and local diagnostic logs.

### 8. Comments and attachments are incomplete

Required:
- Attachment upload using Supabase Storage.
- Comment inbox for developer.
- Comment count should include only user comments.
- Action logs should be collapsible and styled by event type.

### 9. Universal search and data loading are incomplete

Legacy loads all rows in pages and keeps a global dataset for universal search.

Required:
- Server-side paginated order loading.
- Universal search across order no, final order no, part no, customer, machine, branch, type, status.
- Sort headers consistently across Track, Admin, Approval, Manager.

### 10. Production backend protections are still needed

Before live cutover, direct frontend writes should be moved to RPC or Edge Functions for key transitions.

Required secure functions:
- create_order
- approve_order
- forward_to_manager
- manager_approve_order
- manager_reject_order
- save_edited_quantity
- accept_edited_quantities
- reset_edited_quantities
- remove_order_item_for_review
- process_order
- reject_order
- mark_item_issued
- mark_item_received
- upload_status_report_batch
- upload_inventory_batch
- add_order_comment

## Recommended next implementation sequence

1. Complete item-level issue/receive workflow.
2. Update status calculation to derive order status from item rows.
3. Add status report upload to update item rows.
4. Complete approval manager-forward/edit workflow.
5. Complete inventory staging/change/progress workflow.
6. Upgrade manager inventory lookup and branch transaction view.
7. Add Order Excel export and stronger print template.
8. Add developer comments inbox and user management edit/deactivate.
9. Add backend RPC/Edge Function protections before production cutover.

## Current conclusion

The React rebuild is not yet a full replacement for the legacy `index.html`. It is now a strong staging foundation, but the most important missing business area is row-level order lifecycle: invoice, docket, transport, received date, status and quantities must be handled per item row and all dashboards/reports must calculate from those item rows.
