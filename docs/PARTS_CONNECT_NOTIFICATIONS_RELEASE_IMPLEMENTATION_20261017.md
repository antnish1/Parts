# Parts Connect notification implementation — 17 Oct 2026

## Current implementation scope
- Existing production tables: `portal_notifications`, `portal_push_devices`, `portal_activity_reads`; existing DB triggers and recipient ownership RLS.
- UI Manager badge now counts exactly the same role-filtered unread entries as Activity. In particular, manager approval notices are no longer excluded from the header.
- New migration changes **future** order/event/comment/dispatch notification recipients. History is untouched. Rules require server verification before deployment.
- New `portal-notification-dispatch` Edge Function is **source code only**, not deployed or scheduled. It requires a private bearer token, SUPABASE_SERVICE_ROLE_KEY, and an external trusted scheduler. No client access or credentials in app.
- This first sender sends Expo push messages for pending notifications and marks `push_sent_at` only on accepted Expo tickets. Accepted tickets are not delivered-device receipts. Further production hardening: transactional queue leasing to eliminate concurrency duplicates, Expo receipt polling, invalid-token cleanup, retry backoff, and monitoring. Do NOT deploy/schedule until those are implemented, reviewed and tested.
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
- [ ] Implement safe queue claims/leasing, Expo receipt processing, retries and invalid token cleanup.
- [ ] Deploy Edge Function with secret server-side authentication and scheduling only after sign-off.
- [ ] Inspect generated Android manifest, ensure Firebase-enabled native build and test push receipt on physical device across foreground/background/killed states.
- [ ] Verify account switching and sign-out remove old recipient tokens; check sensitive order deep links against backend access control.
- [ ] Add idempotent event tests, multi-role and multi-branch recipient tests, no cross-role leaks, duplicate suppression.
- [ ] Run App CI and Mobile CI before merge or deploy.
- [ ] Never build or publish APK/AAB/OTA automatically through this work.
