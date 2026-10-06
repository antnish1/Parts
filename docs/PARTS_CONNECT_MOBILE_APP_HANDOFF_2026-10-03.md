# Parts Connect Portal → Native Android Mobile App
## Comprehensive AI Agent Handoff
**Last updated:** 03 October 2026  
**Repository:** `antnish1/Parts`  
**Existing web portal:** `https://parts-3s6.pages.dev/`  
**Mobile implementation branch:** `agent/expo-android-foundation`  
**Pull Request:** `#126 — Build native Expo Android operational workflows`  
**PR state at handoff:** OPEN · DRAFT · MERGEABLE · NOT MERGED  
**Current PR head:** `c1daedeb786c348ab41e8e0f37fc90db96f5852e`  
**Base:** `main` at `5c115448ac038dc7f08f7667a61d34bd073b430c`

---

# 1. Purpose of this handoff

This document is intended to let a new AI coding agent continue the Parts Connect native mobile-app conversion **without needing the previous conversation**.

The user’s objective is to convert the existing Parts Connect web portal into a **real Expo / React Native Android app**, not a WebView, while preserving:

- the existing web portal,
- the existing Supabase backend,
- current workflow semantics,
- existing RLS / RPC / Edge Function security,
- role-based access,
- branch scoping,
- auditability,
- and existing production behavior.

The mobile app is being built **in parallel** under `mobile/`.

The existing React/Vite web portal under `app/` must remain functional and must not be casually modified during the mobile conversion.

---

# 2. Non-negotiable operating rules

The next AI agent must follow these rules.

## Git / PR rules

1. Continue on:
   - branch: `agent/expo-android-foundation`
   - PR: `#126`

2. **Do not merge PR #126** unless the user explicitly asks to merge.

3. Always run / verify required GitHub Actions checks before any merge.

4. Required checks:
   - **App CI**
   - **Mobile CI**

5. If either check fails:
   - inspect the real failure log,
   - fix the deterministic cause,
   - push another commit,
   - rerun / wait for checks,
   - do not merge with failed checks.

6. Preserve the existing web portal. The mobile app should normally change only:
   - `mobile/**`
   - mobile-specific CI files if required.

## Build / APK rules

**Do not create an APK or AAB unless the user explicitly asks for a build.**

The current mobile CI performs Expo Android bundle/export validation only. It is not intended to create an installable APK/AAB.

Do not introduce automatic APK/AAB generation.

## Database / backend rules

Do not add migrations merely to make the mobile UI easier.

Use the existing production backend contracts wherever possible:

- Supabase RLS
- RPCs
- Edge Functions
- storage buckets
- existing tables

The backend remains authoritative for protected workflow changes.

Do not duplicate sensitive workflow state transitions with direct client-side mutations where a protected RPC / Edge Function already exists.

## UX direction

The user wants a proper operational Android application:

- compact,
- mobile-first,
- fast,
- touch-friendly,
- minimum ~48dp actionable targets where practical,
- native camera / date / document interactions,
- clear status cards,
- role-aware actions,
- pull-to-refresh,
- minimal unnecessary text,
- operational information visible quickly,
- no desktop-table-first layouts transplanted blindly onto mobile.

---

# 3. Repository architecture

Current high-level structure:

```text
Parts/
├── app/                 # Existing React/Vite web portal
├── mobile/              # New Expo / React Native Android client
│   ├── app/             # Expo Router screens/routes
│   ├── src/
│   │   ├── auth/
│   │   ├── components/
│   │   ├── lib/
│   │   ├── services/
│   │   ├── theme/
│   │   └── types/
│   ├── app.json
│   ├── package.json
│   └── tsconfig.json
├── supabase/            # Existing backend migrations/functions
├── docs/
├── AGENTS.md
└── .github/workflows/
```

The intended long-term architecture remains:

```text
web app (app/)
       \
        → shared Supabase backend
       /
native mobile app (mobile/)
```

A future `shared/` pure-TypeScript domain layer may be useful, but do not introduce a large refactor unless it materially reduces duplication and remains low-risk.

---

# 4. Current mobile technical stack

The mobile app currently uses approximately:

- Expo SDK `~57.0.26`
- Expo Router `~57.0.21`
- React Native `0.86.0`
- React `19.2.3`
- TypeScript `~5.9.2`
- Supabase JS
- TanStack Query
- Expo Secure Store
- Expo Camera
- Expo Document Picker
- Expo File System
- React Native Community DateTimePicker
- Safe Area Context
- React Native Screens

Current relevant package versions in `mobile/package.json`:

```json
{
  "@react-native-community/datetimepicker": "9.1.0",
  "@supabase/supabase-js": "^2.46.1",
  "@tanstack/react-query": "^5.59.16",
  "expo": "~57.0.26",
  "expo-camera": "~57.0.6",
  "expo-document-picker": "~57.0.3",
  "expo-file-system": "~57.0.7",
  "expo-router": "~57.0.21",
  "expo-secure-store": "~57.0.4",
  "expo-status-bar": "~57.0.1",
  "react": "19.2.3",
  "react-native": "0.86.0",
  "react-native-safe-area-context": "~5.6.2",
  "react-native-screens": "~4.26.0",
  "react-native-url-polyfill": "^2.0.0"
}
```

Current mobile check command:

```bash
npm run typecheck && expo export --platform android --output-dir dist-check
```

---

# 5. Authentication and identity

Mobile authentication is already implemented.

## Auth behavior

- Supabase Auth
- secure persisted sessions through Expo Secure Store
- automatic session refresh
- existing legacy User ID behavior preserved:
  - a login entered without `@` becomes:
    `userid@portal.local`

## Profile source

The mobile app resolves the portal profile from `portal_profiles`.

Primary lookup:
- `auth_user_id`

Fallback:
- `legacy_user_id`, inferred from the `@portal.local` email alias

Current user context includes:
- profile ID
- full name
- branch
- role
- active state

Do not replace this with a separate mobile user system.

---

# 6. Current portal roles

Known roles:

- `branch`
- `admin`
- `super`
- `manager`
- `viewer`
- `developer`
- `hq`
- `accounts`

Important role constraints:

## Accounts
Accounts should remain tightly scoped.

Accounts mobile navigation should expose:
- TA/DA Receipts
- Credit Dispatch / Accounts review

Accounts should **not** receive unrelated operational tools such as Part Location Finder by default.

## Manager / Developer
Order Data Correction is restricted to:
- Manager
- Developer

## Admin / Developer
Admin approved-order processing is restricted to:
- Admin
- Developer

## Super / Manager / Developer
Approval queue access.

Server authorization remains authoritative even if UI visibility is role-filtered.

---

# 7. Mobile navigation model

Primary bottom navigation:

```text
Home | Work | Search | Activity | More
```

`Work` is role aware.

Implemented role navigation includes operational links such as:

- New Order
- Track Orders
- Approval Queue
- Docket Scanner
- Credit Dispatch
- TA/DA
- Engine & Breaker

The latest operations phase also introduced links / screens for:
- Pending Issue
- Part Location
- Delayed VOR
- Admin Approved Orders
- Order Data Correction

Check `mobile/src/auth/roleNavigation.ts` before adding new links.

---

# 8. Current implementation progress

A realistic project status at this handoff:

## Overall conversion

**Approximately 65–70% of the planned mobile conversion is implemented.**

However, the newest phase is not yet fully CI-verified due to one TypeScript issue described later.

A reasonable breakdown:

- ~65–70% implemented
- ~60–65% fully verified through successful CI
- remaining work is mostly:
  - dashboards,
  - uploads,
  - reporting,
  - remaining Credit Dispatch flows,
  - developer tools,
  - full activity history,
  - mobile hardening,
  - device testing,
  - controlled release build.

---

# 9. Completed / implemented modules

## 9.1 Expo Android foundation — COMPLETE

Implemented:

- Expo Router
- native app shell
- secure Supabase sessions
- role-aware navigation
- TanStack Query
- shared theme tokens
- mobile CI
- Android bundle/export validation

---

# 10. Orders

## 10.1 New Order — IMPLEMENTED

Route:
- `/orders/new`

Current behavior:

- branch-oriented order creation
- order types such as:
  - VOR
  - SOP
  - ZSPL
  - ZMAC
  - LUBES
- order target:
  - Customer
  - Stock
- VOR forces Customer
- approver selection
- machine lookup
- customer lookup / capture
- customer is read-only after successful fetch
- machine type handling
- Call ID
- multiple line items
- part lookup
- DNP
- part categories
- live In Transit quantity
- quantity
- line value
- total order value
- duplicate part prevention
- whole-number quantity validation
- create through existing `create-order-action`

Important semantic note:

The web portal’s old “30D qty” behavior was superseded by live **In Transit** quantity logic. Mobile follows the current backend contract.

---

## 10.2 Track Orders — IMPLEMENTED

Route:
- `/orders`

Native list with role/branch-aware visible orders.

---

## 10.3 Order Detail — IMPLEMENTED, PARTIAL DEPTH

Route:
- `/orders/[orderId]`

Implemented:

- order header
- branch
- machine
- customer
- type
- totals
- item cards
- qty / edited qty
- DNP
- billed info
- processing reference
- processed date
- final order number
- DBMS invoice
- docket
- transport
- received date

Still incomplete:

- full audited event timeline
- comments
- attachments
- deeper item dispatch / receipt history
- role-specific quick actions from detail

---

# 11. Approvals

## Approval Queue — IMPLEMENTED

Routes:
- `/approvals`
- `/approvals/[orderId]`

Roles:
- Super
- Manager
- Developer

Implemented:

- assigned approval queue
- line quantity editing
- `Accept Edits`
- `Approve Current Qty`
- `Approve Original Qty`
- rejection
- Super → Manager workflow
- Manager final approval stage
- protected existing functions:
  - `order-item-qty-action`
  - `approval-qty-review-action`
  - `approval-order-action`

Do not bypass these functions with direct protected status updates.

---

# 12. Docket Scanner

Route:
- `/docket`

Status: IMPLEMENTED

Features:

- native Expo Camera
- camera permission
- barcode scanning
- torch control
- duplicate-scan suppression
- manual docket search
- matched row cards
- Mark Received
- Receive All
- confirmation flow
- existing `docket-receive-action`

Current known future polish:
- optional haptic / sound feedback

---

# 13. Credit Dispatch

## 13.1 Credit Dispatch list — IMPLEMENTED

Route:
- `/credit-dispatch`

Roles currently include:
- branch
- accounts
- manager
- admin
- super
- developer

Native KPI groups include:

- Pending approval
- Overdue
- Pending payment
- Rejected
- Closed
- Correction
- All

Existing business flow:

```text
Branch
  ↓
Pending Accounts Approval
  ↓
Pending Manager Approval
  ↓
Approved
  ↓
Payment / Recovery
```

Final rejections:
- Rejected by Accounts
- Rejected by Manager

Corrections:
- Correction Requested by Accounts
- Correction Requested by Manager

Manager correction must restart through Accounts.

---

## 13.2 Credit Dispatch detail — IMPLEMENTED

Features:

- credit amount
- received amount
- balance
- workflow visual
- request fields
- corrections / rejection messages
- Accounts review
- Manager review
- Approve
- Correction Required
- Reject
- mandatory reason where required
- payment list
- activity/event list
- comments

Protected review RPC:
- `portal_review_credit_dispatch`

### Comment attribution

A previously found issue was fixed.

Mobile Credit comments now resolve the active portal profile and set:

```text
created_by = portal profile id
```

Do not regress this.

---

## 13.3 Credit Dispatch remaining work

Still NOT complete:

- New Credit Dispatch form
- customer lookup / customer master selection
- customer signature capture
- issuer signature capture
- mobile-native signature canvas
- correction edit/resubmission
- adding payments from mobile
- Credit Customers
- Customer profile
- Credit Aging
- Credit Ledger
- Credit Reports
- signed signature preview / viewing

The user expects **real signatures**, not a text field substitute.

---

# 14. TA/DA

## TA/DA list — IMPLEMENTED

Route:
- `/ta-da`

Roles:
- branch
- manager
- hq
- developer
- accounts

Role-prioritized counters are implemented.

---

## New TA/DA Dispatch — IMPLEMENTED

Route:
- `/ta-da/new`

Behavior:

- branch office locked for branch users
- broader branch selector for manager/HQ/developer
- engineers from portal service engineer data
- SVR number
- engineer
- Date From
- No. of Days
- Date To
- machine
- customer
- inclusive date/day synchronization
- native date picker
- duplicate SVR prevention
- multiple packet cards
- dispatch date
- dispatched by
- mode:
  - Bus
  - Transport
  - By Hand
- reference required where applicable
- protected RPC:
  - `portal_create_tada_dispatch`

---

## TA/DA detail / receipt — IMPLEMENTED

Route:
- `/ta-da/[dispatchId]`

Custody chain:

```text
Branch → HQ → Accounts
```

Implemented:

- SVR cards
- Manager/Developer HQ receipt
- Accounts/Developer Accounts receipt
- eligible items checked by default
- unchecking requires reason
- optional remark
- partial receipt preservation
- protected RPC:
  - `portal_receive_tada_dispatch`
- sticky action bar
- traceability section

Remaining TA/DA work:
- Developer edit/delete override UI, only if safely backed by existing audited backend contracts

---

# 15. Engine & Breaker

This phase was fully implemented and had previously passed both Mobile CI and App CI.

## Routes / workflow

Conceptual lifecycle:

```text
Invoice Intake
   ↓
Invoice → Registration
   ↓
PENDING
   ↓
Branch Completion
   ↓
ACCEPTANCE_PENDING
   ↓
Service CRM Acceptance
   ↓
ACCEPTED
```

---

## 15.1 Register list — IMPLEMENTED

Features:

- Pending KPI
- Acceptance Pending KPI
- Accepted KPI
- All
- search
- native cards
- role-aware access

---

## 15.2 Invoice Intake — IMPLEMENTED

Fields:

- Invoice Date
- JCB Invoice No.
- Part No.
- description
- Engine / Rock Breaker
- Serial No.
- DBMS No.
- JCB Invoice document

Part lookup uses existing part data.

Native file selection uses Expo Document Picker.

---

## 15.3 Invoice → Register — IMPLEMENTED

Invoice context is carried forward.

Existing invoice information reused:

- JCB Invoice No.
- Part
- Description
- Equipment Type
- Serial
- DBMS No.
- JCB Invoice document

Registration mainly asks for:
- Branch
- Customer
- Quantity

Do not require the user to upload the same JCB invoice again.

---

## 15.4 Installation detail — IMPLEMENTED

Shows:

- entry
- customer
- branch
- invoice
- equipment
- DBMS data
- parts
- required documents
- registration
- workflow state

---

## 15.5 Documents — IMPLEMENTED

Required types:

- `JCB_INVOICE`
- `DBMS_INVOICE`
- `SVR`

Storage bucket:
- `installation-documents`

Allowed file types:
- PDF
- JPEG
- PNG
- WEBP

Current max:
- ~15 MB

Some image clarity validation also exists.

Existing signed URLs are used to securely open private documents.

---

## 15.6 Branch Completion — IMPLEMENTED

Requires:

- Equipment No.
- JCB Invoice No.
- DBMS Invoice No.
- SVR No.
- required documents

Protected RPC:
- `portal_submit_installation_entry`

---

## 15.7 Service CRM Acceptance — IMPLEMENTED

Designated profile:

```text
INSTALLATION_SERVICE_CRM_PROFILE_ID
= 9f3c378e-89d4-4427-87f2-c66061dbf3e2
```

Final action:
- Equipment Registration No.

Protected RPC:
- `portal_accept_installation_entry`

---

# 16. Part Location

Latest phase: IMPLEMENTED on current PR head, but current head still has Mobile CI failure elsewhere.

Backend:
- `part-location-action`

Supported operations:
- lookup
- suggest
- add
- deactivate

The mobile implementation must preserve protected backend actions rather than direct unguarded writes.

Important prior web rule:
- Accounts should not see Part Location Finder.

---

# 17. Pending Issue

Latest phase: IMPLEMENTED on current PR head.

Important: Pending Issue logic must stay aligned with web.

Do not simplify it to just `portal_orders.status`.

The web/mobile logic considers:

- original qty
- edited qty
- billed qty
- billing chunks
- received qty
- row status
- approval status
- legacy status
- partial dispatch
- partial receipt
- final receipt
- legacy issued rows

Relevant mobile shared logic:
- `mobile/src/lib/orderLogic.ts`

Key helpers include concepts equivalent to:
- `getEffectiveQty`
- `getEffectiveValue`
- `getBilledQty`
- `getReceivedQty`
- `getPendingQty`
- `getResolvedRowStatus`
- `getOrderStatusLabel`

Pending Issue should only surface orders that meet the current resolved RECEIVED / not-issued semantics used by the portal.

---

## Mark Issued — IMPLEMENTED

Protected RPC:
- `mark_portal_order_issued`

Document types historically used:
- DC
- Tax Invoice
- PI
- Manual
- Warranty Claim

Do not directly set issued status if the RPC is available.

---

# 18. Delayed VOR

Latest phase: IMPLEMENTED.

Definition inherited from web:

- order type = VOR
- at least one item resolves to:
  - PROCESSED
  - PARTIALLY DISPATCHED

Aging buckets:

- Today
- 1–2 days
- 3–5 days
- >5 days

Aging is based on processed date.

The item resolved status must use billing-driven logic, not merely the raw order header status.

---

# 19. Admin Approved Orders / Processing

Latest phase: IMPLEMENTED.

Roles:
- Admin
- Developer

Queue:
- approved orders ready for processing

Backend:
- `admin-order-action`

Supported protected actions include:

- `process`
- `reject`
- legacy `issue`

Important validations in existing backend/service:

- final order / DBMS order number required for processing
- final order number cannot equal temporary portal order number
- duplicate final order number must be rejected
- only approved orders can be processed
- only active admin/developer can perform admin processing

Do not reimplement these only in the UI; backend remains authoritative.

---

# 20. Order Data Correction

Latest phase: CORE MOBILE VERSION IMPLEMENTED.

Allowed roles:
- Manager
- Developer

Backend:
- `order-data-correction-action`

Existing full web correction backend supports:

- update order
- update item
- create item
- update billing
- create billing
- delete item
- delete billing

The first Android correction implementation is intentionally narrower.

Current design goal:
- audited corrections
- review before save
- correction category
- mandatory reason
- optional reference
- optimistic conflict protection where supported

The Android first pass should favor:
- safe header edits
- safe item edits

Do **not** casually expose destructive create/delete billing operations until the mobile workflow and confirmation UX have been reviewed.

---

# 21. Latest PR / commit state

At the time of this handoff:

```text
PR: #126
State: OPEN
Draft: YES
Merged: NO
Mergeable: YES

Head:
c1daedeb786c348ab41e8e0f37fc90db96f5852e

Commits: 7
Changed files: 60
Additions: 3341
Deletions: 0
```

PR title:
- `Build native Expo Android operational workflows`

The PR description is **out of date**.

It still says the verified head is:

```text
536caa8367b30aa4512dd6ddd2c597111ca1b8d0
```

The next agent should update the PR description after the current Mobile CI issue is fixed and both checks are green.

---

# 22. CURRENT CI STATUS — CRITICAL

## App CI

Latest current operations commit:

```text
c1daedeb786c348ab41e8e0f37fc90db96f5852e
```

**App CI: PASSED**

This means the existing web portal build remains healthy on the PR merge test.

---

## Mobile CI

**Mobile CI: FAILED**

This is the immediate blocker.

Workflow:
- Mobile CI run #14
- job: `check`

Failure happens during:

```bash
npm run check
```

specifically:

```bash
tsc --noEmit
```

Exact TypeScript error:

```text
src/services/operations.ts(23,71): error TS2352:
Conversion of type 'GenericStringError[]' to type 'Record<string, unknown>[]'
may be a mistake because neither type sufficiently overlaps with the other.
If this was intentional, convert the expression to 'unknown' first.

Type 'GenericStringError' is not comparable to type 'Record<string, unknown>'.
Index signature for type 'string' is missing in type '{ error: true; } & String'.
```

The failing area is in:

```text
mobile/src/services/operations.ts
```

Function:

```ts
async function scopedOrders(select: string) {
  const profile = await getCurrentPortalProfile();
  if (!profile?.is_active) return [] as Record<string, unknown>[];
  let query = supabase
    .from('portal_orders')
    .select(select)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (profile.role === 'branch') {
    query = query.eq('branch', profile.branch ?? '__NO_BRANCH_SCOPE__');
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []) as Record<string, unknown>[];
}
```

Because `select` is a runtime string, newer Supabase typing infers a possible generic string error rather than a row structure.

## Recommended first fix

The next agent should make this type conversion explicit and safe, for example by typing the helper result or casting through `unknown`, such as conceptually:

```ts
return (data ?? []) as unknown as Record<string, unknown>[];
```

A cleaner alternative is to make the helper generic / constrain the result type.

Do not blindly suppress TypeScript globally.

After fixing:

1. commit the fix on `agent/expo-android-foundation`
2. verify Mobile CI
3. verify App CI
4. only then call the latest phase CI-green

---

# 23. CI history

Important recent verified point:

Commit:

```text
536caa8367b30aa4512dd6ddd2c597111ca1b8d0
```

Engine & Breaker phase:

- Mobile CI ✅
- App CI ✅

Therefore, the Expo SDK / document picker / file system additions themselves were previously validated.

The current failure at `c1daede...` is a deterministic TypeScript typing issue introduced by the operations service, not a general Expo/build failure.

---

# 24. Current mobile services / important files

Important mobile files include:

```text
mobile/src/auth/AuthProvider.tsx
mobile/src/auth/roleNavigation.ts
mobile/src/components/MetricCard.tsx
mobile/src/components/Screen.tsx
mobile/src/components/StatusChip.tsx
mobile/src/lib/queryClient.ts
mobile/src/lib/supabase.ts
mobile/src/lib/orderLogic.ts

mobile/src/services/profile.ts
mobile/src/services/orders.ts
mobile/src/services/newOrder.ts
mobile/src/services/approvals.ts
mobile/src/services/docket.ts
mobile/src/services/creditDispatch.ts
mobile/src/services/tada.ts
mobile/src/services/installations.ts
mobile/src/services/operations.ts
```

The latest operations work is concentrated around:

```text
mobile/src/services/operations.ts
```

and the corresponding new route screens.

Before inventing a new service, inspect whether the latest phase already created a reusable method in this file.

---

# 25. Current backend contracts used by mobile

## Orders
- `create-order-action`

## Approvals
- `order-item-qty-action`
- `approval-qty-review-action`
- `approval-order-action`

## Docket
- `docket-receive-action`

## Credit Dispatch
- `portal_review_credit_dispatch`
- existing credit tables / RLS

## TA/DA
- `portal_create_tada_dispatch`
- `portal_receive_tada_dispatch`

## Engine & Breaker
- `portal_create_installation_invoice`
- `portal_create_installation_from_invoice`
- `portal_submit_installation_entry`
- `portal_accept_installation_entry`

## Part Location
- `part-location-action`

## Pending Issue
- `mark_portal_order_issued`

## Admin Orders
- `admin-order-action`

## Order Correction
- `order-data-correction-action`

## Part lookup
- `lookup-part-action`

Prefer these existing contracts over new duplicate APIs.

---

# 26. Important workflow semantics that must not regress

## Order quantities

Use effective quantity logic:

```text
edited_qty if present
otherwise original qty
```

Similar rule for effective value.

## Billing-driven status

An item’s actual operational status may depend on:

- effective quantity
- billed quantity
- received quantity

Examples:
- no billed qty → Processed
- partial billed → Partially Dispatched
- billed >= effective qty → Dispatched
- partial received → Partially Received
- received >= qty → Received

Raw header status is not always sufficient.

---

# 27. Current role / workflow summary

## Branch

Expected primary mobile work:
- New Order
- Track Orders
- Pending Issue
- Docket
- Part Location Finder
- Engine & Breaker where branch is eligible
- Credit Dispatch
- TA/DA

## Admin

Expected:
- Track Orders
- Approved Orders / processing
- Docket
- Engine & Breaker
- Credit Dispatch
- possibly Part Location management depending existing web rule

## Super

Expected:
- approval queue
- track orders
- docket
- installations
- credit

## Manager

Expected:
- manager approvals
- track orders
- delayed VOR / operational monitoring
- Order Data Correction
- manager dashboard later
- docket
- installations
- credit
- TA/DA

## Viewer

Expected read-only:
- track orders
- installations where allowed
- reports later

## Developer

Privileged:
- approval queue
- track orders
- correction
- admin processing where backend allows
- docket
- installations
- credit
- TA/DA
- future Developer Workspace

## HQ

Expected:
- Track Orders
- Engine & Breaker
- TA/DA

## Accounts

Expected:
- TA/DA Receipts
- Credit Dispatch Accounts review

Keep Accounts isolated from unrelated menus.

---

# 28. Remaining planned phases

The user has explicitly asked to continue implementation in planned phases.

After fixing the current Mobile CI error, the recommended next phases are:

---

## Phase A — Management + Uploads + Reports

Priority:

1. Manager Dashboard
2. Inventory Upload
3. Dealer Price List
4. General Uploads
5. Reports

### Manager Dashboard

Need to inspect the existing web implementation and reproduce only useful mobile summaries, not desktop tables.

Likely mobile concepts:
- compact branch cards
- order KPIs
- VOR aging
- approval aging
- pending operational tasks
- tap-through to actual work queues

### Inventory Upload

Preserve:
- existing upload action
- validation
- safe data handling
- progress / result feedback

Avoid allowing mobile direct table writes if web uses a protected upload action.

### Dealer Price List

Existing project has staged safe snapshot behavior.

Inspect current implementation before porting.

Do not replace a staged workflow with direct destructive overwrite.

### Reports

Mobile reports should be intentionally compact.

Focus on:
- KPIs
- trend cards
- actionable summaries
- drill-down
- small charts where useful

Do not port huge desktop tables as-is.

---

## Phase B — Complete Credit Dispatch

Remaining:

1. New Credit Dispatch
2. credit customer selection / creation
3. native signature capture
4. issuer signature
5. customer signature
6. correction edit / resubmit
7. add payment
8. credit customers
9. aging
10. ledger
11. reports

Important Credit rule:

```text
Branch
→ Accounts
→ Manager
→ Approved
→ Payment Recovery
```

Manager correction restarts Accounts.

Manager cannot bypass Accounts approval.

---

## Phase C — Developer / Traceability / Deep Order Operations

1. Developer Workspace
2. full order activity timeline
3. comments
4. attachment history
5. deeper item dispatch / receipt history
6. safe developer override actions where backend already audits them
7. TA/DA developer correction tools if needed

Do not introduce unaudited overrides.

---

## Phase D — Mobile hardening

After functional parity is sufficiently complete:

- real-device Android testing
- keyboard behavior
- back-button behavior
- safe-area review
- camera permission denial/recovery
- document picker cancellation
- slow network states
- pull-to-refresh
- error states
- session expiry
- branch/role access tests
- large list performance
- mobile memory usage
- screen-reader/accessibility basics
- empty states
- offline/read-only caching where safe
- crash protection

Protected workflow mutations should not silently queue offline unless designed carefully.

---

## Phase E — Controlled Android release

Only when the user explicitly requests it:

1. internal test build
2. device testing
3. release configuration
4. signing
5. versioning
6. AAB
7. staged production rollout

Do not automatically build APK/AAB beforehand.

---

# 29. Mobile UI philosophy

Follow the current design direction:

- white cards
- navy primary action color
- compact spacing
- high information density without clutter
- small labels
- clear large operational values
- horizontal KPI scrolling where appropriate
- mobile lists/cards instead of wide tables
- sticky important actions
- role-relevant screens only

Existing tokens:

```text
navy
navySoft
blue
blueSoft
background
surface
surfaceMuted
border
text
textMuted
success
warning
danger
info
```

Reuse `mobile/src/theme/tokens.ts`.

Do not create inconsistent one-off color systems unless needed for status semantics.

---

# 30. Search / Activity / Home status

## Home

Implemented but still relatively order-focused.

Future enhancement:
- cross-module action center
- role-specific attention items
- approval / credit / TA/DA / installation counts where useful

Keep it compact.

## Search

Basic global order-oriented search exists.

Future:
- part number
- docket
- customer
- machine
- credit dispatch
- installation number
- SVR

Only expand if it stays fast and understandable.

## Activity

Basic version exists.

Future:
- unified audited activity feed using real backend events
- not a fabricated client-side history

---

# 31. Known current limitations / cautions

1. PR description does not reflect latest `c1daede` phase.
2. Mobile CI currently fails at `operations.ts:23`.
3. App CI is currently green.
4. Latest operations phase is committed but cannot be called fully verified until Mobile CI passes.
5. No APK / AAB exists.
6. No production mobile deployment has occurred.
7. No database migration was added by the mobile implementation.
8. Full Credit Dispatch creation flow is missing.
9. Native signature capture is missing.
10. Manager Dashboard is missing.
11. Reports are missing.
12. Upload workflows are missing.
13. Developer Workspace is missing.
14. Order detail timeline/comments are not fully ported.
15. Current PR is intentionally draft.

---

# 32. Recommended exact first actions for the next AI agent

Do these in order.

## Step 1 — Reconfirm current branch and PR

Verify:

```text
repo: antnish1/Parts
branch: agent/expo-android-foundation
PR: #126
expected current head: c1daedeb786c348ab41e8e0f37fc90db96f5852e
```

If head moved, inspect new commits before changing anything.

---

## Step 2 — Fix the current Mobile CI TypeScript error

File:

```text
mobile/src/services/operations.ts
```

Current error:

```text
TS2352 at line ~23
GenericStringError[] → Record<string, unknown>[]
```

Fix locally/in branch with a type-safe explicit conversion or generic helper.

Do not change runtime behavior.

---

## Step 3 — Commit only the CI fix

Use a small commit, e.g.:

```text
Fix mobile operations query typing
```

Do not mix the CI fix with a new feature phase.

---

## Step 4 — Verify CI

Require:

```text
App CI    ✅
Mobile CI ✅
```

If Mobile CI fails again, inspect exact log.

Do not simply retry deterministic TypeScript failures.

---

## Step 5 — Update PR description

After green checks, update PR #126 so it includes:

- Part Location
- Pending Issue
- Delayed VOR
- Admin Approved Orders
- Admin processing
- Order Data Correction

and update the “Current verified head”.

Keep PR draft unless user says otherwise.

---

## Step 6 — Continue next phase

Recommended next implementation block:

```text
Manager Dashboard
+ Inventory Upload
+ Dealer Price List
+ General Uploads
+ Reports foundation
```

Implement on the same branch unless the user explicitly requests a separate branch/PR.

---

# 33. Suggested implementation discipline for every next phase

For each module:

1. Inspect the current `main` implementation.
2. Read the relevant service.
3. Identify authoritative backend actions.
4. Identify role restrictions.
5. Identify branch scoping.
6. Identify validation.
7. Identify audit events.
8. Design mobile UX around the workflow.
9. Implement service.
10. Implement route/screen.
11. Wire role navigation.
12. Add loading / empty / error states.
13. Run TypeScript.
14. Run Expo Android export.
15. Confirm App CI.
16. Confirm Mobile CI.
17. Update PR description when a meaningful phase is complete.
18. Do not merge unless user asks.

---

# 34. Existing web portal is authoritative reference

When there is a discrepancy between old notes and current behavior, use this precedence:

1. Explicit current user instruction
2. Current code on `main`
3. Current backend RPC / Edge Function / RLS behavior
4. root `AGENTS.md`
5. feature-specific docs / AGENTS files
6. older historical documentation

Do not reproduce behavior solely from old chat memory if current `main` contradicts it.

---

# 35. Production safety

The mobile app currently talks to the same backend model.

Therefore:

- never weaken RLS for mobile convenience,
- never expose service-role keys,
- never place privileged secrets in Expo env,
- only use public anon key client-side,
- rely on authenticated user + RLS + protected server actions,
- do not store passwords,
- keep Supabase session in Secure Store,
- keep private installation documents behind signed URLs.

---

# 36. App release status

Current:

```text
Native Expo app code exists.
Android bundle export has been validated on earlier phases.
No installable production artifact has been intentionally generated.
No Play Store / production mobile deployment exists.
```

Do not claim the app is released.

The correct phrasing is:

```text
The native Android implementation is actively under development in draft PR #126.
```

---

# 37. Current scope completion table

| Area | Status |
|---|---|
| Expo foundation | Complete |
| Authentication | Complete |
| Role navigation | Complete |
| Secure session | Complete |
| New Order | Complete |
| Track Orders | Complete |
| Order Detail | Core complete |
| Approval Queue | Complete |
| Quantity review | Complete |
| Docket Scanner | Complete |
| Credit list/detail/review | Complete |
| Credit comments/activity | Complete |
| New Credit request | Remaining |
| Credit signatures | Remaining |
| Credit payments | Remaining |
| Credit aging/ledger/reports | Remaining |
| TA/DA list | Complete |
| TA/DA create | Complete |
| HQ receipt | Complete |
| Accounts receipt | Complete |
| Engine Invoice | Complete |
| Engine Register | Complete |
| Engine documents | Complete |
| Branch completion | Complete |
| Service CRM acceptance | Complete |
| Part Location Finder | Implemented, latest phase |
| Manage Part Location | Implemented, latest phase |
| Pending Issue | Implemented, latest phase |
| Mark Issued | Implemented, latest phase |
| Delayed VOR | Implemented, latest phase |
| Admin Approved Orders | Implemented, latest phase |
| Admin Process/Reject | Implemented, latest phase |
| Order Data Correction | Core implemented, latest phase |
| Manager Dashboard | Remaining |
| Inventory Upload | Remaining |
| Dealer Price List | Remaining |
| General Uploads | Remaining |
| Reports | Remaining |
| Developer Workspace | Remaining |
| Full Order activity timeline | Remaining |
| Production hardening | Remaining |
| APK/AAB | Not requested / not built |
| Production mobile release | Not started |

---

# 38. Latest CI truth table

| Commit | Phase | App CI | Mobile CI |
|---|---|---:|---:|
| `536caa8367b30aa4512dd6ddd2c597111ca1b8d0` | Engine & Breaker | ✅ | ✅ |
| `c1daedeb786c348ab41e8e0f37fc90db96f5852e` | Part Location + Pending Issue + Delayed VOR + Admin + Correction | ✅ | ❌ TypeScript |

Current Mobile CI failure is believed small and isolated to typing in `operations.ts`.

---

# 39. Key user expectations

The user prefers execution over prolonged planning.

When the user says:
- “continue”
- “implement”
- “create PR”
- “merge”
- “deploy”

the agent should act with the appropriate repo tools rather than only explaining.

However:
- never merge before checks,
- never build APK/AAB unless asked,
- never claim work completed before checking the actual GitHub state.

If a workflow fails:
- inspect logs,
- report exact cause,
- fix it,
- rerun checks.

---

# 40. Handoff summary for the next agent

You are inheriting a native Expo Android conversion of the Parts Connect portal.

The project is **not starting from scratch**.

A substantial operational app already exists in draft PR #126.

The major completed areas are:

```text
Auth
Role shell
Orders
Approvals
Docket
Credit review
TA/DA
Engine & Breaker
Part Location
Pending Issue
Delayed VOR
Admin Processing
Core Data Correction
```

The immediate blocker is:

```text
mobile/src/services/operations.ts
TS2352
line ~23
Supabase runtime select typing
```

Fix that first.

Then ensure:

```text
App CI ✅
Mobile CI ✅
```

Then update PR #126 metadata.

Then proceed to:

```text
Manager Dashboard
→ Uploads
→ Dealer Price / Inventory
→ Reports
→ Complete Credit Dispatch
→ Developer / activity depth
→ Mobile hardening
→ Controlled release only when requested
```

Do **not** merge PR #126 and do **not** create an APK/AAB unless the user explicitly instructs you to do so.

---

# 41. Recommended opening message for the next AI agent

A new agent can begin with something like:

> I’ve reviewed the mobile handoff. I’ll continue from `agent/expo-android-foundation` / PR #126. First I’m going to verify the current head and fix the known Mobile CI TypeScript failure in `mobile/src/services/operations.ts`, then I’ll rerun both App CI and Mobile CI before starting the next planned phase. I will not merge to `main` or create an APK/AAB unless you explicitly ask.

---

**End of handoff**
