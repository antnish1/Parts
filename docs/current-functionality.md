# Current functionality reference

This document records the functionality that must be preserved while rebuilding Parts Connect Portal.

The current `index.html` remains the source-of-truth legacy implementation until each module is rebuilt and verified.

## Existing modules

### Login and role access

Current capabilities:

- Branch login
- Password-based access
- Branch user navigation
- Admin / HQ navigation
- Super approval navigation
- Manager dashboard navigation
- Viewer tracking access
- Developer workspace access
- Role-specific default landing pages

Production rebuild notes:

- Replace frontend password checking with Supabase Auth.
- Keep role-based navigation, but enforce real access through Supabase RLS.
- Move role/branch profile data into a secure `profiles` table.

## New Order

Current capabilities:

- Create order from branch/user login
- Select order type such as VOR, SOP, ZSPL, ZMAC
- Select order for Customer or Stock
- Select approver
- Enter machine number
- Enter customer name
- Enter call ID
- Enter/select machine type or warranty status
- Add multiple part rows
- Look up part details from part master
- Display description, DNP, category, value
- Validate quantity
- Prevent negative and invalid quantity
- Check previous 30-day quantity
- Submit multiple part rows under one order number
- Save order as pending approval
- Log order creation action

Must preserve:

- All mandatory field rules
- VOR-specific mandatory field rules
- Customer/stock order rules
- Quantity validation rules
- Invalid part number blocking
- Order summary popup after creation

## Track Orders

Current capabilities:

- Track orders by branch
- Admin/super/viewer/developer broader tracking access
- Global search by order number, part number, customer, machine, branch, order type, and status
- Date range filtering
- Status filtering
- Sorting
- Pagination
- Group multiple item rows by order number
- Show order detail
- Show status chips
- Show comments and action history
- Show inventory/previous quantity information

Must preserve:

- Branch users should see their own branch orders
- Admin/super/manager/developer/viewer visibility rules must continue
- Status display must remain understandable for field users

## Approval workflow

Current capabilities:

- Pending approval queue
- Approved queue
- Rejected queue
- Super approval
- Manager approval
- Forward to manager approval
- Edit quantity
- Accept edited quantity
- Reset to original quantity
- Remove row for review
- Reject order
- Add/log approval actions

Must preserve:

- Existing status meanings
- Existing approval paths
- Existing manager/super permissions
- Edited quantity handling
- Audit/action trail

## Admin processing

Current capabilities:

- View approved orders
- Process orders
- Reject orders
- Update billed quantity
- Update processed date
- Update processed value
- Track processed status
- Realtime pending count refresh

Must preserve:

- Approved-to-processed workflow
- Rejection workflow
- Admin visibility and action access
- Status consistency

## Manager dashboard

Current capabilities:

- KPI cards
- Branch-wise summaries
- Status-wise counts
- Value summaries
- Date/branch/status filters
- Inventory lookup integration
- Drill-down style table visibility

Must preserve:

- Existing business metrics
- Existing status counts
- Existing branch comparison logic
- Inventory lookup behavior

## Inventory upload and lookup

Current capabilities:

- Upload Excel inventory reports
- Parse branch, branch code, item code, item name, item group, UOM, DNP, opening balance, received, issued, closing balance, inventory value
- Map branch names to branch codes
- Clear and upload inventory staging
- Update current inventory
- Track inventory changes
- Show upload progress
- Show uploaded/failed count
- Use inventory lookup in order detail

Must preserve:

- Excel column compatibility
- Branch mapping behavior
- Failed row reporting
- Inventory lookup by branch and item code

## Reports

Current capabilities:

- Upload/report metadata
- Report views
- Download/print-style flows
- Admin/manager reporting views

Must preserve:

- Current report formats
- Existing column meanings
- Existing manager/admin usage

## Docket scanner

Current capabilities:

- Docket scanner page/navigation
- Camera scanner start/stop behavior
- Status update support from scan workflow

Must preserve:

- Scanner usability
- Camera cleanup on page change
- Docket/order status workflow

## Comments and attachments

Current capabilities:

- User comments
- System action comments
- Comment count
- Attachment link/data handling
- Timeline-like action visibility

Must preserve:

- Comments associated with orders
- System actions distinguishable from user comments
- Attachment access from order detail

## Universal UI behavior

Current capabilities:

- Loader overlay
- Popup/dialog messages
- Upload progress card
- Responsive table fixes
- Search bar
- Role-based navigation
- Status chips
- Dark operations-dashboard style

Must preserve:

- Simple field-user workflow
- Clear status visibility
- Mobile/tablet usability
- Fast navigation between major sections
