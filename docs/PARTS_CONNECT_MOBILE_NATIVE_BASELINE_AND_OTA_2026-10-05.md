# Parts Connect Mobile — Native Baseline and OTA Strategy

**Date:** 05 October 2026  
**Repository:** `antnish1/Parts`  
**Mobile branch:** `agent/expo-android-foundation`  
**PR:** `#126`  
**Expo account:** `insureit_expo`  
**Expo project ID:** `3026af5e-622e-48de-bb4f-1ca851373589`  
**Android package:** `com.frontier.partsconnect`

---

## 1. Why this document exists

This document is the source of truth for future AI agents before creating another Android APK/AAB or changing OTA/EAS Update configuration.

The product goal is to make the next Android binary the **Mobile Native Baseline v1** and include all reasonable native capabilities up front. After that baseline build, normal JavaScript/TypeScript/UI/business-logic changes should be published through **EAS OTA updates whenever runtime-compatible**.

Do not create repeated APK builds for changes that can safely be delivered OTA.

---

## 2. Current important state

The first successful EAS preview APK was built from commit `8968a4452a6808563966259eda8ec59c927e3ca1`.

That APK does **not** contain `expo-updates` and therefore cannot receive EAS OTA updates.

The mobile EAS environment was also initially pointed to the wrong Supabase project. This was corrected in commit `72d7c44a4785bf8ed60157684a4384e83f6dbca3`.

Correct Parts Connect Supabase project:

```text
https://ubkwtjyvbdvepzbxoikq.supabase.co
```

The current intended login behavior must match the web portal:

- User IDs without `@` map to `<userid>@portal.local`
- whitespace is removed from User ID before normalization
- password input must not auto-capitalize or autocorrect
- existing Supabase Auth identities and `portal_profiles` remain authoritative

Example verified user mapping during investigation:

```text
NISHANT -> nishant@portal.local
```

Do not create a separate mobile authentication system.

---

## 3. OTA-first release policy after the next baseline build

After Mobile Native Baseline v1 is installed, prefer OTA for runtime-compatible changes such as:

- screen/UI redesigns
- navigation changes implemented only in JS/TS
- labels/text/copy
- role visibility changes
- validation rules
- Supabase queries and RPC usage
- API calls
- dashboard changes
- reports
- workflow UI changes
- bug fixes
- most bundled images/logos/assets
- business logic that does not add/change native modules
- backend endpoint/config values loaded through JS/runtime-compatible configuration

A new APK/AAB remains necessary whenever native/runtime compatibility changes, including:

- adding or removing a native package
- Expo SDK / React Native upgrade
- changing Android package/application ID
- changing native permissions
- changing AndroidManifest/native config
- changing app icon/adaptive icon
- changing splash screen native configuration
- adding native notification capability not already compiled in
- adding biometric/native device capability not already compiled in
- adding NFC/Bluetooth/background-location/native services
- native deep-link intent configuration changes
- native file-provider/intent configuration changes
- native library upgrades that change the runtime fingerprint

Future agents must explicitly classify a requested change as **OTA-compatible** or **requires new native build** before starting another APK.

---

## 4. Native capabilities to include before Mobile Native Baseline v1

### 4.1 OTA / EAS Update foundation — REQUIRED

Add/configure:

- `expo-updates`
- EAS Updates URL
- `runtimeVersion`
- `preview` update channel for internal APK testing
- production channel strategy for later store builds
- automatic update check on app launch
- safe embedded-bundle fallback
- rollback-safe behavior
- optional in-app update status / restart-to-apply flow

The binary must be verified to report OTA as enabled before treating future work as OTA-first.

### 4.2 Branding / app identity — FINALIZE BEFORE BUILD

Finalize:

- Android app icon
- adaptive icon foreground
- adaptive icon background
- splash screen artwork/layout
- app display name: `Parts Connect`
- Android package: `com.frontier.partsconnect`
- custom URL scheme: `partsconnect://`
- version/versionCode strategy
- notification small icon if push notifications are enabled

### 4.3 Notifications — RECOMMENDED FOR BASELINE

Include native support for:

- `expo-notifications`
- push-token registration capability
- Android notification channels
- foreground/background notification handling
- notification-tap deep links into relevant app screens
- badge handling where supported

Initial product workflows that may later use notifications include order approvals, Credit Dispatch approvals/corrections, TA/DA custody events, delayed VOR/action-required events and operational reminders.

### 4.4 Biometrics — RECOMMENDED FOR BASELINE

Include:

- `expo-local-authentication`
- fingerprint/biometric unlock after a valid first login
- secure token/session remains in `expo-secure-store`

Biometric unlock must never replace backend authentication/authorization.

### 4.5 Media and files — RECOMMENDED FOR BASELINE

Existing native capabilities already include:

- `expo-camera`
- `expo-document-picker`
- `expo-file-system`
- `expo-secure-store`
- `expo-linking`

Recommended additions:

- `expo-image-picker`
- `expo-sharing`

This supports future gallery uploads, evidence/photo selection, document sharing/export, PDF/file sharing and signature/image workflows without introducing another native dependency later.

### 4.6 Device UX — RECOMMENDED FOR BASELINE

Recommended additions:

- `expo-haptics`
- `@react-native-community/netinfo`

Use cases:

- scanner success/error haptic feedback
- approval/receipt confirmation feedback
- online/offline status
- safer retry/error states
- future read-only local cache behavior

### 4.7 Optional native modules — ADD ONLY IF PRODUCT NEED IS CONFIRMED

Do not add permissions/libraries merely because they exist. Avoid unnecessary privacy surface and app size.

Only add later when the product explicitly needs them:

- microphone/audio recording
- Bluetooth
- NFC
- contacts
- SMS
- calendar
- background location
- background audio
- telephony integrations

If any of these become known requirements before the baseline build, include them now; otherwise leave them out.

---

## 5. Native Android configuration to finalize

Before the baseline APK, verify and intentionally set:

- portrait orientation policy
- status bar appearance
- navigation bar appearance
- edge-to-edge / safe-area behavior
- Android keyboard resize behavior
- hardware back-button behavior
- camera permission copy
- notification permission flow
- image/media permission behavior
- biometric availability fallback
- file open/share intents
- deep-link scheme and navigation handling
- app version/versionCode
- update channel/runtime configuration
- release signing handled through EAS credentials

Do not add broad permissions that are not used.

---

## 6. Asset checklist

### Assets the user should provide if exact brand fidelity is required

Preferred source files:

1. **Official Parts Connect / Frontier brand logo**
   - best: SVG or transparent PNG
   - high-resolution source preferred
   - avoid screenshots when possible

2. **Exact app icon concept**, if there is a brand-approved design
   - vector/SVG or large PNG preferred
   - if no approved icon exists, the AI agent may design one from the official logo

3. **Official brand colors**, only if they differ from the existing portal/mobile theme
   - HEX values or brand guideline file

4. **Official splash-screen artwork**, only if a specific marketing/brand composition is required

5. **Notification small-icon artwork**, only if the company has a specific approved monochrome mark

The user does **not** need to provide Android density variants. Those can be generated from a single high-quality source asset.

### Assets the AI agent can generate from supplied brand material

The AI agent can prepare/generate:

- Android adaptive icon foreground PNG
- adaptive icon background color/config
- standard launcher icon
- rounded/icon-safe variants
- splash-screen composition
- splash background
- notification monochrome icon derived from the logo
- store/testing preview artwork if later required
- correctly sized PNG exports from a supplied SVG/high-resolution logo
- dark/light logo variants when design rules permit
- placeholder/default profile/avatar graphics
- simple scanner/empty-state illustrations
- in-app icons using the project's icon library

Any generated branding must be reviewed by the user before the final baseline APK if exact brand fidelity matters.

---

## 7. Recommended asset delivery from user before baseline build

Minimum preferred package from the user:

```text
1. Official logo: SVG or transparent PNG
2. Confirmation whether the app icon should use:
   A. full logo,
   B. initials/monogram,
   C. a dedicated Parts Connect symbol
3. Confirmation of splash preference:
   A. logo centered on brand background,
   B. logo + Parts Connect text,
   C. custom artwork
4. Any mandatory brand HEX colors, if different from the current navy/blue theme
```

If the user provides only the official logo, the AI agent can generate the remaining Android-ready assets and show them for approval before building.

---

## 8. Recommended baseline native package target

In addition to currently installed packages, the preferred baseline includes:

```text
expo-updates
expo-notifications
expo-local-authentication
expo-image-picker
expo-sharing
expo-haptics
@react-native-community/netinfo
```

Before installation, use `npx expo install <package>` / Expo-compatible versions for the current SDK rather than manually guessing versions.

Every added package must pass:

- TypeScript checks
- Expo Android export check
- App CI
- Mobile CI

Do not merge PR #126 unless the user explicitly asks.

---

## 9. Build strategy after baseline

### Preview/internal testing

Use:

```text
EAS profile: preview
Platform: Android
Distribution: internal
Base directory: mobile
```

The next preview APK should be the first OTA-capable baseline.

### After baseline installation

Normal flow:

```text
change code
  -> run checks
  -> publish EAS Update to matching channel/runtime
  -> test OTA on installed baseline APK
```

Do not rebuild an APK solely because JS/TS changed.

### When native code changes

Normal flow:

```text
native dependency/config change
  -> runtime changes
  -> run checks
  -> create new APK/AAB
  -> install/distribute new binary
  -> subsequent compatible changes return to OTA-first
```

---

## 10. Pre-build checklist for future AI agents

Before triggering Mobile Native Baseline v1:

- [ ] Read root `AGENTS.md`
- [ ] Read `mobile/AGENTS.md`
- [ ] Read this document
- [ ] Confirm current branch is `agent/expo-android-foundation`
- [ ] Confirm PR #126 is still not to be merged without explicit user approval
- [ ] Confirm correct Supabase project is `ubkwtjyvbdvepzbxoikq`
- [ ] Confirm login parity with web portal
- [ ] Finalize user-approved app icon/splash assets
- [ ] Install/configure `expo-updates`
- [ ] Configure EAS update URL/runtime/channel
- [ ] Add only the approved/recommended native packages
- [ ] Verify Android permissions
- [ ] Verify notification/biometric/media native config if enabled
- [ ] Run App CI
- [ ] Run Mobile CI
- [ ] Only then trigger the explicitly approved baseline APK build
- [ ] Verify OTA works on the installed baseline before calling OTA-first complete

---

## 11. Core release principle

> **Build native capabilities once; iterate product behavior through OTA whenever compatible.**

A future AI agent should not casually create another APK. First determine whether the requested change can ship through EAS Update. Only rebuild the binary when the native runtime actually changes.


---

## 12. Post-baseline website → Android parity audit and implementation roadmap

**Audit date:** 06 October 2026

### 12.1 New governing rule: OTA-only unless explicitly approved

From this point forward, normal mobile work must be delivered through **EAS OTA updates** whenever the installed native runtime supports the change.

**Do not create a fresh APK/AAB without explicit user approval.**

Before any future build request, the agent must state why the change is not OTA-compatible. UI, TypeScript/JavaScript logic, Supabase query fixes, role workflow parity, icons based on existing native dependencies, SVG illustrations, styling, navigation logic, and normal business-flow corrections should be treated as OTA work.

PR #126 must remain unmerged until the user explicitly asks for merge.

### 12.2 Product objective

The Android app should reach **functional parity with the current Parts Connect web portal**, while remaining genuinely mobile-first rather than copying desktop tables literally.

Parity means:

- the same production Supabase data is visible;
- the same role and branch scope rules are respected;
- the same protected RPC / Edge Function workflow transitions are used;
- Manager / Developer / Super / Admin actions available on web are available in the correct mobile context;
- order/item status derivation matches web logic;
- operational totals and counts match the web portal;
- errors are surfaced explicitly rather than appearing as an empty screen;
- navigation and actions are optimized for touch;
- mobile visual quality should be production/industry grade, with consistent icons, illustrations, spacing, typography, empty states, loading states, confirmations and error recovery.

### 12.3 Evidence-backed critical gaps found in the first audit

#### A. Delayed VOR currently has a deterministic runtime data bug

Mobile implementation:
- `mobile/src/services/operations.ts`
- `mobile/app/orders/delayed-vor.tsx`

The mobile helper `getItemsAndBillings()` currently selects:

```text
id,order_id,part_no,description,qty,edited_qty,value,edited_value,billed_qty,row_status,status,approval_status
```

from `portal_order_items`.

Live production schema verification on 06 October 2026 showed:
- `portal_order_items.status` does **not** exist;
- `portal_order_items.approval_status` does **not** exist.

Therefore both Delayed VOR and Pending Issue can fail before deriving row status. This should be fixed first by matching the web service's real column set and using shared `orderLogic` for resolved statuses.

Additional parity gap:
- web Delayed VOR pages through all VOR item rows;
- mobile first loads at most 1,000 order headers and then derives eligible VOR rows;
- production already contains **1,041 portal orders**, so the mobile 1,000-header cap is already unsafe;
- web derives eligible VOR order IDs directly from all VOR item rows, which is the safer parity model.

Required correction:
1. remove nonexistent item columns;
2. port the web paginated VOR-item strategy;
3. batch billing-chunk reads;
4. resolve row status with the same `getResolvedRowStatus`;
5. load matching order headers after eligible IDs are known;
6. preserve branch/RLS visibility;
7. add visible loading/error/empty states that distinguish “0 results” from “query failed”.

#### B. Pending Issue currently shares the same deterministic item-query failure

Mobile implementation:
- `mobile/src/services/operations.ts`
- `mobile/app/orders/pending-issue.tsx`

The same invalid `portal_order_items.status` / `approval_status` select is reused here.

Web implementation:
- `app/src/services/pendingIssue.service.ts`

The web implementation additionally has parity behavior currently missing or weaker on mobile:
- fetch-all pagination instead of one 1,000-header cap;
- ID batching;
- branch scope through `getCurrentBranchScopeValues()`;
- normalized branch matching through `normalizeBranchKey()`;
- legacy protection so a header whose status is already ISSUED cannot re-enter Pending Issue merely because `issued_at` is null;
- item-level ISSUED terminal protection;
- RECEIVED derivation from item/billing state;
- latest receipt date from billing chunks;
- full export-quality item fields.

Production audit found **487 customer/not-issued header candidates** before item-level RECEIVED resolution, so an empty mobile page is not evidence that there is no candidate data.

Required correction:
1. port the web service logic nearly one-for-one into the mobile service layer;
2. retain the existing protected `mark_portal_order_issued` RPC;
3. verify branch, manager, developer, admin and HQ visibility against the web;
4. show meaningful query errors instead of presenting them as a normal empty state.

#### C. Track Order → Order Detail is much thinner than the web detail page

Current mobile:
- `mobile/app/orders/[orderId].tsx`
- `mobile/src/services/orders.ts`

Current mobile detail loads only basic order metadata and a small item projection:
- part number;
- description;
- DNP;
- original/edited qty;
- billed qty;
- value.

It currently does **not** reproduce the web Order Detail operational workspace.

Missing or incomplete parity includes:
- resolved row status;
- billing/docket chunks per item;
- billed / pending / received quantity derivation;
- inventory by branch;
- In-Transit quantity per part;
- In-Transit contributing-order popup;
- order-level approval actions in context;
- Super approval / forward-to-manager flow;
- Manager final approval / rejection;
- Manager override confirmation behavior where applicable;
- edit quantity review from detail;
- Accept Edits & Approve;
- Approve Original Qty;
- zero/remove-row review action where supported;
- approver information/change workflow where supported;
- complete comments + attachments;
- activity visibility controls;
- richer dispatch fields per item;
- accurate order totals from effective item quantities/values;
- web-equivalent action visibility by role/status.

The mobile detail currently only exposes Manager/Developer **Order Data Correction** and the separate activity screen.

#### D. Order approval is implemented only partially and in the wrong context

Mobile service:
- `mobile/src/services/approvals.ts`

It already uses the correct protected functions for:
- `order-item-qty-action`;
- `approval-qty-review-action`;
- `approval-order-action` rejection.

However, the Track Order detail page does not use these actions.

The mobile approval service also lacks a complete wrapper set matching the web service, including explicit helpers for:
- Super approve;
- forward to Manager;
- Manager approve;
- Manager reject;
- Super reject;
- reset edited quantity;
- zero/remove review row.

The web source of truth is:
- `app/src/services/testApproval.service.ts`
- `app/src/features/approvals/ApprovalsPage.tsx`
- `app/src/features/orders/OrderDetailPage.tsx`

Required correction:
- centralize complete approval actions in the mobile service;
- reuse those same actions from both Approval Queue and Track Order detail;
- never duplicate protected state transitions with direct table updates.

#### E. In-Transit quantity popup is absent from mobile Order Detail

The web detail loads In-Transit quantity separately from inventory and makes positive quantities tappable. The popup lists contributing rows with:
- Branch;
- Type;
- Order No.;
- Date;
- For;
- Status;
- Qty;
- navigation into the contributing order.

Current mobile Order Detail contains no In-Transit query or popup at all.

The mobile parity implementation must port the existing web In-Transit service semantics, including:
- normalized part numbers;
- correct branch calculation scope;
- active/open order status rules;
- exact total quantity parity with web;
- tap-to-open bottom sheet/modal;
- navigation to contributing order;
- clear “0” vs “could not load” states.

### 12.4 Broader parity audit to complete before declaring the app feature-complete

The next agent must build a **web-vs-mobile parity matrix** covering every menu/route, not rely only on whether a mobile screen exists.

For every module compare:
1. data source and selected columns;
2. pagination / batching;
3. branch scoping;
4. role visibility;
5. row/status derivation;
6. protected actions;
7. validations;
8. totals/KPIs;
9. detail fields;
10. comments/activity/audit trail;
11. attachments/files;
12. search/filter/sort behavior;
13. refresh/error/empty states;
14. navigation/back behavior;
15. mobile-specific interaction quality.

Modules to audit:

- Home / role dashboard
- New Order
- Track Orders
- Order Detail
- Approval Queue
- Pending Issue
- Delayed VOR
- Docket Scanner
- Admin Approved Orders
- Order Data Correction
- Part Location Finder / manage
- Manager Inventory / movement
- Credit Dispatch
- Credit Customers
- Credit Aging
- Credit Ledger
- Credit Reports
- TA/DA
- Engine & Breaker
- Reports
- Uploads
- Developer Workspace
- Activity / comments / attachments
- authentication/session/profile behavior

A screen should not be marked “complete” merely because its route renders.

### 12.5 Implementation sequence

#### Phase 1 — Data correctness and broken screens

Priority: **highest**

Fix first:
1. Pending Issue invalid item query + full web parity loader;
2. Delayed VOR invalid item query + paginated VOR derivation;
3. Track Orders / Order Detail data model expansion;
4. explicit runtime error states and retry controls;
5. compare live counts between web and mobile for the same user/role.

Exit criteria:
- same visible record counts as web for controlled test users;
- no silent empty screens caused by query errors;
- branch and role scope verified.

#### Phase 2 — Order Detail and approval parity

Build a mobile-native Order Detail workspace with:
- sticky/contextual action area;
- part cards with status, ordered/effective/billed/pending/received quantities;
- inventory and In-Transit indicators;
- tap In-Transit → bottom sheet with contributing orders;
- expandable billing/docket chunks;
- comments/activity;
- role/status-aware approval card.

Implement complete Super/Manager/Developer approval parity using existing Edge Functions:
- edit qty;
- reset qty;
- Accept Edits & Approve;
- Approve Original Qty;
- forward to Manager;
- Manager approve;
- reject;
- zero/remove review row when permitted;
- manager override confirmation behavior matching web.

Exit criteria:
- an eligible order can be completed from mobile using the same role path as web;
- audit events are equivalent;
- no direct protected-state table writes are introduced.

#### Phase 3 — Remaining module parity

Work module-by-module through the parity matrix.

For each module:
- inspect the current web service/page;
- inspect mobile service/page;
- inspect live schema/RLS/RPC/function contract when behavior is unclear;
- implement missing behavior;
- run controlled role tests;
- update this handoff document with completion state.

Prefer shared pure TypeScript helpers where practical, but do not destabilize the existing web portal with a large refactor.

#### Phase 4 — Professional mobile UI system

The app currently relies heavily on plain text, text arrows and utilitarian cards. Introduce a coherent professional design system.

Recommended icon strategy:
- use **Lucide React Native** with the already-available `react-native-svg` native capability;
- icons/visual changes should remain OTA-compatible;
- define one semantic icon map for navigation/actions/statuses rather than arbitrary icons screen by screen.

Visual system:
- consistent 20–24px navigation icons;
- 16–20px inline/action icons;
- icon + label for high-risk actions;
- consistent success/warning/error/info status iconography;
- avoid emoji as primary operational icons;
- consistent card radii, borders, shadows, spacing and typography;
- compact density suitable for operational use;
- minimum practical touch target around 48dp.

Professional components to standardize:
- `AppHeader`
- `SectionHeader`
- `ActionButton`
- `IconButton`
- `MetricCard`
- `StatusChip`
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `SearchField`
- `FilterChips`
- `BottomSheet / ActionSheet`
- `ConfirmDialog`
- `InfoRow`
- `Timeline`
- `PartCard`
- `OrderCard`

Illustration strategy:
- use purpose-built lightweight SVG/PNG illustrations for empty states such as:
  - no orders;
  - no delayed VOR;
  - no pending issue;
  - no approvals;
  - no search result;
  - no network;
  - upload/document success;
  - scanner guidance;
- retain the Frontier/Parts Connect visual language;
- generated illustrations can be shipped OTA because the installed baseline already contains the native rendering stack needed by the app;
- illustrations must support the workflow rather than becoming decorative clutter.

UX requirements:
- pull-to-refresh on operational lists;
- visible retry action on query failure;
- skeleton/loading state instead of blank content;
- preserve search/filter state when opening and returning from detail;
- hardware/back navigation follows actual history;
- dangerous actions require clear confirmation;
- success should provide immediate feedback (haptic where already compiled + visual confirmation);
- offline/network failure must be distinguishable from “no data”;
- use bottom sheets for mobile detail/actions instead of desktop-style modal/table patterns where appropriate.

#### Phase 5 — Device and role validation

Before declaring parity complete, run physical-device smoke tests for at least:
- Branch
- Super
- Manager
- Developer
- Admin
- Accounts
- HQ where applicable

Test:
- login/session restore;
- network loss and recovery;
- keyboard behavior;
- Android back button;
- camera permission denial/recovery;
- document/image selection;
- approvals;
- Pending Issue;
- Delayed VOR;
- Docket;
- Credit Dispatch;
- TA/DA;
- Engine & Breaker;
- uploads;
- deep navigation between list → detail → action → back.

### 12.6 OTA release discipline for this parity program

For every implementation batch:

```text
inspect web + mobile + backend
  -> implement one coherent parity batch
  -> run Mobile CI
  -> run App CI
  -> controlled role/data check
  -> publish EAS OTA to preview channel
  -> test installed baseline APK
  -> document result
  -> continue to next batch
```

Do **not** create a new APK for these parity/UI batches unless a later requirement genuinely changes native runtime and the user explicitly approves a new build.

### 12.7 First execution batch

Start with this order:

1. Fix **Pending Issue** data loader.
2. Fix **Delayed VOR** data loader.
3. Verify both against live production counts and web behavior.
4. Expand **Order Detail** service model.
5. Add **In-Transit** quantity and contributing-order bottom sheet.
6. Add Track Order detail **Super/Manager/Developer approval actions**.
7. Standardize icons + empty/error/loading states on these screens.
8. Run CI and publish the first parity OTA.

This first OTA should be considered successful only when the user can open the installed baseline app and verify that the previously empty Pending Issue / Delayed VOR screens show the expected records and that an eligible Track Order exposes the same approval/In-Transit behavior as web.


---

## 13. Parity implementation progress — Batch 1 published by OTA

**Implementation date:** 06 October 2026

### 13.1 Completed in this batch

#### Pending Issue
Implemented:
- removed invalid reads of nonexistent `portal_order_items.status` and `portal_order_items.approval_status`;
- added paginated order/item fetching;
- added batched billing reads;
- added normalized branch-scope behavior;
- protected legacy ISSUED headers from re-entering Pending Issue;
- kept item-level resolved status based on shared order logic;
- retained protected `mark_portal_order_issued` RPC.

Production validation before OTA:
- global customer/not-issued header candidates: 487;
- global resolved Pending Issue orders using current production item/billing data: **239**;
- displayed count remains role/branch scoped.

#### Delayed VOR
Implemented:
- removed invalid item-column reads;
- changed eligibility derivation to the web-style VOR item query;
- paginates all VOR item rows rather than relying on the first 1,000 order headers;
- batches billing reads;
- derives eligibility using `getResolvedRowStatus`;
- preserves role/branch visibility when loading eligible order headers.

Production validation before OTA:
- global resolved Delayed VOR orders: **22**;
- displayed count remains role/branch scoped.

#### Branch scope
Added:
- `mobile/src/services/branchScope.ts`
- normalized branch-key matching aligned with web behavior.

#### Order Detail expansion
Implemented:
- richer item model using real production columns;
- billing/docket chunk loading;
- effective quantity;
- billed quantity;
- pending quantity;
- received quantity;
- effective line/order value;
- resolved item status;
- per-item registration/invoice/docket/transport information;
- improved order quantity totals.

#### In Transit
Added the same production RPC contracts used by the web:
- `portal_get_in_transit_qty`;
- `portal_get_in_transit_details`.

Order Detail now:
- shows per-part In-Transit quantity;
- makes positive quantities actionable;
- opens a mobile bottom sheet showing contributing Branch / Type / Order / Date / For / Status / Qty;
- allows navigation directly into a contributing order;
- distinguishes loading/error/zero states.

#### Order approvals from Track Order → Order Detail
Added mobile wrappers for existing protected Edge Functions:
- Super/Developer approve;
- Manager approve;
- reject;
- quantity review service reuse;
- reset edited qty helper;
- zero review item helper;
- forward-to-manager helper.

Order Detail now:
- detects pending approval workflows;
- respects selected Super approver;
- exposes Manager/Developer/Super actions in context;
- links directly into detailed quantity review;
- provides approve/reject confirmation;
- shows Manager override warning where the order is not already at Manager Approval stage.

No protected workflow transition was reimplemented as a direct table write.

### 13.2 Verification

Exact functional head before OTA:

```text
9f3a1d8cd394c129c73a9d815bbec084ecb354a7
```

CI:
- App CI #1759: **PASS**
- Mobile CI #70: **PASS**
- Mobile check included TypeScript + Android Expo export.

Baseline binary:
- app version: 0.2.0
- Android build version: 2
- runtime: 0.2.0
- channel: preview
- baseline EAS build ID: `68f94cbf-c540-40a2-be1d-19ec6a0545a6`
- baseline build status: FINISHED

### 13.3 OTA publication

Published successfully without creating a new APK.

```text
Channel: preview
Runtime: 0.2.0
Platform: android
Update group: 2e42cd72-524e-42fa-a16d-70ef84387728
Android update: 01a10fbf-14f1-7e9b-a5dd-d8cdcfd65941
Commit: 9f3a1d8cd394c129c73a9d815bbec084ecb354a7
```

Message:

```text
Mobile parity batch 1: Pending Issue, Delayed VOR, Order Detail, In Transit and approvals
```

### 13.4 User/device verification still required

On an installed 0.2.0 preview baseline:
1. fully close and reopen the app so the update can download/apply;
2. test Pending Issue and compare visible role-scoped records with web;
3. test Delayed VOR and compare visible role-scoped records with web;
4. open Track Orders → Order Detail;
5. verify positive In-Transit quantities open the contributing-order sheet;
6. test an eligible Super/Manager/Developer approval path;
7. confirm approval audit/status matches web.

Do not mark Batch 1 product-verified until this device check is completed.

### 13.5 Next planned stage

Continue with:
1. professional reusable icon system and action icons;
2. reusable EmptyState / ErrorState / loading skeleton components;
3. improve Pending Issue / Delayed VOR / Order Detail visual hierarchy;
4. complete Approval Queue parity including reset/zero/forward actions and any web-only review context;
5. continue module-by-module parity matrix with Manager / Developer workspaces;
6. publish only OTA updates on runtime 0.2.0 unless native runtime change is explicitly approved.



---

## 14. Parity implementation progress — Batch 2 published by OTA

**Implementation date:** 06 October 2026

### 14.1 Professional mobile visual foundation

Added reusable OTA-safe components based on the already compiled `react-native-svg` capability:

- `mobile/src/components/AppIcon.tsx`
- `mobile/src/components/StateView.tsx`

The icon system currently includes semantic operational icons for:
- search;
- clock;
- warning;
- check;
- close;
- refresh;
- package;
- truck;
- inbox/empty state;
- chevron/navigation.

The state component standardizes:
- empty states;
- query-failure states;
- retry actions;
- consistent icon treatment;
- compact mobile typography.

No new native package or APK was required.

### 14.2 Pending Issue / Delayed VOR visual polish

Both screens now use:
- proper vector search icons;
- reusable illustrated empty states;
- explicit error states;
- retry action;
- clearer distinction between zero results and a failed query.

### 14.3 Manager workspace parity

Added:
- report-date selection using the already compiled native date picker;
- branch/date-aware inventory queries;
- professional search/empty/error/loading states;
- inventory and movement visual improvements;
- CSV export/share for Inventory;
- CSV export/share for Received/Issued Movement;
- File System + Sharing reuse from baseline 0.2.0.

This closes the main Manager Inventory differences identified against the web page:
- latest or selected report date;
- branch filtering;
- current position;
- transaction movement;
- export capability.

### 14.4 Developer workspace parity

Corrected diagnostics:
- removed the 1,000-order cap;
- now uses exact database counts.

Production reference values verified during implementation:

```text
Orders: 1041
Pending: 55
Processed: 29
Parts: 85151
Profiles: 21
Active branches: 13
```

Also added:
- reusable empty/error/retry states;
- icon treatment;
- restored Quick Navigation to New Order, Track Orders, Approvals, Admin, Docket and TA/DA.

### 14.5 Approval Queue UX parity

Added:
- queue metrics;
- Approver Stage count;
- Manager Stage count;
- search across order/branch/customer/machine/type/status;
- richer order cards;
- clear “Open quantity review” affordance;
- professional empty and failed-query states.

Protected approval actions remain in the existing mobile approval review/detail flows and continue to use the server Edge Functions.

### 14.6 Verification

Final Batch 2 head before OTA:

```text
bf988e5548e1e132fb6410eb154e5fe93ce4f2c2
```

CI:
- App CI #1780: **PASS**
- Mobile CI #90: **PASS**

### 14.7 OTA publication

Published successfully without creating a new APK:

```text
Channel: preview
Runtime: 0.2.0
Platform: android
Update group: d6ec3ad2-e2cc-4ab2-8d7b-4d4c697db903
Android update: 01a10fcb-3831-774f-aaaa-f688c4dfac93
Commit: bf988e5548e1e132fb6410eb154e5fe93ce4f2c2
```

Message:

```text
Mobile parity batch 2: professional states, Manager inventory parity, Developer diagnostics and Approval Queue UX
```

### 14.8 Next stage

Continue the parity matrix with:
1. Credit Dispatch list/detail/actions/corrections/payment recovery parity;
2. TA/DA list/detail/receipt/edit/delete parity;
3. Engine & Breaker invoice/register/completion/acceptance parity;
4. Admin Approved Orders and Docket operational parity;
5. remaining Reports / Uploads / Part Location / activity gaps;
6. continue visual-system rollout across each module as it is touched.

Every next batch remains OTA-first. No APK/AAB without explicit user approval.

