-- Allow active authenticated portal users to add user comments.
-- Read policy already exists; this adds the missing insert policy used by Order Detail comment posting.

drop policy if exists portal_comments_insert_authenticated on public.portal_order_comments;

create policy portal_comments_insert_authenticated
on public.portal_order_comments
for insert
to authenticated
with check (
  comment_type = 'user'
  and nullif(trim(coalesce(body, '')), '') is not null
  and exists (
    select 1
    from public.portal_profiles p
    where p.id = author_id
      and p.auth_user_id = auth.uid()
      and coalesce(p.is_active, false) = true
  )
  and exists (
    select 1
    from public.portal_orders o
    where o.id = order_id
  )
);
