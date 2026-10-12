# Parts Connect Android (Expo)

This directory contains the native Expo/React Native Android client for Parts Connect Portal.

## Principles

- The existing web application under `app/` remains the production web frontend.
- Mobile and web use the same Supabase Auth, `portal_profiles`, operational tables, RLS, RPCs and Edge Functions.
- Do not reproduce workflow authorization only in the client. Server-side permissions remain authoritative.
- Do not directly mutate protected order/approval/receipt states from the app when an RPC/Edge Function is the established workflow boundary.
- Mobile screens are native React Native screens, not a WebView wrapper.
- No APK/AAB workflow is auto-triggered. Produce installable builds only when explicitly requested.

## Current implementation status

The functional mobile conversion is now implemented across the major Parts Connect workflows and is CI-verified on PR #126.

Implemented areas:

- secure persisted Supabase session and existing User ID (`USERID@portal.local`) login behavior;
- role/branch profile loading and role-aware Home / Work / Search / Activity / More navigation;
- New Order, Track Orders, Order Detail and audited Order Activity;
- Super / Manager / Developer approvals, edited-quantity review and rejection;
- Docket Scanner using the native camera and protected receipt action;
- Pending Issue and Mark Issued;
- Delayed VOR monitoring;
- Admin Approved Orders processing / rejection;
- Manager / Developer Order Data Correction;
- Part Location Finder and protected Part Location management;
- Credit Dispatch list/detail, Accounts/Manager review, comments and activity;
- New signed Credit Dispatch requests with native handwritten customer and issuer signatures;
- Credit correction/resubmission, payment entry, customer outstanding, aging and ledger;
- TA/DA creation, HQ receipt and Accounts receipt with partial packet handling;
- Engine & Rock Breaker invoice intake, registration, private document upload, branch completion and Service CRM acceptance;
- Manager inventory lookup and received/issued movement;
- operational Reports with branch/status summaries;
- protected Uploads workspace:
  - Inventory upload through `portal_upload_inventory`;
  - Order Status preview then apply through `status-report-action`;
  - Dealer Price List validate → duplicate resolution → stage → preview → publish using the existing part-master RPC workflow;
- Developer Workspace using protected user-management functions and the developer comments inbox;
- separate Mobile CI running TypeScript validation and Expo Android export.

## Current verification

Latest verified mobile head at the time of this update:

```text
243664aafb851375ca7a509e066d1fc40e857113
```

Required checks on this head:

- App CI: ✅ passed
- Mobile CI: ✅ passed
  - `tsc --noEmit`
  - `expo export --platform android --output-dir dist-check`

The Expo export is a bundle validation step only; it does **not** create an APK or AAB.

## Remaining release-stage work

The core functional conversion is implemented. Remaining work is release validation/hardening rather than another major feature port:

- real Android-device smoke testing across representative roles;
- keyboard/back-button/safe-area checks on physical devices;
- camera/document-picker permission denial and recovery testing;
- slow-network/session-expiry/error-state verification;
- optional scanner haptic/audio polish;
- optional offline/read-only caching where safe;
- controlled signing/versioning/AAB work only after an explicit user request.

Do not silently queue protected state mutations offline.

## Local setup

1. Use Node 22.13 or newer for Expo SDK 57.
2. Copy `.env.example` to `.env`.
3. Populate `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` with the intended environment.
4. Run `npm install`.
5. Run `npm run check` before opening or merging a PR.
6. Run `npm run android` for local Android/Expo Go development.

Do not commit secrets or local `.env` files.

## Merge / build rule

PR #126 must remain unmerged until the user explicitly asks to merge it.

Do not create an APK or AAB unless the user explicitly requests an installable Android build.
