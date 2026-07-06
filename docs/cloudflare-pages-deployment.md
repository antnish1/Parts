# Cloudflare Pages Deployment Guide

This project is ready to deploy the frontend on Cloudflare Pages while keeping Supabase as the backend/database.

## Repo settings

Use these settings when creating the Cloudflare Pages project:

| Setting | Value |
| --- | --- |
| Git provider | GitHub |
| Repository | `antnish1/Parts` |
| Production branch | `main` |
| Root directory | `app` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | `20` or `22` |

## Environment variables

Add the same frontend environment variables that were used in Vercel:

```text
VITE_SUPABASE_URL=<your Supabase project URL>
VITE_SUPABASE_ANON_KEY=<your Supabase anon public key>
```

Do not add the Supabase service role key to Cloudflare Pages. The service role key should stay only inside Supabase Edge Function secrets.

## SPA routing

The file below has been added for React Router page refresh support:

```text
app/public/_redirects
```

Content:

```text
/* /index.html 200
```

This ensures routes such as `/orders/<id>`, `/approvals`, `/track`, and `/docket` load the React app instead of returning a 404 on refresh.

## Security and cache headers

The file below has been added:

```text
app/public/_headers
```

It adds basic browser security headers and long cache for built Vite assets.

## Supabase Edge Functions

Cloudflare Pages deploys only the frontend. These functions still remain on Supabase and must be deployed there:

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

## Required SQL already added

Run any pending final migration scripts before or after the frontend move, especially:

```text
supabase/final_migration_scripts/009_portal_performance_indexes.sql
supabase/final_migration_scripts/010_order_tracking_totals.sql
```

## Smoke test after deploy

1. Open the Cloudflare Pages URL.
2. Login with an admin/developer profile.
3. Open Track Orders and verify total orders, Qty, and Value.
4. Open an order detail page directly and refresh the browser.
5. Open Approvals as manager.
6. Test Docket Scan with a real docket.
7. Create one small test stock order.
8. Approve and process through the workflow.

## Notes

- Vercel can remain connected until Cloudflare is verified.
- Do not delete old Vercel project immediately.
- After Cloudflare is confirmed, move the production custom domain to Cloudflare Pages.
