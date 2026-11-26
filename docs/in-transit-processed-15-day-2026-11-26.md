# Processed In Transit: 15-calendar-day expiry (approved 2026-11-26)

## Confirmed business rule
- A genuinely **PROCESSED** item contributes to In Transit on processing day and through the next 14 calendar days. From day 15, its In Transit contribution is zero.
- Use `portal_orders.processed_date`; when that is null, use the first `ADMIN_PROCESSED` audit event date. An item with no trustworthy processing date contributes zero; do not invent a date from order creation.
- Existing **DISPATCHED / PARTIALLY DISPATCHED** and dispatch-proven partly received items retain their 15-calendar-day **billing-date** eligibility; dispatch proof overrides a stale PROCESSED label.
- Existing approved/pending/rejected/issued/received exclusions, canonical branch isolation, billed/received quantities, item status and audit history remain unchanged.
- This changes only the two read-only SQL RPCs. Nothing is automatically marked Received or Dispatched.

## Example from production (before migration)
- Order `165062692`, part `400/L8801`, JABALPUR_PARTS, effective quantity 40, genuinely PROCESSED, processing date `2026-07-15`, no billing rows. Old popup 40; new popup 0 after 15 days.
- The popup `portal_get_in_transit_details` and summary `portal_get_in_transit_qty` must agree after release.

## Migration
`supabase/migrations/20261126_in_transit_processed_15_day_expiry.sql`

## Deployment checklist
1. Read latest production function definitions and confirm matching old migration.
2. Merge PR only after requested authorization; apply migration to production via Supabase.
3. Check processed 0/14/15-day boundaries, dispatch 0/14/15-day boundaries, unreceived chunks, branch scoping, mixed-status orders.
4. Check order 165062692 disappears from popup and summary falls by exactly 40 for its contribution, without mutating the order or inventory.
5. Check summary equals popup summed quantity for selected branch/parts.

Historical note: this approved 2026-11-26 change supersedes the **no age limit for PROCESSED items** statement in root AGENTS.md section 31; all other provisions stay applicable.
