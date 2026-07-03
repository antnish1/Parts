# Comment Attachments Storage Plan

## Scope

This plan defines how comment attachments should be added to the new Parts Connect Portal after approval.

No implementation should be started until this plan is reviewed and approved.

## Safety rule

Do not touch live production tables during development.

Development must use only staging/test objects:

- Supabase Storage bucket: `test_order_comment_attachments`
- Metadata table: `test_order_comment_attachments`
- Existing comments table: `test_order_comments`
- Existing order table: `test_orders`
- Existing profile table: `test_profiles`

Production bucket/table names should be decided only during approved production cutover.

## Recommended bucket

Bucket name:

```text
test_order_comment_attachments
```

Bucket type:

```text
private
```

Reason:

- Attachments can contain invoice, docket, customer, machine, or internal discussion details.
- Files should be accessible only through authenticated portal users with valid order access.
- Public URLs should not be used.

## Allowed file types

Recommended allowed MIME types:

```text
image/jpeg
image/png
image/webp
application/pdf
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
application/vnd.ms-excel
application/vnd.openxmlformats-officedocument.wordprocessingml.document
application/msword
text/csv
```

Recommended UI label:

```text
Allowed: JPG, PNG, WEBP, PDF, Excel, Word, CSV
```

## File size limit

Recommended maximum file size:

```text
10 MB per file
```

Recommended upload count limit:

```text
5 files per comment
```

Reason:

- Enough for photos, dockets, invoices, and small Excel/PDF files.
- Avoids large storage and slow uploads.
- Keeps the comment workflow lightweight.

## Storage path format

Recommended object path:

```text
orders/{order_id}/comments/{comment_id}/{timestamp}_{safe_filename}
```

Example:

```text
orders/2fb7.../comments/90ca.../20260704T153000_invoice.pdf
```

Rules:

- Use UUID order/comment IDs, not order numbers, for object paths.
- Sanitize file names before upload.
- Prefix with timestamp to avoid duplicate file-name collisions.
- Do not store customer phone numbers or machine numbers in file names.

## Metadata table

Create a metadata table after approval:

```sql
create table if not exists public.test_order_comment_attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.test_orders(id) on delete cascade,
  comment_id uuid not null references public.test_order_comments(id) on delete cascade,
  bucket_name text not null default 'test_order_comment_attachments',
  object_path text not null,
  original_file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  uploaded_by uuid not null references public.test_profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(bucket_name, object_path)
);

create index if not exists idx_test_order_comment_attachments_order_id
  on public.test_order_comment_attachments(order_id);

create index if not exists idx_test_order_comment_attachments_comment_id
  on public.test_order_comment_attachments(comment_id);
```

## Access rules

Recommended read access:

- `developer`: all attachments.
- `manager`: all attachments.
- `admin`: all attachments.
- `super`: attachments for orders they can approve/review.
- `branch`: attachments for their own branch orders only.
- `viewer`: read-only access according to existing order visibility rules, if viewer can open that order.

Recommended upload access:

- `developer`
- `manager`
- `admin`
- `super`
- `branch`

Recommended delete access:

- `developer`: can soft-delete any attachment.
- Uploader: can soft-delete their own attachment while comment/order is still active.
- Avoid hard delete from UI. Use `deleted_at` first.

## RLS policy outline

Enable RLS on the metadata table:

```sql
alter table public.test_order_comment_attachments enable row level security;
```

Suggested approach:

1. Create helper functions only if existing role/order access helpers are not already available.
2. Base attachment visibility on the linked `test_orders` row.
3. Keep Storage bucket private and generate signed URLs from an Edge Function.
4. Do not expose raw bucket paths directly as public URLs.

## Edge Function recommendation

Use Edge Functions instead of direct browser writes for final implementation.

Recommended functions:

```text
comment-attachment-upload-action
comment-attachment-link-action
comment-attachment-delete-action
```

Minimum server-side checks:

- Authenticated user exists.
- Active profile exists in `test_profiles`.
- User has access to the order.
- Comment belongs to the same order.
- File MIME type is allowed.
- File size is within limit.
- Upload count per comment does not exceed limit.
- Metadata insert happens only after successful Storage upload.

## UI recommendation

Order Detail comments section should add:

- Small text-link action: `Attach files`
- Compact file list under each comment.
- `Download` text link for each attachment.
- Optional `Remove` text link only for permitted users.

Avoid large upload buttons to match the portal's compact UI preference.

## Rollout steps after approval

1. Create private bucket `test_order_comment_attachments` in staging Supabase.
2. Add migration for `test_order_comment_attachments` metadata table.
3. Add Edge Function for upload and signed download URL generation.
4. Update `testOrderView.service.ts` to load attachment metadata with comments.
5. Update `OrderDetailPage.tsx` comments UI.
6. Add validation in UI and Edge Function.
7. Smoke test with branch, admin, manager, super, developer roles.
8. Update release readiness checklist.
9. Decide production bucket/table names only during approved cutover.

## Smoke test checklist

- Branch user can upload a JPG to their own branch order comment.
- Branch user cannot access another branch order attachment.
- Admin can view and download branch-uploaded attachment.
- Manager can view and download attachment.
- Unsupported file type is rejected.
- File larger than 10 MB is rejected.
- More than 5 files on one comment is rejected.
- Deleted attachment disappears from UI but remains soft-deleted in metadata.
- Signed URLs expire and are not public.

## Open approval questions

Before implementation, confirm:

1. Is 10 MB per file acceptable?
2. Is 5 files per comment acceptable?
3. Should Excel and Word files be allowed, or only images/PDF?
4. Should branch users be allowed to delete their own uploaded attachments?
5. Should attachments be added to existing comments only, or should upload happen while creating a new comment?
