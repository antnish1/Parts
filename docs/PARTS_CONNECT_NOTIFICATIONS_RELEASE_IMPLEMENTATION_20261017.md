# Parts Connect notification implementation — 17 Oct 2026

## Current implementation scope
- Existing production tables: `portal_notifications`, `portal_push_devices`, `portal_activity_reads`; existing DB triggers and recipient ownership RLS.
- UI Manager badge now counts exactly the same role-filtered unread entries as Activity. In particular, manager approval notices are no longer excluded from the header.
- New migration changes **future** order/event/comment/dispatch notification recipients. History is untouched. Rules require server verification before deployment.
- New `portal-notification-dispatch` and `portal-notification-receipts` Edge Functions are **source code only**, not deployed or scheduled. Both require a private bearer token, SUPABASE_SERVICE_ROLE_KEY, and a trusted external scheduler. No client access or credentials in app.
- Durable `portal_push_deliveries` queue uses per-device uniqueness, atomic leasing (`FOR UPDATE SKIP LOCKED`), exponential retry backoff and an activation timestamp preventing a historic notification flood. Expo accepted tickets are checked by a separate receipt processor; invalid tokens are removed. These are **not yet runtime-tested**. In-flight crash after Expo accepts a push but before ticket persistence can still produce at-least-once duplicates; avoid claiming mathematically exact-once delivery.\n- A scheduler, server secret, Android token registration, role-by-role integration tests, and monitoring are still needed before deployment. No production sender has been activated.
- Existing device registrations in production were **zero** at audit time. Firebase/Expo FCM credentials are configured, but a physical device running a Firebase-enabled native build must successfully register a token before end-to-end tests.

## Notification policy (initial core)
| Category | Intended recipients |
| --- | --- |
| Created / forwarded / approved / rejected order | Active assigned approver, affected employee, relevant Manager by branch, Admin for approved-ready events |
| New order comment | Active order owner, approver or relevant operational branch/manager/super/admin; exclude author |
| Dispatch from status-report billing | Active assigned employee and branch operators |
| TA/DA, Credit Dispatch, installations | **Not yet supported by this migration.** Requires separate event schemas and notification triggers with event-by-role matrices, strict action/branch authorization, and tests. Do not claim complete parity. |
| Viewer | No broad unsolicited notifications |

## Mandatory production release gates
- [ ] Review precise manager/branch recipient rule and roles for approval chain against actual workflow. Review new SQL on production schema before applying.
- [ ] Verify no additional notification types are suppressed in the UI.
- [x] Prepare safe queue claims/leasing, Expo receipt processor, retries and invalid token cleanup in source code.\n- [ ] Test database migration in a transaction, verify RLS and RPC access with service-role vs authenticated.\n- [ ] Add delivery integration tests, concurrency tests, retry/receipt mocks, push preferences and monitoring.\n- [ ] Configure a trusted scheduler and server secret. Disable JWT gateway verification for the **custom-secret-authenticated** functions only, retaining bearer-secret verification in code.
- [ ] Deploy Edge Function with secret server-side authentication and scheduling only after sign-off.
- [ ] Inspect generated Android manifest, ensure Firebase-enabled native build and test push receipt on physical device across foreground/background/killed states.
- [ ] Verify account switching and sign-out remove old recipient tokens; check sensitive order deep links against backend access control.
- [ ] Add idempotent event tests, multi-role and multi-branch recipient tests, no cross-role leaks, duplicate suppression.
- [ ] Run App CI and Mobile CI before merge or deploy.
- [ ] Never build or publish APK/AAB/OTA automatically through this work.
