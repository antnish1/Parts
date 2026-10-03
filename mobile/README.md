# Parts Connect Android (Expo)

This directory contains the native Expo/React Native Android client for Parts Connect Portal.

## Principles

- The existing web application under `app/` remains the production web frontend.
- Mobile and web use the same Supabase Auth, `portal_profiles`, operational tables, RLS, RPCs and Edge Functions.
- Do not reproduce workflow authorization only in the client. Server-side permissions remain authoritative.
- Do not directly mutate protected order/approval/receipt states from the app when an RPC/Edge Function is the established workflow boundary.
- Mobile screens are native React Native screens, not a WebView wrapper.
- No APK/AAB workflow is auto-triggered by this scaffold. Produce installable builds only when explicitly requested.

## Current milestone

Implemented foundation:

- secure persisted Supabase session;
- existing User ID (`USERID@portal.local`) login behavior;
- role + branch profile loading;
- role-aware Home and Work surfaces;
- order search;
- recent activity;
- native Track Orders list with KPI filters, search and pull-to-refresh;
- native Order Detail with parts and processing/dispatch summary;
- separate Android CI for typecheck + Expo bundle export.

The first milestone deliberately keeps operational order screens read-only. New Order, approvals, Docket Scanner, Credit Dispatch, TA/DA, Engine & Breaker, Part Location, uploads and reports follow in later slices.

## Local setup

1. Use Node 22.13 or newer for Expo SDK 57.
2. Copy `.env.example` to `.env`.
3. Populate `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` with the intended environment.
4. Run `npm install`.
5. Run `npm run check` before opening or merging a PR.
6. Run `npm run android` for local Android/Expo Go development.

Do not commit secrets or local `.env` files.
