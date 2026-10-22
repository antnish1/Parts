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
| TA/DA | New migration listens to existing `portal_tada_events`; HQ Manager and Accounts are centralized reviewers; branch creator gets terminal updates. Requires test with live workflow permissions before deploy. |\n| Credit Dispatch | New migration listens to `portal_credit_dispatch_events`; recipient is current status reviewer (Manager or Accounts) for either approval order; branch creator receives correction/rejection/approval updates. |\n| Installations | Status change trigger alerts Manager/Super for acceptance and original creator after acceptance. |
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

## Verified deployment assumptions

- Read-only production profile counts (2026-10-17): 1 active Manager, 1 active Accounts, 1 active Super, 12 active Branch accounts. **Central approval roles must not be excluded by a branch-name mismatch**; event filtering is based on the relevant workflow step.
- `portal_installation_entries.status` only supports `PENDING`, `ACCEPTANCE_PENDING`, `ACCEPTED` in the live database. Code must not reference `COMPLETED` as a status.
- SQL migrations have **not** been executed. Source-level contract tests are not substitutes for a transactional schema validation or real role-scoped notification integration test.
- Mobile Activity can display new categories, but notifications without `order_id` do not yet deep-link into their source Credit Dispatch / TA/DA / Installation records. A later schema addition with a secure resource reference is required for full navigation parity.

## Production rollout update — 17 October 2026

The following changes **have been applied to production Supabase** with user authorization:
- migration `notification_push_delivery_queue_20261017`
- migration `notification_order_recipient_rules_20261017`
- migration `notification_operational_role_rules_20261017`
- migration `push_queue_device_registration_boundary_20261017` (no push for notifications created before current token registration)
- Edge Functions `portal-notification-dispatch` and `portal-notification-receipts` deployed, `verify_jwt=false` since each validates a long private `NOTIFICATION_DISPATCH_SECRET` bearer value in code.

Post-deployment verification: all six notification triggers exist; queue tables use RLS; authenticated users lack EXECUTE on queue RPCs; only service_role has permission. All operations above avoided direct inserts to user-visible notification rows and made no changes to existing approval transition functions.

**Push sending is NOT ACTIVATED:** no scheduler has been set up; no `NOTIFICATION_DISPATCH_SECRET` has been configured through the available connector; there were zero device tokens and zero delivery queue entries at validation time. Deploying function source does not execute it.

### Required activation steps
1. Configure `NOTIFICATION_DISPATCH_SECRET` as a high-entropy 32+ character **server-side Supabase Edge Function secret**, never an Expo public environment variable, repository secret printed in CI logs or message attachment.
2. Configure a trusted scheduler (e.g. pg_cron + pg_net with token stored in Supabase Vault, or equivalent approved scheduler) to POST to both Edge Functions at an appropriate cadence. The scheduler must send the bearer secret in its Authorization header, avoid overlapping runs where practical, and must not expose the secret to mobile users.
3. Verify the functions reject unauthorized calls with 401, verify correct service-role privileges, then run a controlled dry-run with **one opt-in test phone** that has a Firebase-enabled Android native binary. Current installed APK may lack the Firebase client registration.
4. Create a legitimately scoped test notification and check device registration, Expo ticket receipt, final receipt status, unread bell count, and event deep link. If any step fails, keep scheduler disabled.
5. Review real recipient behavior for both Accounts-first and Manager-first credit requests; verify no cross-branch leaks or unsolicited noise.
6. Merge the reviewed PR / publish OTA only with appropriate user approval and checks. Code and DB are temporarily out of sync until that happens; do not publish an APK/AAB automatically.
