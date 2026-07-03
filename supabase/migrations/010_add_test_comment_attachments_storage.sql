-- Safe staging migration for Parts Connect Portal comment attachments.
-- This creates only test-prefixed objects and a private test storage bucket.
-- It does not touch live production tables.

create extension if not exists pgcrypto;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'test_order_comment_attachments',
  'test_order_comment_attachments',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'text/csv'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.test_order_comment_attachments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.test_orders(id) on delete cascade,
  comment_id uuid not null references public.test_order_comments(id) on delete cascade,
  bucket_name text not null default 'test_order_comment_attachments',
  object_path text not null,
  original_file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  uploaded_by uuid not null references public.test_profiles(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique(bucket_name, object_path)
);

create index if not exists idx_test_order_comment_attachments_order_id
  on public.test_order_comment_attachments(order_id);

create index if not exists idx_test_order_comment_attachments_comment_id
  on public.test_order_comment_attachments(comment_id);

create index if not exists idx_test_order_comment_attachments_uploaded_by
  on public.test_order_comment_attachments(uploaded_by);

alter table public.test_order_comment_attachments enable row level security;

-- Read-only metadata access for staging. Upload/delete should go through Edge Functions.
drop policy if exists test_order_comment_attachments_read_all on public.test_order_comment_attachments;
create policy test_order_comment_attachments_read_all
on public.test_order_comment_attachments
for select
using (deleted_at is null);

-- Keep Storage bucket private. Do not add public storage.objects policies here.
-- Edge Functions should use service role permissions for upload and signed URL generation.
