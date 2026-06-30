# Full capacity rebuild roadmap

The React app must preserve the legacy `index.html` workflows while replacing the single-file implementation with maintainable production modules.

## Build sequence

### 1. Auth and role shell

Status: in progress

- Supabase Auth email/password login
- Profile-based role and branch loading
- Protected routes
- Compact operations UI shell

### 2. Order register

Status: partially rebuilt

Required capacity:

- Branch/user based order creation
- Multi-item order rows
- Part master lookup
- Previous 30-day quantity check
- Customer/stock rules
- VOR mandatory fields
- Order creation audit event
- Order summary confirmation

### 3. Tracking workspace

Status: in progress

Required capacity:

- Search by order, branch, customer, machine, part, order type, status
- Date filtering
- Status filtering
- Pagination
- Grouped order details
- Item detail table
- Comment/action history
- Inventory and previous quantity visibility

### 4. Approval workflow

Status: partially rebuilt

Required capacity:

- Pending approval queue
- Manager approval queue
- Approved/rejected queue
- Edit quantity
- Accept edited quantity
- Reset quantity
- Reject order
- Forward to manager
- Audit events

### 5. Admin processing

Status: partially rebuilt

Required capacity:

- Approved queue
- Billed quantity update
- Processed quantity/value/date
- Reject during processing
- Processed order history

### 6. Manager dashboard

Status: partially rebuilt

Required capacity:

- KPI cards
- Branch summary
- Status summary
- Value summary
- Date/branch/status filters
- Drilldown table

### 7. Inventory

Status: partially rebuilt

Required capacity:

- Excel upload
- Column validation
- Staging/current inventory update
- Failed row report
- Branch mapping
- Order inventory lookup

### 8. Reports

Status: partially rebuilt

Required capacity:

- Report tables
- CSV/Excel download
- Manager/admin views
- Print-ready output

### 9. Docket scanner

Status: scaffold only

Required capacity:

- Camera scanner
- Manual docket entry fallback
- Order status update
- Camera cleanup

### 10. Comments, attachments, audit trail

Status: not fully rebuilt

Required capacity:

- User comments
- System action comments
- Attachments
- Timeline display
- Comment counts

## Cutover rule

Until production cutover is approved, new React features can use `test_` tables for safe testing. Production table switching must happen behind service functions and RLS policies, not by hardcoding live table writes inside pages.
