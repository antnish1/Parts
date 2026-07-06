# Final Portal Cutover Checklist

The legacy requests import and profile copy checks have passed.

## Before deploy

Run this SQL in Supabase SQL Editor:

`supabase/final_migration_scripts/008_portal_cutover_compatibility_columns.sql`

This adds required compatibility columns for the final portal workflow.

## Edge Functions to deploy

After running script 008, deploy these Supabase Edge Functions:

```bash
supabase functions deploy create-order-action
supabase functions deploy approval-order-action
supabase functions deploy approval-qty-review-action
supabase functions deploy order-item-qty-action
supabase functions deploy status-report-action
supabase functions deploy docket-receive-action
supabase functions deploy inventory-upload-action
supabase functions deploy comment-attachment-upload-action
supabase functions deploy comment-attachment-link-action
```

## Vercel deploy

After Edge Functions are deployed, push a commit with `[deploy]` in the message or redeploy manually from Vercel.

## Smoke tests

1. Login with admin/manager/developer.
2. Open Track Orders and confirm legacy imported orders appear.
3. Open one old order detail.
4. Search docket `501546374571` in Docket Scan.
5. Search docket `225051275` and test one row receive.
6. Create one new small stock order.
7. Approve it through the normal workflow.
8. Upload one small status report sample.
9. Upload one small inventory file sample.
10. Add a comment and attachment to one order.

## Rollback note

Do not delete `requests`, `test_*`, or `migration_backup_20260706_pre_import`. These remain available for rollback/reference.
