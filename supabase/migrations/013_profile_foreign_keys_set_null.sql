-- Allow deleting staging/test profiles without deleting historical orders or records.
-- Existing references to the deleted profile are preserved as NULL.

alter table public.test_orders
  drop constraint if exists test_orders_employee_id_fkey,
  add constraint test_orders_employee_id_fkey
    foreign key (employee_id)
    references public.test_profiles(id)
    on delete set null;

alter table public.test_orders
  drop constraint if exists test_orders_approver_id_fkey,
  add constraint test_orders_approver_id_fkey
    foreign key (approver_id)
    references public.test_profiles(id)
    on delete set null;

alter table public.test_order_events
  drop constraint if exists test_order_events_actor_id_fkey,
  add constraint test_order_events_actor_id_fkey
    foreign key (actor_id)
    references public.test_profiles(id)
    on delete set null;

alter table public.test_order_comments
  drop constraint if exists test_order_comments_author_id_fkey,
  add constraint test_order_comments_author_id_fkey
    foreign key (author_id)
    references public.test_profiles(id)
    on delete set null;

alter table public.test_inventory_uploads
  drop constraint if exists test_inventory_uploads_uploaded_by_fkey,
  add constraint test_inventory_uploads_uploaded_by_fkey
    foreign key (uploaded_by)
    references public.test_profiles(id)
    on delete set null;

alter table public.test_order_comment_attachments
  alter column uploaded_by drop not null;

alter table public.test_order_comment_attachments
  drop constraint if exists test_order_comment_attachments_uploaded_by_fkey,
  add constraint test_order_comment_attachments_uploaded_by_fkey
    foreign key (uploaded_by)
    references public.test_profiles(id)
    on delete set null;
