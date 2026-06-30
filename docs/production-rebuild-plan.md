# Production-grade rebuild plan for Parts Connect Portal

## Goal

Rebuild the existing single-file Parts Connect Portal into a production-grade web application with a cleaner, modern UI while preserving all existing business functionality.

The current `index.html` must remain intact as the legacy reference during migration. New work should be added beside it first, then migrated module by module.

## Current-state summary

The current repository contains a working internal portal, but it is not production-ready yet.

Main issues to solve:

- App logic, UI, CSS, database calls, validations, and business rules are combined in one large `index.html` file.
- Authentication is handled in the frontend by reading users from the `users` table.
- Passwords appear to be handled as readable user fields.
- User session and role information is stored in `localStorage`.
- Role checks are mainly frontend based.
- Supabase URL/key are directly used in the browser.
- Database access depends heavily on frontend filtering.
- Large table/report data is fetched and processed client-side.
- No clear React/Node project structure, build process, testing, CI/CD, or documentation.

## Target architecture

Recommended stack:

- Frontend: React + Vite + TypeScript
- Styling: Tailwind CSS + reusable component system
- Backend/security: Supabase Auth + Supabase Row Level Security + Supabase Edge Functions where needed
- State/query management: TanStack Query
- Forms/validation: React Hook Form + Zod
- Tables: TanStack Table
- Charts/dashboard: Recharts or similar
- File parsing: SheetJS for Excel; large imports should be batched and validated carefully
- Testing: Vitest + React Testing Library + Playwright
- CI/CD: GitHub Actions
- Hosting: Vercel / Netlify / Supabase-compatible static deployment

Suggested structure:

```txt
parts-connect-portal/
  package.json
  vite.config.ts
  tsconfig.json
  .env.example
  README.md
  index.html              # existing legacy app stays intact during migration
  src/
    main.tsx
    App.tsx
    routes/
      AppRouter.tsx
      ProtectedRoute.tsx
    lib/
      supabase.ts
      queryClient.ts
    auth/
      LoginPage.tsx
      useAuth.ts
      roleGuards.ts
    layouts/
      AppLayout.tsx
      AuthLayout.tsx
    components/
      ui/
      tables/
      forms/
      feedback/
      charts/
    features/
      orders/
      tracking/
      approvals/
      admin/
      manager/
      developer/
      inventory/
      reports/
      comments/
      docket/
    services/
      orders.service.ts
      users.service.ts
      inventory.service.ts
      partMaster.service.ts
      comments.service.ts
    utils/
      date.ts
      money.ts
      partNo.ts
      status.ts
      validation.ts
    styles/
      globals.css
  supabase/
    migrations/
    functions/
    policies/
  docs/
  .github/
    workflows/
      ci.yml
      deploy.yml
```

## Functional modules to preserve

### 1. Authentication and role access

Current functionality to preserve:

- Branch login
- Admin / HQ access
- Super approver role
- Manager role
- Viewer role
- Developer role
- Role-based navigation and default landing pages

Production changes required:

- Replace custom frontend password check with Supabase Auth.
- Do not select password fields in frontend.
- Do not store full user records in `localStorage`.
- Store profile metadata in a `profiles` table linked to Supabase `auth.users`.
- Use RLS to enforce role/branch access at database level.
- Frontend role checks should only control UI visibility, not security.

Suggested table:

```sql
profiles (
  id uuid primary key references auth.users(id),
  full_name text not null,
  branch text not null,
  role text not null check (role in ('branch','admin','super','manager','viewer','developer')),
  is_active boolean default true,
  created_at timestamptz default now()
)
```

### 2. New order creation

Current functionality to preserve:

- Order type selection: VOR, SOP, ZSPL, ZMAC, etc.
- Order For: Customer / Stock
- Approver selection
- Machine number, customer name, call ID, machine type
- Multiple part rows
- Part master lookup
- Qty validation
- DNP/value calculation
- 30-day previous quantity check
- Duplicate order number retry
- Action log after order creation

Production changes required:

- Extract validation into Zod schema.
- Use server-side order creation through RPC or Edge Function.
- Generate order number in database/backend, not frontend `Math.random()`.
- Insert order header and order items in a safe backend flow.
- Keep client-side validation for UX, but enforce backend validation too.

Suggested normalized model:

```sql
orders (
  id uuid primary key,
  order_no text unique not null,
  branch text not null,
  order_type text not null,
  order_for text not null,
  employee_id uuid references profiles(id),
  approver_id uuid references profiles(id),
  machine_no text,
  customer_name text,
  call_id text,
  warranty_status text,
  status text not null,
  approval_status text not null,
  created_at timestamptz default now()
)

order_items (
  id uuid primary key,
  order_id uuid references orders(id) on delete cascade,
  part_no text not null,
  description text,
  dnp numeric,
  qty numeric not null,
  edited_qty numeric,
  value numeric,
  edited_value numeric,
  previous_30d_qty numeric default 0
)
```

### 3. Track orders

Current functionality to preserve:

- Branch-wise track orders
- Admin/super/viewer/developer broader visibility
- Search by order no, part no, customer, machine, branch, order type, status
- Date filter
- Status filter
- Sorting and pagination
- Order detail popup/view
- Comments and action history
- Status chips

Production changes required:

- Move filtering/pagination to Supabase query level.
- Avoid fetching all rows into browser.
- Use database views or RPC for grouped order summaries.
- Add indexes for `created_at`, `branch`, `order_no`, `status`, `approval_status`, `part_no`, and `machine_no`.
- Use TanStack Table for consistent sorting/filtering.

### 4. Approval workflow

Current functionality to preserve:

- Pending approval
- Approved
- Rejected
- Manager approval
- Super approval
- Forward to manager approval
- Edited quantity handling
- Reset to original / accept edits
- Remove row for review
- Approval comments/action logs

Production changes required:

- Represent workflow transitions as backend functions.
- Prevent invalid status changes using database checks or functions.
- Store every workflow change in `order_events`.
- Only allowed roles should be able to call approval/update functions.

Suggested table:

```sql
order_events (
  id uuid primary key,
  order_id uuid references orders(id),
  event_type text not null,
  old_status text,
  new_status text,
  actor_id uuid references profiles(id),
  notes text,
  metadata jsonb,
  created_at timestamptz default now()
)
```

### 5. Admin processing

Current functionality to preserve:

- Approved orders queue
- Order processing
- Processed status
- Rejection
- Billed qty / processed date / value updates
- Status update workflow
- Pending count realtime update

Production changes required:

- Use Realtime only for lightweight counters or queue refresh.
- Use Edge Function/RPC for processing orders.
- Keep audit logs for all admin actions.
- Validate billed quantity and processed quantities server-side.

### 6. Manager dashboard

Current functionality to preserve:

- KPI cards
- Branch summary
- Status-wise counts
- Value metrics
- Filters by date/branch/status
- Inventory lookup integration

Production changes required:

- Build dashboard from database views/materialized views.
- Do not calculate all dashboard metrics from large raw frontend arrays.
- Add database indexes and aggregate views.
- Use a refined dashboard UI with cards, trend indicators, compact tables, and drill-down views.

Suggested views:

```sql
v_order_dashboard_summary
v_branch_order_summary
v_status_order_summary
v_inventory_availability_summary
```

### 7. Inventory upload and lookup

Current functionality to preserve:

- Excel inventory upload
- Branch mapping
- Staging upload
- Inventory current table
- Inventory changes table
- Failed/valid row count
- Upload progress
- Inventory lookup from order detail

Production changes required:

- Validate file structure before processing.
- Upload in batches.
- Use database upsert instead of row-by-row read/update/insert.
- Consider Edge Function for large files.
- Keep upload history table.
- Add rollback/error reporting.

Suggested table:

```sql
inventory_uploads (
  id uuid primary key,
  uploaded_by uuid references profiles(id),
  report_date date not null,
  filename text,
  total_rows int,
  valid_rows int,
  failed_rows int,
  status text,
  created_at timestamptz default now()
)
```

### 8. Reports and downloads

Current functionality to preserve:

- Report generation
- Admin/manager report views
- Previous upload metadata
- Download/print style flows

Production changes required:

- Centralize report generation.
- Create reusable report components.
- Keep export formats stable.
- Add backend-generated reports for large datasets.
- Document each report format.

### 9. Docket scanner

Current functionality to preserve:

- Docket scanner navigation
- Camera scanner start/stop behavior
- Status update based on scanned docket/order data

Production changes required:

- Isolate camera/scanner logic in its own module.
- Ensure camera stops when route changes.
- Add permission/error handling.
- Store scan events in audit log.

### 10. Comments and attachments

Current functionality to preserve:

- User comments
- System action comments
- Attachment links/data handling
- Comment counts

Production changes required:

- Move comments to dedicated `order_comments` table.
- Store attachments in Supabase Storage, not inline base64 strings.
- Add file size/type validation.
- RLS should restrict attachment access by order visibility.

Suggested table:

```sql
order_comments (
  id uuid primary key,
  order_id uuid references orders(id),
  author_id uuid references profiles(id),
  comment_type text default 'user',
  body text,
  attachment_path text,
  created_at timestamptz default now()
)
```

## UI/UX redesign plan

### Design direction

Use a professional operations-dashboard look:

- Dark navy base
- Controlled yellow/gold accent for priority actions
- Clear status colors
- Clean card layout
- Better spacing and typography
- Responsive tables
- Sticky headers/actions for large lists
- Clear role-based navigation
- Fewer visual effects; more clarity

### Main layout

- Login page: professional centered card, company logo, branch/user login flow.
- App shell: sidebar on desktop, compact top/bottom navigation on mobile.
- Header: user role, branch, global search, notifications, logout.
- Dashboard: KPI cards + charts + queues.
- Tables: consistent filters, pagination, search, export.
- Order detail: drawer/modal with timeline, items, comments, inventory, actions.

### Core reusable UI components

- `Button`
- `Input`
- `Select`
- `DateRangePicker`
- `DataTable`
- `StatusBadge`
- `RoleBadge`
- `MetricCard`
- `OrderTimeline`
- `ConfirmDialog`
- `Toast`
- `PageHeader`
- `EmptyState`
- `FileUploadDropzone`

## Security hardening checklist

- [ ] Use Supabase Auth.
- [ ] Remove plaintext/readable password usage.
- [ ] Enable RLS on every business table.
- [ ] Add branch-based read/write policies.
- [ ] Add role-based policies for admin/super/manager/developer.
- [ ] Move sensitive writes to RPC/Edge Functions.
- [ ] Avoid storing full user object in localStorage.
- [ ] Do not expose service role key to frontend.
- [ ] Add input validation on frontend and backend.
- [ ] Store attachments in Supabase Storage with policies.
- [ ] Add audit logs for order/status/admin/developer actions.
- [ ] Add error monitoring/logging.

## Performance checklist

- [ ] Server-side pagination for orders.
- [ ] Server-side filtering/search.
- [ ] Database indexes for common filters.
- [ ] Views/RPC for dashboard metrics.
- [ ] Batch inventory uploads.
- [ ] Avoid row-by-row database updates.
- [ ] Cache part master lookups.
- [ ] Use TanStack Query stale times and invalidation.
- [ ] Use lazy-loaded routes.
- [ ] Use virtualized tables if datasets are very large.

## Migration strategy

### Phase 1: Documentation and schema audit

- Keep current `index.html` untouched as the legacy reference.
- Document all workflows currently present.
- Document existing Supabase tables and columns.
- Identify all statuses and transitions.
- Prepare migration map from old structure to new structure.

Deliverables:

- `docs/current-functionality.md`
- `docs/database-map.md`
- `docs/status-workflow.md`
- `docs/role-permissions.md`

### Phase 2: New React/Vite foundation

- Create Vite + React + TypeScript app.
- Add Tailwind CSS.
- Add routing.
- Add Supabase client using environment variables.
- Add layout, auth shell, protected routes.
- Add base UI components.

Deliverables:

- Running app shell
- Login page
- Protected route framework
- Initial design system

### Phase 3: Authentication and profiles

- Configure Supabase Auth.
- Create `profiles` table.
- Migrate users from current `users` table.
- Remove frontend password checking.
- Implement role and branch profile loading.
- Add RLS policies.

Deliverables:

- Secure login
- Role-based navigation
- Branch/profile access policies

### Phase 4: Orders module

- Build order creation page.
- Build part lookup service.
- Build order validation.
- Create backend-safe order creation flow.
- Preserve all current order rules.

Deliverables:

- New order form
- Multi-part order entry
- Previous 30-day qty display
- Secure order creation

### Phase 5: Tracking and order detail

- Build order list with server-side filters.
- Build order detail drawer/page.
- Add comments, action timeline, status chips.
- Add search and date/status filters.

Deliverables:

- Track Orders page
- Order details page/drawer
- Timeline/comments

### Phase 6: Approval/admin workflow

- Build super/manager approval screens.
- Build admin approved/processed/rejected screens.
- Add backend status transition functions.
- Add audit logs.

Deliverables:

- Approval queues
- Admin processing
- Secure workflow transitions

### Phase 7: Manager dashboard

- Create dashboard views/RPCs.
- Build KPI cards and charts.
- Add branch/status/date filters.
- Add drill-down tables.

Deliverables:

- Manager dashboard
- Branch summaries
- Status summaries

### Phase 8: Inventory and reports

- Build inventory upload page.
- Add batch validation and upload history.
- Build inventory lookup.
- Recreate report/download views.

Deliverables:

- Inventory upload
- Inventory lookup
- Reports

### Phase 9: Docket scanner and advanced tools

- Rebuild docket scanner as isolated module.
- Add camera permission handling.
- Add scan history/audit.
- Rebuild developer workspace safely.

Deliverables:

- Docket scanner
- Developer workspace
- Debug/admin tools

### Phase 10: Testing, deployment, and cutover

- Add unit tests.
- Add integration tests.
- Add Playwright end-to-end tests for major workflows.
- Add GitHub Actions CI.
- Deploy staging.
- Run parallel testing with legacy app.
- Switch users after acceptance testing.

Deliverables:

- Staging deployment
- Production deployment
- Test checklist
- Cutover plan

## Acceptance criteria

The rebuild is complete only when:

- [ ] All old workflows are available in the new app.
- [ ] Current `index.html` remains available as legacy reference until cutover.
- [ ] No frontend password checking remains.
- [ ] Supabase RLS is enabled and tested.
- [ ] Branch users can only access their branch data.
- [ ] Admin/super/manager/developer permissions work correctly.
- [ ] Large order lists use server-side pagination.
- [ ] Inventory upload works with validation and batching.
- [ ] Reports match existing business formats.
- [ ] Every status change is audited.
- [ ] App builds successfully in CI.
- [ ] Staging and production deployments are documented.
- [ ] README explains setup, environment variables, deployment, and workflow.

## Recommended first implementation PR

Start with the foundation PR:

1. Keep existing `index.html` untouched.
2. Create new React/Vite/TypeScript project structure beside it.
3. Add README and `.env.example`.
4. Add Tailwind.
5. Add Supabase client.
6. Add route shell and placeholder pages for every current module.
7. Do not remove legacy functionality until replacement modules are completed.

This keeps the old app available while the new app is rebuilt safely.
