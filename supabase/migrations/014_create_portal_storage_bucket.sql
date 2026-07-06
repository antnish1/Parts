-- Create the production private Storage bucket used by portal comment files.
-- Safe/additive: does not delete or rename the older bucket, so old file rows can still resolve.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portal_order_comment_attachments',
  'portal_order_comment_attachments',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','application/pdf','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','text/csv']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
