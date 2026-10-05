# Parts Connect Mobile — Agent Contract

Read the repository root `AGENTS.md` first. These rules apply to all work under `mobile/`.

Before any APK/AAB, native dependency, EAS Update, OTA, app-icon, splash-screen, permissions, notification, biometric, or release work, also read:

- `docs/PARTS_CONNECT_MOBILE_NATIVE_BASELINE_AND_OTA_2026-10-05.md`

That document is the source of truth for the current native baseline plan, OTA-first policy, correct Supabase backend, required assets, and the distinction between OTA-compatible changes and changes that require a new native build.

## Purpose

`mobile/` is the native Expo/React Native Android client for Parts Connect Portal. It runs in parallel with the existing React/Vite web app under `app/` and must not replace or destabilize the web portal during migration.

## Architecture

- Use Expo + React Native native screens. Do not turn the app into a WebView wrapper.
- Reuse the existing Supabase project, Auth identities, `portal_profiles`, operational tables, RLS, RPCs, Edge Functions, Storage and audit model.
- Prefer sharing pure TypeScript domain definitions over copying workflow logic into mobile.
- Mobile client role checks control visibility only. Backend RLS/RPC/Edge Function checks remain authoritative.
- Never add service-role keys or production secrets to the mobile bundle.

## Workflow safety

- Preserve the order lifecycle and role rules defined by root `AGENTS.md` and current backend code.
- Do not directly update protected status/approval/receipt fields when an established backend workflow function exists.
- Credit Dispatch must preserve Branch -> Accounts -> Manager -> Payment Recovery sequencing. Correction resubmission restarts at Accounts; rejection remains final where the backend says so.
- TA/DA must preserve per-SVR receipt/custody state and server-side role enforcement.
- Engine & Breaker must preserve invoice -> registration handoff, document reuse, acceptance workflow and developer-only audited destructive override.
- Accounts must not receive Part Location access unless the product requirement changes explicitly.

## Mobile UX

- Mobile is a first-class workflow surface, not a shrunken desktop table.
- Prefer compact cards, searchable lists, bottom sheets, sticky action areas and 48dp-or-larger touch targets.
- Back actions must respect actual navigation history.
- Preserve filter/search context when navigating into a detail screen whenever practical.
- Long operational forms should eventually support safe local draft recovery; high-risk writes must still require confirmed online server execution.
- Use native camera, document picker, sharing, haptics and signatures where they improve the actual workflow.

## Build/deployment governance

- Keep mobile CI separate from the existing web build.
- Run mobile typecheck and Android bundle export checks before merge.
- Do not add an automatic APK/AAB build-on-main workflow. Create installable Android builds only when the user explicitly requests them.
- After the OTA-capable native baseline is installed, prefer EAS OTA updates for runtime-compatible JS/TS/UI/business-logic changes. Do not rebuild APKs unnecessarily.
- Do not deploy mobile changes or alter production database objects merely to preview UI.
