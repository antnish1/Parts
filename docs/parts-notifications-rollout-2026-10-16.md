# Parts Connect notification rollout (no APK / AAB)

## Proposed event mapping
- ORDER_CREATED -> associated branch + directly assigned approver, exclude actor.
- User comment -> associated branch and direct order stakeholders, exclude author.
- MANAGER_APPROVED / MANAGER_REJECTED -> origin branch, order creator and relevant approver, exclude actor.
- Status Report dispatch -> origin branch, only when a billing record was inserted with source=status_report_upload, billed quantity >0 and dispatched/despatched raw status.
- VOR age 3–5 calendar days (India local) and 6+ calendar days -> branch, once per threshold bucket per order, only when processed/partially-dispatched order item exists.

## Migration
SQL: `supabase/migrations/20261016_portal_notifications_foundation.sql`
- New notification and token tables use RLS, with event creation restricted to database trigger functions.
- Apply *after* reviewing the actual production schema. Do not apply blindly.
- Do not change historical order statuses or backfill old notifications.
- Idempotency: unique (recipient_profile_id,event_key). Bulk VOR threshold queue uses a stable order+bucket event key.

## Android
- Existing Expo `expo-notifications` library and config plugin; no changes to Expo app.json or native packages.
- Confirm production installed binary already has valid Android FCM setup before expecting remote push.
- OTA can update JavaScript only; an APK/AAB must NOT be created unless separately authorized.

## Required services before enabling
1. Deploy the notification delivery Edge Function `notification-delivery-worker` with `verify_jwt=false` and a high-entropy `NOTIFICATION_WORKER_SECRET`.
2. Configure a trusted hourly scheduler to POST with header `x-worker-secret` and the secret. This runs the daily VOR threshold generator and dispatches unsent Expo messages. No client should invoke the worker.
3. Validate Expo push credentials and actual receipt on existing installed Android app; delivery tickets accepted by Expo are not a guarantee of device receipt. Add receipt/error follow-up and permanent token invalidation before production scale.
4. Deploy migration and worker in a controlled sequence. Confirm database RLS, unread read-only mutation, switch-account token isolation, role/branch routing and duplicate upload handling.
5. Publish Android OTA only after permission and end-to-end checks, with explicit publish approval.

## Rollback
Before applying in production, maintain a DB backup. A reversible DDL rollback would drop:
`notify_order_event`, `notify_order_comment`, `notify_order_dispatch` triggers;
`portal_notify_event`, `portal_notify_comment`, `portal_notify_dispatch`, `portal_queue_delayed_vor_alerts`, `portal_register_push_device` functions;
`portal_push_devices` and `portal_notifications` tables.
This deletes notification history and must require separate approval, never automatic rollback.
