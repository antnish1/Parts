# AGENTS.md — Parts Connect Portal

> **MANDATORY FOR ALL FUTURE AGENTS**
>
> Read this file **before** inspecting, editing, migrating, deploying, or reviewing any part of this repository. Treat it as the project operating contract. Do not start from the legacy root site or from old assumptions. When this file conflicts with the current code on `main`, inspect commit history and the user's latest explicit instruction before changing behavior.

Last consolidated: 2026-08-10  
Repository: `antnish1/Parts`  
Default branch: `main`

---

## 1. Project identity and purpose

**Parts Connect Portal** is Frontier Commercial Vehicles' internal parts/order operations portal. It supports branch order entry, approvals, admin processing, order tracking, delayed/VOR tracking, pending-issue management, installations/Engine & Breaker workflows, inventory, reports, docket scanning, credit dispatch, customer ledgers/aging, user management, and developer/admin functions.

The project is operational software. Preserve working business logic unless the user explicitly asks to change it.

The active frontend is:

```text
app/
```

The root-level `index.html` is legacy/reference only. **Do not implement new product work in the root legacy page unless explicitly requested.**

Primary stack:

- React 18 + TypeScript
- Vite
- React Router
- TanStack Query / Table
- Supabase
- React Hook Form + Zod
- Tailwind/CSS
- XLSX / XLSX JS Style for spreadsheet exports/imports
- Vitest / ESLint

---

## 2. Source-of-truth precedence

When determining intended behavior, use this order:

1. **The user's latest explicit instruction in the current chat**
2. **Current working code on `main` and recent commits**
3. **This `AGENTS.md`**
4. `docs/Parts_Connect_Portal_Handover.md`
5. Other docs, migration notes, patch scripts, and historical chat summaries
6. Legacy root files

Do not resurrect behavior that newer code or newer user instructions intentionally replaced.

If you discover that this file is outdated after a confirmed product decision, **update `AGENTS.md` in the same change/PR** so future agents do not regress the project.

---

## 3. Core agent rules

### 3.1 Preserve workflows first

The user has repeatedly asked for UI redesigns and mobile fixes **without disturbing working workflows**. Therefore:

- Do not rewrite business logic merely to make code cleaner.
- Do not change database status values, role permissions, approval sequencing, order lifecycle rules, quantity semantics, or table sources without tracing every consumer.
- Prefer localized fixes over broad refactors when a workflow is already working.
- Any refactor that touches approval/order status logic requires regression testing across roles.

### 3.2 Current app only

- Work in `app/` for frontend changes.
- Supabase code lives under `supabase/`.
- The many `app/scripts/apply-*.cjs` patch scripts are part of the current build/dev pipeline. **Do not delete, bypass, or duplicate their behavior casually.**
- `app/package.json` runs a long `predev`/`prebuild` patch chain. Read that chain before moving code it modifies.

### 3.3 Never guess production database structure

Before changing a query, mutation, RLS policy, Edge Function, or migration:

- inspect the current service/function/migration;
- inspect actual table/column usage in code;
- trace whether the table is production or staging/test;
- avoid bulk production writes unless explicitly required.

### 3.4 No secret leakage

Never commit Supabase service-role keys, passwords, access tokens, private API keys, or production credentials. Use environment variables and `.env.example` patterns.

---

## 4. Production vs staging/test data — critical safety boundary

The project has historically mixed production master data with staging/test workflow tables. Do **not** infer from a service filename that a table is test-only.

### Production master usage established in project history

Parts lookup/search uses:

```text
public.part_master
```

Machine lookup/search uses:

```text
public.machine_master
```

Approved machine behavior:

- read/search `machine_master`;
- when a customer order uses a machine number that does not exist, ask for customer name in a popup;
- submit may insert the missing machine/customer into `machine_master`;
- customer name on the main New Order form remains read-only.

Historically approved live access:

```text
part_master: read/search only
machine_master: read/search + insert missing machine/customer during order creation
```

Production-sensitive tables referenced historically include:

```text
requests
users
part_master
branch_mapping
inventory_current
inventory_staging
inventory_changes
machine_master
```

### Staging/test workflow tables historically used

The order workflow has used tables such as:

```text
test_orders
test_order_items
test_order_events
test_order_comments
test_order_comment_attachments
test_profiles
test_branch_mapping
test_inventory_*
```

**Important:** this list is historical, not permission to assume the entire application still uses these tables today. Inspect current code before each change. The filename `Test Tables in Production.txt` and earlier handover notes exist because test-named tables have been used in the deployed app.

Do not migrate staging/test workflow tables to live replacements unless the user explicitly asks or the current code/history clearly shows that migration has already happened.

---

## 5. New Order workflow — protected behavior

Primary page:

```text
app/src/features/orders/NewOrderPage.tsx
```

Related services/functions historically include:

```text
app/src/services/testPart.service.ts
app/src/services/testMachine.service.ts
supabase/functions/create-order-action/index.ts
```

### Machine lookup

Expected behavior:

1. User enters Machine Number.
2. App performs a backend lookup against `machine_master`.
3. During machine lookup, the UI should use a clear centered/faded full-screen loader and lock/read-only the relevant form state so the user cannot create conflicting edits.
4. If machine exists, Customer Name is populated automatically and remains read-only.
5. If machine is missing, show a popup requesting Customer Name.
6. Popup value fills the read-only Customer Name field.
7. Order submission may save that missing machine/customer into `machine_master`.
8. Failure to save the missing machine record must not unnecessarily destroy an otherwise valid order workflow; project history includes a change making machine-insert failure non-blocking with a warning. Verify current behavior before altering it.

### Part lookup

- Part Description is read-only.
- Do **not** preload the full `part_master` merely to support part entry.
- Part lookup should occur through the backend after the user enters the part number and confirms/leaves the field (historically requested as entry + `Tab`).
- A `lookup-part-action` flow was introduced for backend lookup and filling description/DNP-related data.
- Preserve fast lookup behavior and avoid large client-side master downloads.

### New Order UI

- Keep the screen compact and professional.
- Avoid excessive heading/description height.
- Machine Type options are:

```text
U/W
B/W
```

- Customer Name: read-only in main form.
- Part Description: read-only.
- Submit loader must appear immediately on click.
- Avoid duplicate success/error popups. New Order historically kept a single Order Placed summary rather than both a global and local success modal.

### Mobile parts builder

A specific mobile fix was added for the New Order parts builder so these fields do not overlap:

```text
30D Qty
Category
Value
```

The intended mobile presentation is label above value with sufficient height/spacing, not both forced into one cramped flex row.

Relevant historical file:

```text
app/src/mobile-parts-builder-fix.css
```

Do not regress this layout.

---

## 6. Order tables and navigation — global UX contract

Where order tables appear (including Approvals, Approved, Track Orders, and equivalent order-list surfaces):

- the **entire row should be clickable** to open the order/detail/review page;
- do not require a separate `View` action merely to open the row;
- avoid redundant `View` buttons when row click already performs navigation;
- interactive controls inside a row must stop propagation so they do not accidentally open the row.

### Back behavior

The user explicitly requires Back buttons to return to the **actual previous page/state**, not a hardcoded generic route. Preserve browser/history semantics where practical (`navigate(-1)` or equivalent), including query/filter context.

### Search/filter persistence

- Universal search exists in `AppLayout.tsx` and routes to Track Orders using a query such as `/orders/track?q=...`.
- Track Orders should honor the query and filter accordingly.
- Preserve search/filter state across detail navigation where current code supports it.

---

## 7. Roles and access

The React router currently includes role-oriented surfaces for branch users, approval users, managers, admins, developers, and other operational users.

Current route families include:

```text
/orders/new
/orders/track
/orders/delayed-vor
/orders/pending-issue
/orders/:orderId
/orders/:orderId/correct
/approvals/review/:reviewOrderId
/approvals/:queue
/admin/:queue
/manager/dashboard
/developer/workspace
/uploads
/inventory/upload
/reports
/docket-scanner
/credit-dispatch...
/installations...
```

Role home routing is controlled through auth/role guard code; do not hardcode alternate role landing behavior without inspecting `roleGuards` and `AppRouter`.

### Login

The portal supports User ID-style login through an internal alias pattern:

```text
USERID@portal.local
```

Example: entering `DAMOH01` maps to an internal address such as `damoh01@portal.local`.

Do not expose the alias implementation unnecessarily in the UI.

---

## 8. Manager role — protected behavior

### Pending approvals badge

Manager navigation should show the **number of orders pending manager approval directly in the left sidebar**, similar to the admin role's actionable count.

If counts differ between the menu badge and page list, fix the underlying shared query/status definition rather than hardcoding the displayed number.

### Manager Approvals list

The user explicitly changed manager approval behavior:

- do **not** show Approve and Reject buttons directly in the approvals table;
- the list should lead to a separate review page;
- clicking Review / the row opens that page; do not expand review controls beneath the table.

### Manager review page

The intended manager review experience is deliberately simplified.

Do not show a collection of per-row Save/Approve/Reject action buttons.

Core actions are:

```text
Accept Edits
Approve Original Qty
```

When a manager changes quantity values:

- edits should not require saving each individual row separately;
- one click on **Accept Edits** should persist the edited quantities and continue through the established approval workflow;
- edited quantities should remain stored in the edited-quantity field used by the existing workflow;
- **Approve Original Qty** should proceed with the original quantities through the existing workflow.

Before changing this behavior, trace current implementation because later commits/patch scripts may have refined details.

---

## 9. Quantity semantics — do not break

Historically the project distinguishes original quantity from edited quantity.

A recurring rule in reporting/aggregation has been:

```text
use edited quantity if it has a non-blank value; otherwise use original Qty
```

Do not collapse `Qty` and `editedqty` into one database field without explicit instruction.

Manager editing must preserve the existing downstream semantics: original quantity remains recoverable; edited quantity represents the manager-adjusted quantity when applicable.

---

## 10. Status presentation

The user prefers clean, professional status treatment.

- Avoid button-like status badges where status is informational only.
- Prefer clean inline status labels with strong readability.
- Do not invent new status strings because they often participate in filtering, KPIs, counts, and workflow transitions.
- Search for canonical status helpers/scripts before changing display mappings.

Relevant build-time scripts include names such as:

```text
apply-track-order-canonical-status.cjs
apply-track-order-status-refresh.cjs
apply-cd-progress-status.cjs
apply-track-kpi-render-state.cjs
```

Any status change requires checking sidebar counts, Track Orders, approvals, reports, and KPIs.

---

## 11. Delayed VOR and Pending Issue

The correct product label is:

```text
Delayed VOR
```

Do not rename it to another variation unless explicitly requested.

The app has dedicated routes/features for:

```text
/orders/delayed-vor
/orders/pending-issue
```

Recent history includes:

- Delayed VOR ageing category updates;
- Pending Issue pagination/KPI/navigation fixes;
- Pending Issue Excel export functionality.

When modifying these pages, inspect recent commits and their current service logic rather than rebuilding from old screenshots or memory.

---

## 12. Engine & Breaker / installation workflow

The installation module was renamed/presented as **Engine & Breaker** in navigation during July 2026 work.

Recent work included:

- expanded access/acceptance workflow;
- reporting;
- required equipment number;
- privileged completion access;
- Excel import;
- corrected Excel date parsing;
- Parts Master description lookup during imports;
- installation detail/list/new routes.

Do not rename this module back to generic Installation in user-facing navigation without checking current UI/user instruction.

Excel imports must be handled carefully, especially dates (`dd/mm/yyyy` history) and description lookup from Parts Master.

---

## 13. Credit Dispatch module

Current routes include list, detail, new request, reports, customers, profile, ledger, and aging pages.

The codebase contains patch scripts for:

- progress/status UI;
- action design;
- compact review dates;
- correction/resubmit workflow;
- customer ledger;
- credit customer save;
- polling replacement;
- overdue/aging polish.

Treat this as an established workflow. Do not simplify it into a generic order page without tracing status transitions and customer ledger effects.

---

## 14. Mobile accessibility is mandatory

The user explicitly requested a full mobile audit and then asked to implement **all mobile fixes without disturbing working workflows**.

Therefore every feature change must be checked at mobile widths, not merely desktop.

Minimum mobile requirements:

- no horizontal clipping of core controls;
- no labels overlapping values;
- tables degrade gracefully through the project's responsive table effects or controlled scrolling/cards;
- buttons remain tappable and do not stack over one another;
- drawers/sidebar/nav remain usable;
- modals fit viewport height and can scroll internally;
- loaders remain centered and visible;
- forms preserve correct input order and readable labels;
- sticky/fixed elements do not hide content;
- table row click remains available on touch devices.

Existing global responsive logic includes:

```text
ResponsiveTableEffects
```

and mobile-specific CSS/patch scripts. Inspect before adding another competing responsive system.

---

## 15. Visual/design direction

The user previously allowed substantial visual redesign, but asked to preserve workflow/business logic.

Current design direction:

- professional internal operations portal;
- compact, information-dense but readable;
- minimal wasted vertical space;
- strong text/background contrast;
- subtle section differentiation is acceptable;
- avoid childish, decorative, or overly flashy UI;
- clear hierarchy for operational actions;
- status text should not look like unnecessary buttons;
- mobile and desktop should feel like the same product.

Historically emphasized action colors:

- Sign Out: red/white
- Bulk Parts Upload: dark navy/yellow

Do not treat those as a universal palette rule; preserve them where still used unless a later design system has replaced them.

---

## 16. Sidebar/header contract

Historical decisions include:

- profile/user details in the sidebar area;
- brand/logo identity in the main header area;
- actionable counts in the sidebar for role-specific pending work;
- universal search in the header/layout.

If redesigning navigation, retain role visibility rules, counts, search, sign out, and mobile navigation behavior.

---

## 17. Feedback, loaders, and duplicate UI

Reusable feedback/loading components live around:

```text
app/src/components/ui/FeedbackModal.tsx
app/src/components/ui/GlobalStatusEffects.tsx
```

Historical loader components/variants include:

```text
FeedbackModal
ActionLoader
InlineLoader
ButtonLoader
```

with loader variants such as:

```text
orbit
scanner
comet
matrix
pulse
```

The global success/error scanner was intentionally removed from normal feedback flow to stop duplicate popups.

Rules:

- one user action should generally produce one success/error feedback surface;
- loaders should begin immediately for submit/lookup actions;
- do not reintroduce a second global modal on top of a page-specific result modal;
- machine lookup should lock conflicting inputs while active.

---

## 18. Tables, pagination, and performance

The portal deals with growing operational datasets. Avoid unbounded client-side loading.

- Prefer paged/server-filtered queries for large order lists.
- Preserve item-derived order logic where already implemented.
- Do not fetch an entire master table just to support autocomplete/lookup.
- Keep Track Orders, Approvals, Order Detail, Pending Issue, Delayed VOR, and reports performant.
- If a list is slow, trace query count, nested item fetches, and repeated polling before adding arbitrary loaders or timeouts.

The codebase already contains performance patch scripts for approval and order detail pages; inspect them before introducing new fetch paths.

---

## 19. Spreadsheet import/export rules

The app uses `xlsx` and `xlsx-js-style` and has operational Excel workflows.

When changing import/export:

- preserve expected column names/order where the feature already has a template;
- preserve dates in the business's expected representation;
- validate blank/invalid rows instead of silently corrupting them;
- do not assume Excel dates are always JS date strings;
- large exports should use currently established data-fetch patterns;
- Pending Issue exports were added in August 2026—do not regress them;
- Engine & Breaker Excel imports have had explicit fixes for date and Parts Master description mapping.

---

## 20. Build system and patch scripts — read before refactoring

Current `app/package.json` runs many patch scripts automatically in both `predev` and `prebuild` before TypeScript/Vite.

This means a source file may be transformed/generated before build.

**Before editing any feature that appears in a patch script name:**

1. open the relevant `app/scripts/*.cjs` file;
2. understand whether it inserts/replaces code in the target file;
3. update both the source and patch mechanism when necessary;
4. run build after the patch chain, not only isolated TypeScript checks.

Never delete the patch chain simply because it looks unusual. It is technical debt, but currently part of production behavior.

---

## 21. Validation requirements for code changes

For frontend changes, from `app/` run the most relevant available checks:

```bash
npm run build
npm run lint
npm test
```

At minimum, a production-facing change should pass `npm run build` unless a known environment limitation prevents it.

For workflow/UI changes, also manually verify relevant routes/roles at desktop and mobile widths.

### Required regression focus by change type

**New Order:** machine lookup, missing-machine popup, part lookup, quantity builder, submit loader, success UI, mobile layout.

**Approvals:** role visibility, pending counts, review navigation, edited/original quantity behavior, resulting status/order state.

**Track Orders:** row click, query/search, filters, pagination, canonical status, order detail navigation, Back behavior.

**Delayed VOR/Pending Issue:** KPI counts, pagination, filters, ageing/category mapping, export.

**Engine & Breaker:** access, equipment number, entry/edit/completion flow, Excel import, report output.

**Credit Dispatch:** status transitions, customer balance/ledger/aging, correction/resubmit, reports.

---

## 22. Supabase deployment discipline

Supabase migrations and Edge Functions are not automatically safe merely because frontend code compiles.

Historical deployment commands included:

```bash
supabase db push
supabase functions deploy create-order-action
supabase functions deploy update-portal-user
```

Only run/deploy the migrations/functions actually changed.

Before any production DB change:

- inspect migration SQL;
- confirm whether it alters RLS, grants, production rows, constraints, or columns;
- avoid destructive migration patterns;
- make changes idempotent where feasible;
- confirm frontend compatibility with existing rows.

---

## 23. Hosting/deployment

The project history has used/mentioned both Cloudflare deployment and Vercel production deployment. Recent repository history in August 2026 includes an explicit **Vercel production deployment trigger**.

Do not assume the deployment platform from memory. Inspect current repository config and the user's current request before changing hosting configuration.

After deployment, hard refresh/cache invalidation has been necessary for some frontend fixes.

---

## 24. Git workflow

Repository:

```text
antnish1/Parts
```

Default branch:

```text
main
```

Historical work has sometimes been committed directly to `main`, and other work has been merged via `agent/*` branches/PRs.

For future agent work:

- inspect current branch and repo state first;
- do not overwrite unrelated work;
- prefer focused commits;
- for larger/riskier changes, use a feature/`agent/*` branch and PR unless the user explicitly wants direct `main` changes;
- if another colleague is working on a feature branch, preserve their branch and use preview deployment/testing before merge;
- never force-push or rewrite shared history without explicit approval.

---

## 25. Known important files

This list is not exhaustive, but future agents should inspect these first when relevant:

```text
app/src/routes/AppRouter.tsx
app/src/layouts/AppLayout.tsx
app/src/features/orders/NewOrderPage.tsx
app/src/features/orders/OrderDetailPage.tsx
app/src/features/orders/OrderDataCorrectionPage.tsx
app/src/features/tracking/TrackOrdersPage.tsx
app/src/features/tracking/DelayedVorPage.tsx
app/src/features/tracking/PendingIssueOrdersPage.tsx
app/src/features/approvals/ApprovalsPage.tsx
app/src/features/manager/ManagerDashboardPage.tsx
app/src/features/installations/InstallationListPage.tsx
app/src/features/installations/NewInstallationPage.tsx
app/src/features/installations/InstallationDetailPage.tsx
app/src/features/credit-dispatch/
app/src/services/testPart.service.ts
app/src/services/testMachine.service.ts
app/src/components/ui/GlobalStatusEffects.tsx
app/src/components/ui/FeedbackModal.tsx
app/src/components/tables/ResponsiveTableEffects.tsx
app/src/mobile-parts-builder-fix.css
supabase/functions/create-order-action/index.ts
supabase/functions/update-portal-user/
supabase/migrations/
docs/Parts_Connect_Portal_Handover.md
```

Always confirm current paths because code may have moved.

---

## 26. Historical fixes that must not be accidentally reversed

These are specifically worth preserving unless current code proves they were intentionally superseded:

- production `part_master` lookup instead of deprecated test part master source;
- production `machine_master` lookup and missing machine/customer insertion workflow;
- missing machine save failure not unnecessarily blocking order creation;
- backend part lookup rather than preloading all Parts Master data;
- Customer Name and Part Description read-only on New Order;
- immediate Submit Order loader;
- no duplicate success/error popups;
- compact New Order UI;
- U/W and B/W machine type values;
- universal search routing into Track Orders;
- table rows clickable without redundant View buttons;
- Back returns to actual previous page/state;
- manager sidebar pending approval count;
- manager Approvals has no direct Approve/Reject buttons in list;
- separate manager review page;
- manager quantity edits accepted in one **Accept Edits** action;
- **Approve Original Qty** alternative retained;
- mobile New Order parts builder label/value overlap fixed;
- global mobile layout improvements retained;
- correct label **Delayed VOR**;
- clean inline statuses rather than button-like status badges;
- Pending Issue pagination/KPI/export fixes;
- Engine & Breaker equipment number/import/date/description fixes;
- current CI/build patch chain retained unless deliberately migrated.

---

## 27. When the user asks for a new change

Use this sequence:

1. Read `AGENTS.md`.
2. Pull/inspect latest `main` or current target branch.
3. Read the target feature and relevant service/Edge Function.
4. Search recent commits for the feature name to understand why existing code looks the way it does.
5. Check relevant `app/scripts/apply-*.cjs` transforms.
6. Identify role/workflow/database/mobile impact.
7. Implement the smallest robust change.
8. Build/test.
9. Test affected workflow at desktop + mobile.
10. If product rules changed, update `AGENTS.md` in the same change.

---

## 28. Things an agent must NOT do by default

- Do not switch the project back to the root legacy HTML app.
- Do not preload all `part_master` rows for New Order lookup.
- Do not make Customer Name or Part Description freely editable in the main New Order form.
- Do not add direct manager Approve/Reject controls back into the approvals list.
- Do not force a manager to save each edited quantity one row at a time.
- Do not add redundant View buttons to order tables if row-click opens the detail.
- Do not hardcode Back to a fixed page when history/navigation state is available.
- Do not rename Delayed VOR casually.
- Do not replace informational statuses with oversized action-style badges.
- Do not migrate test/staging tables to production counterparts by assumption.
- Do not perform destructive production migrations without explicit instruction.
- Do not remove patch scripts just to make the repository look cleaner.
- Do not ignore mobile layout.
- Do not commit secrets.
- Do not silently change workflow statuses or role permissions.

---

## 29. Documentation maintenance rule

This file is intentionally mandatory and should evolve with the portal.

Whenever a future agent completes a change that alters any of the following, update the relevant section here:

- production/staging table boundaries;
- role permissions;
- order/approval lifecycle;
- quantity semantics;
- route structure;
- deployment platform;
- New Order lookup/submit behavior;
- mobile navigation/table strategy;
- major module names;
- irreversible migration requirements.

Keep detailed implementation notes in normal docs/PRs, but keep the **durable product rules and safety boundaries here**.

---

## 30. First message for future agents

A future agent entering this repository should act as though it has received this instruction:

> Read `/AGENTS.md` completely before making any change. Work in the React app under `app/`, preserve established workflows, inspect recent commits and patch scripts before editing, treat production Supabase data carefully, and validate all affected roles on both desktop and mobile. If the user's new instruction conflicts with this file, the user's latest explicit instruction wins and `AGENTS.md` should be updated with the new durable rule.
