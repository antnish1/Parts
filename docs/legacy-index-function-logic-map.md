# Legacy `index.html` function and logic map

This document records the functional behavior inside the legacy single-file `index.html` and converts it into a React rebuild checklist.

The legacy file remains the behavior reference until every item below is rebuilt, tested, and protected with proper Supabase Auth, RLS, RPC, or Edge Function checks.

## Important safety note

The legacy file directly connects to the live Supabase project and directly reads/writes live tables from the browser. The new React rebuild must not copy that pattern.

For the rebuild:

- Do not hardcode Supabase keys inside UI code beyond public anon key env usage.
- Do not compare passwords in frontend code.
- Do not directly write sensitive workflow transitions from page components.
- Use service functions first, then Supabase RPC or Edge Functions for production workflow enforcement.
- Continue using `test_` tables until production cutover is explicitly approved.

## Main legacy tables used

### Live operational tables

- `requests`
- `users`
- `part_master`
- `machine_master`
- `branch_mapping`
- `inventory_staging`
- `inventory_current`
- `inventory_changes`

### Important `requests` fields

The legacy app repeatedly reads these request/order fields:

```txt
id
OrderNo
created_at
OrderType
OrderFor
Branch
EmployeeName
ApprovedBy
ApprovedBySuper
ApprovedAt
ApprovalStatus
Status
CustomerName
MachineNo
WarrantyStatus
CallID
PartNo
Description
Qty
30dQty
DNP
Value
editedqty
editedvalue
BilledQty
ProcessedDate
OrderComments
receivedDate
DBMSinvoiceNo
DBMSinvoiceDate
OrderRegDt
BillNo
BillingDt
TransportName
Docket
```

## Global runtime state in legacy file

The legacy app uses global browser state heavily:

```txt
GLOBAL_DATA
TABLE_SORT_STATE
CURRENT_PAGE
PAGE_SIZE
TRACK_FROM_DATE
TRACK_TO_DATE
TRACK_STATUS_FILTER
cancelUploadFlag
currentRow
window.activeTab
window.prevQtyDays
window.superReviewEdits
window.superAcceptedEdits
window.superPendingEditState
window.superAlreadyForwardedToManager
window.managerDashDateRange
window.managerDashBranchFilter
window.managerDashFilter
window.managerDashTableVisible
window.managerDashSelectedOrders
window.managerInventoryTabOpen
window.managerInvLookupDate
window.managerInvLookupBranch
window.managerInvLookupQuery
window.managerInvLookupResults
window.managerInvBranchTxnResults
window.docketScanMatches
window.docketScanHistory
```

React adaptation:

- Replace global variables with component state, React Query cache, URL query params, and service-level helpers.
- Keep filters/pagination in page state.
- Keep user/session in Auth context.
- Keep workflow mutations in service/RPC layer.

## Global UI utilities

### Loader

Legacy functions:

```txt
showLoader(context)
hideLoader(context)
```

Behavior:

- Shows fixed full-screen loader.
- Stores debug context.
- Has a 30-second failsafe timer.
- If stuck, hides loader and shows warning popup.

React adaptation:

- Use a shared loading overlay component or page-level loading state.
- Keep long-request failsafe for uploads and heavy reports.

### Popup / modal

Legacy functions:

```txt
showPopup(message, type, actionsHTML)
closePopup()
compactPopupMessage(message)
showOrderPlacedPopupSummary(details)
escapeHtml(value)
```

Behavior:

- Supports success, error, warning, and info states.
- Supports custom action buttons.
- Handles Escape key to close.
- Compactly rewrites common messages such as invalid credentials, order submitted, duplicate item, upload complete, comment added.
- Order submission popup shows temporary order number, order type, order for, ordered by, approver, total items, and order value.

React adaptation:

- Build a reusable modal/toast system.
- Use structured props rather than raw HTML strings.
- Keep order submission summary modal.
- Never inject user data without escaping/safe rendering.

### Debug logging

Legacy functions:

```txt
isDebugEnabled()
serializeDebugValue(value)
getDebugSnapshot()
debugLog(event, details)
debugMeasure(label, promiseFactory, details)
window.PartsDebug.enable()
window.PartsDebug.disable()
window.PartsDebug.clear()
window.PartsDebug.dump()
window.PartsDebug.snapshot()
```

Behavior:

- Debug mode enabled by `?debug=1`; disabled by `?debug=0`.
- Stores last 250 debug entries in localStorage.
- Captures URL, online/offline state, active tab, role, branch, loader visibility, and network info.
- Logs window errors, unhandled promise rejections, online/offline events.

React adaptation:

- Keep a `debugLogger` utility.
- Keep optional `?debug=1` behavior.
- Add debug snapshots for auth state, current route, role, branch, active query keys, and loader state.

## User, role, and session logic

### Legacy functions

```txt
normalizeUserKey(key)
getUserField(user, aliases)
normalizeUserPayload(user)
getUser()
getUserRole(user)
getUserBranch(user)
getUserName(user)
getUserId(user)
isAdminRole(user)
isSuperLikeRole(user)
isManagerRole(user)
isViewerRole(user)
isDeveloperRole(user)
syncUserRoleFromDb(user)
```

### Legacy behavior

- User is stored in `localStorage.user`.
- User fields are normalized because table columns may vary: `Name`, `Branch`, `Role`, `Password`, plus aliases.
- Admin is either role `admin` or branch `HQ`.
- Super-like roles are `super` and `manager`.
- Manager role is role `manager`.
- Viewer role is role `viewer`.
- Developer role is role `developer`.
- On load, user role is refreshed from the `users` table.

### Legacy login behavior

Functions:

```txt
loadLogin()
login()
```

Behavior:

- Loads branch dropdown from `users` table.
- User selects branch and enters password.
- Frontend fetches all users and compares branch/password in browser.
- Stores matched user in localStorage.
- Stores `developerLoginAt` timestamp.
- Enter key triggers login.

React adaptation:

- Already replaced with Supabase Auth email/password.
- Profile data must come from profile table, not direct password comparison.
- Keep role mapping behavior but enforce through backend/RLS.

## Routing and navigation logic

### Legacy functions

```txt
goHomeTab()
loadBranch()
renderHeader()
updateMenuHighlight()
applyMobileTableLayoutFixes()
initResponsiveLayoutObserver()
logout()
goBack()
```

### Default landing rules

```txt
developer -> DevDashboard
admin/HQ -> Approved
manager -> Dashboard
super -> PendingApproval
viewer -> track
branch user -> create
```

### Role navigation rules

- Branch users see New Order and Track Orders.
- Viewer sees Track Orders only.
- Admin/HQ sees Approved, Processed, Upload, Docket if allowed.
- Super sees Pending Approvals, Approved, Rejected, All Orders.
- Manager sees Dashboard and manager approval workflow.
- Developer sees Workspace, Users, Requests, Comments, Inventory, Reports, Docket, New Order, Track.

React adaptation:

- Keep route guard and roleHomePath mapping.
- Filter sidebar/navigation by role.
- Backend must still enforce permissions.

## Part master and 30-day quantity logic

### Legacy functions

```txt
normalizePartNo(partNo)
getPartMasterByPartNo(partNo)
getLast30QtyByBranchPart(branch, partNo)
```

### Behavior

- Part number is normalized by removing spaces and uppercasing.
- Part master lookup reads `part_master` by `PartNo` and returns `PartNo`, `Description`, `DNP`, `Cat1`.
- Part lookups are cached in `PART_MASTER_CACHE`.
- Last 30-day quantity is calculated from `requests` where:
  - same branch
  - same normalized part number
  - `Status != REJECTED`
  - `ApprovalStatus != Rejected`
  - `created_at >= today - 30 days`
- Uses effective quantity: edited quantity if present, else original quantity.

React adaptation:

- Keep normalized part lookup service.
- Add 30-day usage service for branch+part.
- Cache through React Query.
- Show 30-day quantity in New Order and order detail review.

## New Order module

### Legacy function

```txt
loadCreate(tab)
addRow()
calc(row)
calcTotal()
submitOrder()
focusPartsInput()
```

### Order fields

- Order Type: `VOR`, `SOP`, `ZMAC`, `ZSPL`, `LUBES`
- Order For: `Customer`, `Stock`
- Employee Name: auto-filled from logged-in user.
- Approved By: loaded from `users` table where role is `super` or `manager`.
- Machine Number
- Customer Name
- Machine Type / Warranty Status: `UW`, `BW`
- Call ID
- Multiple part rows.

### New Order business rules

- `OrderType` and `OrderFor` are mandatory.
- Approver is mandatory for all orders.
- If `OrderType = VOR`:
  - `OrderFor` is forced to `Customer`.
  - `OrderFor` field is disabled.
  - Approver, machine number, customer name, and machine type are mandatory.
- If `OrderType` is `SOP`, `ZSPL`, or `ZMAC`:
  - `OrderFor` is mandatory.
  - If `OrderFor = Customer`, machine number and machine type are required.
- If `OrderFor = Customer`, machine number and customer name are required.
- If `OrderFor = Stock`, customer section is disabled.
- At least one valid part row is required.
- Quantity is mandatory for every entered part.
- Quantity cannot be less than 1.
- Quantity must be a whole number.
- Negative quantity is reset to 0 during input/calculation.
- Part number is invalid if description is blank after lookup.

### Part row behavior

Each row contains:

```txt
PartNo
Qty
30dQty
Description
DNP
Category
Value
Delete action
```

Behavior:

- Part number lookup fills Description, DNP, Cat1.
- Quantity x DNP calculates row value.
- Total is recalculated from all row values.
- Delete removes row and recalculates total.
- Duplicate/recent order warnings are shown through popup.

### Submit order behavior

- Generates temporary order number: `T` + random seven digits.
- Builds one `requests` row per part line under the same `OrderNo`.
- Inserts rows with:
  - branch
  - order type/for
  - employee
  - approver
  - warranty status
  - call ID
  - machine/customer
  - part details
  - quantity
  - 30-day quantity
  - value
  - `Status = PENDING APPROVAL`
  - `ApprovalStatus = PendingApproval`
- Retries up to 3 times if duplicate order number conflict occurs.
- Logs `ORDER_CREATED` action.
- Shows order placed summary popup.
- Reloads new order form after submission.

React adaptation:

- Keep multi-item order creation.
- Add missing VOR/Customer/Stock validations.
- Add 30-day quantity check.
- Add order summary confirmation.
- Add action event logging.
- Production should create order via RPC/Edge Function.

## Machine/customer logic

### Legacy functions

```txt
showManualCustomerPopup(machineNo)
saveNewMachine(machineNo)
```

Behavior:

- If machine number is not found in `machine_master`, popup asks user to manually enter customer name.
- Saving creates row in `machine_master` with `MachineNo` and `CustomerName`.
- Customer name is then set in UI.

React adaptation:

- Add machine lookup service.
- Add manual customer modal.
- Production write must be permission-controlled.

## Parts bulk upload inside New Order

### Legacy functions

```txt
handlePartsUpload(hasHeader)
processPartsUploadFlexible(rows)
cancelUpload()
```

### Behavior

- User uploads `.xlsx` from New Order page.
- Popup asks if file has a header row.
- Expected format:
  - Column 1: Part No.
  - Column 2: Qty
- Header row is removed if user confirms.
- Duplicate parts in Excel are merged by part number and quantities are summed.
- Each unique part is looked up from part master.
- Valid parts are added to the order table.
- Invalid part rows are counted as failed.
- Upload progress panel shows total, uploaded, invalid, remaining.
- User can cancel upload with `cancelUploadFlag`.

React adaptation:

- Add New Order bulk parts upload component.
- Use `xlsx` library.
- Show preview/validation summary before applying rows.
- Keep duplicate merge behavior.

## Track Orders module

### Legacy functions

```txt
loadTrack(tab, skipReset)
applyTrackDateFilter(orders)
updateTrackDateFilter(kind, value)
setTrackStatusFilter(statusKey)
changePage(direction)
toggleRow(index)
handleUniversalSearch(value)
renderSearchResults(data)
refreshCurrentView()
applyOrderSort(orders)
```

### Data loading

- Reads `requests` with `REQUEST_LIST_SELECT`.
- Orders by `created_at desc`.
- Loads in pages of 1000 rows from Supabase until all rows are fetched.
- Branch users are restricted to their own branch.
- Admin, Super, Manager, Viewer, and Developer can see wider/global data.
- Stores loaded rows in `GLOBAL_DATA` for universal search.

### Grouping

- Rows are grouped by `OrderNo`.
- Each grouped order has `items` array.
- Grouped order `created_at` is corrected to the earliest row when needed.
- Orders with total quantity 0 and total value 0 are hidden unless explicitly included for manager/developer views.

### Filters and sorting

- Date From / To filters use `created_at`.
- Status filter supports dashboard cards/status cards.
- Universal search checks:
  - OrderNo
  - PartNo
  - CustomerName
  - MachineNo
  - Branch
  - OrderType
  - Printable status label
- Table sorting supports:
  - Date
  - Order Type
  - Order For
  - Customer
  - Branch
  - Qty
  - Value
  - Order No
  - Status

### Track UI

- Summary/status cards.
- Date filters.
- Status filter cards.
- Paginated order table.
- Comment count badge.
- Status chip.
- Click row opens full order detail.

React adaptation:

- Tracking page already has search, status, date range, pagination.
- Still needs: sort headers, comment count, grouped order value/qty, order detail toolbar, status cards, inventory/previous quantity in detail.

## Status and value calculation logic

### Legacy functions / concepts

```txt
isPendingApprovalStatus(value)
getPrintableStatusLabel(statusOrRow)
getResolvedRowStatus(row)
getOrderStatusLabel(orderOrItems)
getStatusChipStyle(status)
getOrderTypeRowStyle(orderType)
getEffectiveQty(row)
getEffectiveValue(row)
shouldShowOrder(orderObj, options)
```

### Important behavior

- Edited quantity/value override original quantity/value where present.
- Rejected orders/rows are excluded from many quantity and previous-quantity calculations.
- `PENDING APPROVAL`, `APPROVAL PENDING`, `PendingApproval`, `PendingManagerApproval`, and related variants must normalize consistently.
- User-facing status labels include:
  - Pending Approval
  - Pending Manager Approval
  - Approved
  - Processed
  - Dispatched
  - Partially Dispatched
  - Partially Received
  - Received
  - Issued
  - Not Dispatched / `NOT DESPATCHED`
  - Rejected

React adaptation:

- Build shared status normalization utility.
- Keep old spelling mapping for `NOT DESPATCHED` if existing reports rely on it.
- All status transitions should eventually be backend functions.

## Order detail view

### Legacy function

```txt
openOrderView(orderNo)
```

### Behavior

- Fetches all `requests` rows for an `OrderNo` ordered by `created_at` and `id`.
- Calculates total order value.
- Calculates previous quantity for each part over configurable days, default 30.
- Loads inventory quantity from `inventory_staging` by mapped branch code and part number.
- Shows part rows with:
  - part number
  - description
  - review/effective qty
  - billed qty
  - pending qty
  - previous quantity
  - inventory quantity
  - DNP/value
  - row status
- Shows action toolbar depending on role/status.
- Shows metadata grid.
- Shows user comments and system action logs.
- System logs can be hidden/shown.

### Super/manager edit behavior in order detail

- Super-like user can edit quantities when order is pending approval.
- Auto-suggested edited qty = original qty - previous quantity, minimum 0.
- If edited qty differs from original qty, approval requires either accepting edited qty or approving with original quantity.
- Rows can be removed from review by setting `editedqty = 0` and `editedvalue = 0`.

React adaptation:

- Build a dedicated order detail page/drawer/modal shared by Tracking/Admin/Approvals/Manager.
- Add previous quantity selector.
- Add inventory quantity lookup.
- Add edit quantity, reset, accept edits, remove row.
- Add comments and action logs.

## Admin processing workflow

### Legacy functions

```txt
loadAdmin(activeTab, skipReset)
loadPendingCount()
startPendingCountAutoRefresh()
processOrder(orderNo)
rejectOrder(orderNo)
confirmReject(orderNo)
markOrderIssued(orderNo)
```

### Pending count behavior

- Realtime Supabase listener on `requests` calls `loadPendingCount()`.
- Separate 20-second interval refresh also runs for admin.
- Count is unique approved orders that should show in admin approved queue.

### Admin tabs

- `Approved` tab shows orders with overall status `APPROVED`.
- `Processed` tab shows non-approved workflow states, excluding `APPROVED`, `PENDING APPROVAL`, and `REJECTED`.
- Data is grouped by `OrderNo`.
- Orders are sorted and paginated.

### Process order behavior

- Admin enters final/order number before processing.
- If final order number is blank, show error.
- If same as old temporary order number, block.
- If final order number already exists in `requests`, block.
- Updates all rows with old `OrderNo`:
  - `OrderNo = inputOrderNo`
  - `Status = Processed`
  - `ProcessedDate = now`
- Logs `ADMIN_PROCESSED`.
- Opens Processed tab.

### Admin reject behavior

- Updates order rows to `Status = Rejected`.
- Logs `ADMIN_REJECTED`.
- Moves to Processed tab.

### Mark Issued behavior

- Requires invoice number and invoice date.
- Only customer orders can be marked issued.
- Branch user can only mark own branch orders as issued.
- Updates:
  - `Status = Issued`
  - `DBMSinvoiceNo`
  - `DBMSinvoiceDate`
- Logs `ORDER_ISSUED`.

React adaptation:

- Admin page must support approved queue, processed queue, process order number entry, reject, issued workflow, realtime/periodic count.
- Processing should be backend-protected.

## Super and manager approval workflow

### Legacy functions

```txt
loadSuper(activeTab, skipReset)
openSuperOrder(orderNo)
getDefaultManagerApprover(excludeName)
updateApproval(orderNo, status)
approveOrder(orderNo)
approveWithOriginalQty(orderNo)
acceptEditedQty(orderNo)
saveEditedQty(orderNo, rowId, partNo, createdAt, value, originalQty, originalValue)
removeSuperRow(orderNo, rowKey, rowId, partNo, createdAt, originalQty, originalValue)
confirmRemoveSuperRow(...)
openChangeApproverPopup(orderNo, currentApprover)
sendToApprover(orderNo, selectedApprover)
changePrevQtyDays(orderNo, days)
```

### Approval behavior

- Super approval can approve, reject, or forward to manager.
- Manager approval finalizes approval or rejection.
- If a super user approves and a manager exists:
  - `Status = PENDING APPROVAL`
  - `ApprovalStatus = PendingManagerApproval`
  - `ApprovedBy = managerName`
  - `ApprovedBySuper = current super user`
  - `ApprovedAt = now`
  - log `SUPER_FORWARDED_MANAGER`
- If no manager is configured, fallback to direct approval.
- Manager approval sets:
  - `Status = Approved`
  - `ApprovalStatus = Approved`
  - `ApprovedAt = now`
  - log `MANAGER_APPROVED`
- Rejection sets:
  - `Status = Rejected`
  - log `SUPER_REJECTED` or `MANAGER_REJECTED`

### Edited quantity approval behavior

- Super can edit each item quantity.
- Edited value recalculates from unit value.
- Remove row = edited qty/value set to 0.
- Accept edited qty persists suggested/persisted edited qty and edited value.
- Approve with original qty clears edited qty/value.
- Logs:
  - `SUPER_REMOVED_ROW`
  - `SUPER_RESET_TO_ORIGINAL`
  - `SUPER_ACCEPTED_EDITS`

### Change approver behavior

- Popup loads users with role `super` or `manager`.
- Selected approver updates `ApprovedBy` for whole order.
- Logs `APPROVER_CHANGED`.

React adaptation:

- Build approval queue with item review panel.
- Add manager-forwarding rules.
- Add edit/accept/reset/remove quantity workflows.
- Add change approver modal.

## Comments and action logs

### Legacy functions

```txt
parseOrderComments(raw)
isSystemActionComment(comment)
getOrderComments(orderObj)
getUserComments(orderObj)
getOrderCommentCount(orderObj)
getCommentUserBg(by)
getCommentAttachmentHref(url)
appendOrderActionLog(orderNo, action, text, meta)
addOrderComment(orderNo)
handleCommentAction(orderNo)
toggleActionLogs()
updateCommentFileName(input)
```

### Behavior

- Comments are stored inside `OrderComments` JSON on the first row of an order.
- System actions have `type = system_action`.
- User comments have `type = user`.
- Duplicate comments are removed by a combined key of by/text/at/attachment name/url.
- File attachments are stored as base64 data URLs.
- Data URLs are converted to blob URLs for opening/downloading.
- Comment count shown on order tables counts only user comments, not system action logs.
- Action logs have titles and colors based on event type.

### Event types used

```txt
ORDER_CREATED
ADMIN_PROCESSED
ADMIN_REJECTED
SUPER_APPROVED
SUPER_FORWARDED_MANAGER
SUPER_REJECTED
MANAGER_APPROVED
MANAGER_REJECTED
APPROVER_CHANGED
SUPER_REMOVED_ROW
SUPER_RESET_TO_ORIGINAL
SUPER_ACCEPTED_EDITS
STATUS_UPDATED
ORDER_ISSUED
```

React adaptation:

- Move comments to normalized `order_comments` / `order_events` tables where possible.
- During staging, mirror behavior safely in `test_order_comments` / `test_order_events`.
- Do not store large attachments as base64 in row JSON for production; use Supabase Storage.

## Docket scanner workflow

### Legacy functions

```txt
normalizeDocketNo(value)
canAccessDocketScanner(user)
loadDocketScanner()
lookupDocketRows(docketNo)
renderDocketMatches()
markDocketRowReceived(rowId)
startDocketCameraScanner()
stopDocketCameraScanner()
pollDocketBarcode()
```

### Behavior

- Docket number is normalized by trimming, removing spaces, and uppercasing.
- Any user with branch access can access docket scanner.
- Uses browser `BarcodeDetector` if available.
- Requests rear/environment camera.
- Supports QR, Code 128, Code 39, EAN, UPC, ITF formats.
- Has scan cooldown to avoid duplicate repeated scans.
- Manual entry fallback exists when camera/barcode detection is unavailable.
- Lookup finds matching request rows by docket/order data.
- Mark received updates row:
  - `Status = RECEIVED`
  - `receivedDate = now`
- Logs `STATUS_UPDATED` with docket metadata.
- Stops camera stream on logout/page change.

React adaptation:

- Current React scaffold exists.
- Add real camera scanner hook.
- Add manual lookup service.
- Add received status mutation with audit event.
- Always cleanup stream on unmount.

## Upload and report workflows

### Legacy functions

```txt
loadUpload()
processExcelData(rows)
processInventoryExcelData(rows, reportDate)
processPartsUploadFlexible(rows)
handlePartsUpload(hasHeader)
clearInventoryStagingTable()
insertInventoryStagingInBatches(rows, batchSize)
setInventoryProgress(percent, text)
hideInventoryProgress()
setUploadReportMeta(type)
renderUploadMetaBadge()
```

### Upload modules

Legacy upload page includes:

- Status report upload.
- Inward report placeholder.
- Inventory report upload.
- Upload metadata badge.
- Upload progress and cancellation.

### Status report upload behavior

- Reads `.xlsx` with `XLSX`.
- Maps order number, material number, status, billing/dispatch fields.
- Updates existing `requests` rows based on order/part.
- Handles received/locked statuses carefully.
- Logs status changes only once per order.
- Tracks updated/inserted/skipped counts.

### Inventory upload behavior

- Requires inventory report date.
- Reads `.xlsx` with default blank values.
- Maps columns:
  - Branch
  - Br. Code / Br Code
  - Itemcode / Item Code
  - ItemName / Item Name
  - Item Group
  - BHLHLN
  - REC
  - NSP
  - UOM
  - DNP
  - Opening Balance
  - Opening Inv Val
  - Received
  - Issued
  - Closing Balance
  - Closing Inv Val
- Skips grand-total/footer/blank rows.
- Resolves branch code from `branch_mapping` if missing.
- Deduplicates by report date + branch code + item code, keeping latest row from file.
- Clears `inventory_staging` before staging upload.
- Inserts staging rows in batches.
- Updates `inventory_current` by branch+item.
- Writes change records to `inventory_changes` when quantity differs.
- Shows uploaded/failed/error sample summary.

React adaptation:

- Build dedicated upload pages/services for status, inventory, inward.
- Keep column compatibility exactly.
- Add preview/validation before upload.
- Use batch insert/upsert services.
- Production upload should be admin/developer only.

## Manager dashboard and inventory lookup

### Legacy functions

```txt
onManagerDashboardDateChange()
onManagerDashboardBranchFilterChange(branch)
setManagerDashboardCardFilter(type, key, label)
clearManagerDashboardCardFilter()
toggleManagerDashboardFilteredTable()
downloadManagerDashboardFilteredExcel()
openManagerInventoryLookupTab()
loadManagerInventoryBranchDirectory()
performManagerInventoryLookup()
closeManagerInventoryLookupTab()
setManagerInventoryLookupDate(value)
setManagerInventoryBranchFilter(branchCode)
loadManagerBranchTransactions()
renderManagerInventoryLookupTab()
setManagerDashboardBranchFilter(branch)
```

### Manager dashboard behavior

- Date range filter.
- Branch filter.
- KPI card filters.
- Toggle drilldown table.
- Download filtered orders to Excel.
- Branch-wise summaries.
- Status-wise metrics.
- Value and quantity summaries.

### Manager inventory lookup behavior

- Loads branch directory from `branch_mapping`.
- Special display rename: branch code `DFM003` -> `JABALPUR PARTS`.
- Search part number in `inventory_staging`.
- Uses latest available report date.
- Groups latest rows by branch.
- Shows branch, item name, item group, DNP, REC/NSP/UOM, received, issued, closing balance, inventory value.
- Branch filter can show transaction rows for selected branch/date where received or issued is non-zero.

React adaptation:

- Current manager dashboard is compact but still incomplete.
- Add date/branch filters.
- Add card drilldown table.
- Add Excel download.
- Add inventory lookup tab and branch transaction view.

## Developer workspace

### Legacy functions / areas

```txt
loadDeveloperDashboard()
loadDeveloperUsers()
loadDeveloperRequestsEditor()
loadDeveloperCommentsInbox()
openDeveloperInventoryLookup()
fetchDeveloperCommentFeed()
getDeveloperCommentSeenAt()
getOrderCommentsWithMeta(row)
```

### Behavior

Developer has broad workspace access:

- Dashboard/workspace.
- User management view.
- Requests editor.
- Comments inbox.
- Inventory lookup.
- Reports/upload.
- Docket scanner.
- New Order and Track Orders.

Developer comments inbox:

- Reads `requests` comments.
- Flattens comments with metadata.
- Excludes system action comments.
- Sorts by comment timestamp descending.
- Uses `developerCommentsSeenAt` and `developerLoginAt` from localStorage.

React adaptation:

- Build developer admin area only for developer role.
- Add safe user/profile management against test/profiles table first.
- Add comments inbox from normalized comments table.
- Avoid free-form direct editing of production `requests` without backend authorization.

## Print and export logic

### Legacy functions

```txt
downloadOrder(orderNo)
downloadOrderExcel(orderNo)
printOrderDetails(orderNo)
downloadManagerDashboardFilteredExcel()
```

### Behavior

- Order detail can be printed.
- Order can be downloaded to Excel.
- Manager filtered table can be downloaded to Excel.
- Print preview includes:
  - order summary
  - branch/order/customer/machine/approver metadata
  - part rows
  - qty, billed, pending
  - effective value
  - status
  - processed/order registration/billing/transport/docket fields
  - comments

React adaptation:

- Add shared export utilities.
- Add print stylesheet/component.
- Add Excel export service.

## Mobile and responsive behavior

### Legacy functions/classes

```txt
applyMobileTableLayoutFixes()
initResponsiveLayoutObserver()
mobile-content-shell
mobile-table-scroll
```

Behavior:

- MutationObserver watches `#app` and applies mobile scroll wrappers.
- Tables get horizontal scroll behavior.
- Header/nav wraps on mobile.

React adaptation:

- Use layout components with responsive table wrappers.
- Avoid mutation observers unless absolutely required.

## Adaptation priority checklist

### High priority

1. New Order full validation and 30-day quantity logic.
2. Shared order detail view.
3. Approval workflow with edit qty, accept edit, reset original, remove row.
4. Admin processing with final order number, duplicate checks, reject, issued workflow.
5. Comments and system action logs.
6. Status normalization and effective qty/value utilities.
7. Inventory upload and lookup.
8. Manager dashboard filters, drilldowns, and Excel export.
9. Docket scanner real camera + received update.
10. Developer workspace modules.

### Medium priority

1. Universal search across current data set.
2. Sortable table headers.
3. Upload metadata badge.
4. Progress/cancel UI for uploads.
5. Print/export styling.
6. Offline/network debug snapshot.

### Production backend priority

Before production table cutover, create secure RPC or Edge Functions for:

```txt
create_order
approve_order
reject_order
forward_to_manager
manager_approve_order
manager_reject_order
save_edited_quantity
accept_edited_quantities
reset_edited_quantities
remove_order_item_for_review
process_order
reject_processed_order
mark_order_issued
mark_docket_received
add_order_comment
append_order_event
upload_inventory_batch
upload_status_report_batch
```

## Current React rebuild gap summary

### Already partially adapted

- Supabase Auth login.
- Role-based route guard.
- Compact app shell.
- New Order multi-item scaffold.
- Part master lookup scaffold.
- Tracking search/date/status/pagination scaffold.
- Approval approve/reject scaffold.
- Admin process scaffold.
- Manager compact KPI/summary scaffold.
- Inventory lookup scaffold.
- Reports CSV scaffold.
- Docket scanner UI scaffold.

### Still missing from legacy behavior

- Full New Order validation matrix.
- Bulk parts upload.
- Machine/customer auto lookup and manual save.
- 30-day quantity warning and display in all relevant views.
- Full order detail view with comments, action logs, inventory, billed/pending, print/export.
- Full approval edit quantity workflow.
- Manager approval forwarding workflow.
- Admin final order number entry and duplicate check.
- Issued workflow with invoice number/date.
- Status report upload.
- Inventory upload batch processing and change logging.
- Manager date/branch/card filters and inventory lookup.
- Developer users/requests/comments workspace.
- Real docket camera scanning and received update.
- Universal search and table sorting across modules.
