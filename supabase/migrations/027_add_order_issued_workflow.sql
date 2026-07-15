alter table public.portal_orders
  add column if not exists issued_document_type text,
  add column if not exists issued_document_no text,
  add column if not exists issued_at timestamptz,
  add column if not exists issued_by uuid references public.portal_profiles(id);

create or replace function public.mark_portal_order_issued(
  p_order_id uuid,
  p_document_type text,
  p_document_no text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.portal_profiles%rowtype;
  v_order public.portal_orders%rowtype;
  v_type text := trim(p_document_type);
  v_no text := upper(trim(p_document_no));
  v_now timestamptz := now();
  v_item_count integer;
  v_non_received_count integer;
begin
  select * into v_profile
  from public.portal_profiles
  where auth_user_id = auth.uid() and is_active = true
  limit 1;

  if v_profile.id is null or lower(v_profile.role) not in ('admin', 'manager', 'developer') then
    raise exception 'Only Admin, Manager, or Developer users can mark an order as issued.';
  end if;

  if v_type not in ('DC', 'Tax Invoice', 'PI', 'Manual', 'Warranty Claim') then
    raise exception 'Select a valid issued document type.';
  end if;
  if v_no = '' then raise exception 'Issued document number is required.'; end if;

  select * into v_order from public.portal_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Order not found.'; end if;
  if lower(coalesce(v_order.order_for, '')) <> 'customer' then
    raise exception 'Only customer orders can be marked as issued.';
  end if;
  if lower(coalesce(v_order.status, '')) = 'issued' then
    raise exception 'This order is already marked as issued.';
  end if;

  select count(*), count(*) filter (
    where lower(regexp_replace(coalesce(row_status, ''), '[^a-z]+', '_', 'g')) not in ('received', 'fully_received')
  ) into v_item_count, v_non_received_count
  from public.portal_order_items where order_id = p_order_id;

  if lower(coalesce(v_order.status, '')) <> 'received' and (v_item_count = 0 or v_non_received_count > 0) then
    raise exception 'The complete order must be received before it can be marked as issued.';
  end if;

  update public.portal_orders
  set status = 'issued',
      issued_document_type = v_type,
      issued_document_no = v_no,
      issued_at = v_now,
      issued_by = v_profile.id,
      updated_at = v_now
  where id = p_order_id;

  update public.portal_order_items
  set row_status = 'ISSUED', updated_at = v_now
  where order_id = p_order_id;

  insert into public.portal_order_events(order_id, event_type, old_status, new_status, actor_id, notes, metadata)
  values (
    p_order_id,
    'order_issued',
    coalesce(v_order.status, ''),
    'issued',
    v_profile.id,
    format('Order marked as issued against %s %s.', v_type, v_no),
    jsonb_build_object('issued_document_type', v_type, 'issued_document_no', v_no, 'issued_by_name', v_profile.full_name, 'issued_at', v_now)
  );

  return jsonb_build_object('ok', true, 'status', 'issued', 'issued_document_type', v_type, 'issued_document_no', v_no, 'issued_at', v_now);
end;
$$;

revoke all on function public.mark_portal_order_issued(uuid, text, text) from public;
grant execute on function public.mark_portal_order_issued(uuid, text, text) to authenticated;
