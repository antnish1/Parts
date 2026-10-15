-- Safe additive migration for customer order partial issuance.
-- Deploy before allowing item-level actions in Parts Connect.
-- Never treats a received item as physically issued without an explicit action.
-- Backout: restore previous RPC by dropping the new function and protective trigger,
-- then remove metadata columns only after confirming no partial-issue data needs them.

alter table public.portal_order_items
  add column if not exists issued_document_type text,
  add column if not exists issued_document_no text,
  add column if not exists issued_at timestamptz,
  add column if not exists issued_by uuid references public.portal_profiles(id);

-- Block legacy "mark entire order" RPC from silently overwriting an existing
-- partial issuance. The selective RPC updates selected items first, then header.
create or replace function public.portal_protect_partially_issued_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(coalesce(new.status, '')) = 'issued'
    and lower(coalesce(old.status, '')) <> 'issued'
    and exists (
      select 1 from public.portal_order_items i
      where i.order_id = new.id and upper(coalesce(i.row_status, '')) = 'ISSUED'
    )
    and exists (
      select 1 from public.portal_order_items i
      where i.order_id = new.id and upper(coalesce(i.row_status, '')) <> 'ISSUED'
    ) then
    raise exception 'This order has partially issued parts. Issue the remaining individual parts before completing the order.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_protect_partially_issued_order on public.portal_orders;
create trigger trg_protect_partially_issued_order
before update of status on public.portal_orders
for each row execute function public.portal_protect_partially_issued_order();

create or replace function public.mark_portal_order_items_issued(
 p_order_id uuid,
 p_item_ids uuid[],
 p_document_type text,
 p_document_no text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.portal_profiles%rowtype;
  v_order public.portal_orders%rowtype;
  v_type text := trim(coalesce(p_document_type, ''));
  v_no text := upper(trim(coalesce(p_document_no, '')));
  v_now timestamptz := now();
  v_requested integer;
  v_valid integer;
  v_issued integer;
  v_total integer;
  v_affected integer;
  v_remaining integer;
  v_units numeric;
  v_next_status text;
begin
  select * into v_profile
  from public.portal_profiles
  where auth_user_id = auth.uid() and is_active = true
  limit 1;

  if v_profile.id is null or lower(v_profile.role) not in ('branch','admin','manager','developer','hq') then
    raise exception 'You do not have permission to issue customer order parts.';
  end if;
  if v_type not in ('DC','Tax Invoice','PI','Manual','Warranty Claim') then
    raise exception 'Select a valid issued document type.';
  end if;
  if v_no = '' or length(v_no) > 180 then
    raise exception 'A valid issued document reference is required (max 180 characters).';
  end if;

  v_requested := coalesce(cardinality(p_item_ids), 0);
  if p_order_id is null or v_requested < 1 or v_requested > 200
    or exists (select 1 from unnest(p_item_ids) as part_id where part_id is null)
    or (select count(distinct x) from unnest(p_item_ids) as x) <> v_requested then
    raise exception 'Select between 1 and 200 unique order-item IDs.';
  end if;

  select * into v_order from public.portal_orders where id = p_order_id for update;
  if v_order.id is null then raise exception 'Order not found.'; end if;
  if lower(coalesce(v_order.order_for, '')) <> 'customer' then
    raise exception 'Only customer orders can have parts marked Issued.';
  end if;
  if lower(coalesce(v_order.status, '')) not in ('received','partially_issued')
     or v_order.issued_at is not null then
    raise exception 'This order is not eligible for partial issue.';
  end if;
  if lower(coalesce(v_profile.role, '')) = 'branch' and
     regexp_replace(upper(coalesce(v_profile.branch, '')), '[^A-Z0-9]', '', 'g')
     <> regexp_replace(upper(coalesce(v_order.branch, '')), '[^A-Z0-9]', '', 'g') then
    raise exception 'Branch users can issue only their own branch orders.';
  end if;

  -- Lock only the explicitly selected lines; the order header lock serializes
  -- simultaneous issue actions for the same order.
  perform 1 from public.portal_order_items i
  where i.order_id = p_order_id and i.id = any(p_item_ids)
  for update;

  select count(*),
         coalesce(sum(greatest(coalesce(i.edited_qty,i.qty,0),0)),0),
         count(*) filter (
           where upper(coalesce(i.row_status, '')) = 'RECEIVED'
             and coalesce((select sum(b.received_qty)
                            from public.portal_order_item_billings b where b.item_id=i.id),0)
                 >= greatest(coalesce(i.edited_qty,i.qty,0),0)
         )
  into v_valid, v_units, v_issued
  from public.portal_order_items i
  where i.order_id = p_order_id and i.id = any(p_item_ids);

  if v_valid <> v_requested or v_issued <> v_requested then
    raise exception 'Some selected items are missing, already issued, or not fully received. No changes made.';
  end if;

  update public.portal_order_items i
  set row_status = 'ISSUED',
      issued_document_type = v_type,
      issued_document_no = v_no,
      issued_at = v_now,
      issued_by = v_profile.id,
      updated_at = v_now
  where i.order_id = p_order_id and i.id = any(p_item_ids);
  get diagnostics v_affected = row_count;
  if v_affected <> v_requested then
    raise exception 'Issued item count mismatch; no changes made.';
  end if;

  select count(*), count(*) filter (where upper(coalesce(row_status,'')) = 'ISSUED')
  into v_total, v_issued
  from public.portal_order_items where order_id = p_order_id;
  v_remaining := v_total - v_issued;
  v_next_status := case when v_remaining = 0 then 'issued' else 'partially_issued' end;

  update public.portal_orders
  set status = v_next_status,
      issued_document_type = v_type,
      issued_document_no = v_no,
      issued_at = case when v_remaining = 0 then v_now else null end,
      issued_by = case when v_remaining = 0 then v_profile.id else null end,
      updated_at = v_now
  where id = p_order_id;

  insert into public.portal_order_events(
    order_id, event_type, old_status, new_status, actor_id, notes, metadata
  ) values (
    p_order_id,
    case when v_remaining = 0 then 'order_issued' else 'order_partially_issued' end,
    v_order.status, v_next_status, v_profile.id,
    format('%s parts issued against %s %s. Remaining part lines: %s.',
      v_requested,v_type,v_no,v_remaining),
    jsonb_build_object(
      'issued_item_ids',to_jsonb(p_item_ids),
      'issued_item_count',v_requested,
      'issued_qty',v_units,
      'remaining_item_count',v_remaining,
      'issued_document_type',v_type,
      'issued_document_no',v_no,
      'issued_at',v_now,
      'part_level',true
    )
  );

  return jsonb_build_object(
    'ok',true,
    'status',v_next_status,
    'issued_item_count',v_requested,
    'issued_qty',v_units,
    'remaining_item_count',v_remaining,
    'issued_document_type',v_type,
    'issued_document_no',v_no
  );
end;
$$;

revoke all on function public.mark_portal_order_items_issued(uuid,uuid[],text,text) from public;
grant execute on function public.mark_portal_order_items_issued(uuid,uuid[],text,text) to authenticated;
