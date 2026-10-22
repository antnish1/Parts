-- Record physical arrival of an SVR previously marked missing at HQ.
-- Preserves original receipt rows and reasons; appends a traceability event.
create or replace function public.portal_receive_missing_tada_svr(
  p_item_id uuid,
  p_remark text default ''
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_profile public.portal_profiles;
  v_item public.portal_tada_svr_items;
  v_dispatch public.portal_tada_dispatches;
  v_total integer;
  v_hq integer;
  v_accounts integer;
  v_accounts_missing integer;
  v_next_status text;
begin
  select * into v_profile from public.portal_profiles
    where auth_user_id=auth.uid() and coalesce(is_active,true) limit 1;
  if v_profile.id is null or v_profile.role not in ('manager','developer') then
    raise exception 'Only Manager or Developer can receive a missing HQ SVR';
  end if;
  if p_item_id is null then raise exception 'SVR is required'; end if;
  if length(trim(coalesce(p_remark,''))) > 1000 then raise exception 'Remark exceeds 1000 characters'; end if;

  -- Lock parent before the item, matching all late-receipt calls for this dispatch.
  select d.* into v_dispatch
  from public.portal_tada_dispatches d
  join public.portal_tada_svr_items i on i.dispatch_id=d.id
  where i.id=p_item_id for update of d;
  if v_dispatch.id is null then raise exception 'TA/DA dispatch not found'; end if;
  select * into v_item from public.portal_tada_svr_items where id=p_item_id for update;
  if v_item.dispatch_id<>v_dispatch.id then raise exception 'SVR dispatch mismatch'; end if;
  if v_item.hq_received is distinct from false or v_item.current_location<>'MISSING_HQ' then
    raise exception 'This SVR is not currently missing at HQ';
  end if;
  if v_item.accounts_received is not null then raise exception 'Accounts receipt already exists for this SVR'; end if;

  update public.portal_tada_svr_items set
    hq_received=true, current_location='IN_TRANSIT_TO_ACCOUNTS',
    hq_remark=coalesce(nullif(trim(p_remark),''),hq_remark),
    hq_exception_reason=null, updated_at=now()
  where id=p_item_id;

  select count(*), count(*) filter(where hq_received=true),
         count(*) filter(where accounts_received=true),
         count(*) filter(where accounts_received=false)
    into v_total,v_hq,v_accounts,v_accounts_missing
    from public.portal_tada_svr_items where dispatch_id=v_dispatch.id;

  v_next_status := case
    when v_hq<v_total then 'PARTIALLY_RECEIVED_HQ'
    when v_accounts=v_total then 'COMPLETED'
    when v_accounts_missing>0 then 'PARTIALLY_RECEIVED_ACCOUNTS'
    else 'AWAITING_ACCOUNTS_RECEIPT'
  end;
  update public.portal_tada_dispatches set status=v_next_status,updated_at=now() where id=v_dispatch.id;

  insert into public.portal_tada_events(dispatch_id,svr_item_id,event_type,actor_id,actor_name_snapshot,actor_role_snapshot,metadata)
  values(v_dispatch.id,p_item_id,'MISSING_HQ_SVR_RECEIVED_LATER',v_profile.id,v_profile.full_name,v_profile.role,
    jsonb_build_object('svr_no',v_item.svr_no,'previous_location',v_item.current_location,
      'original_missing_reason',v_item.hq_exception_reason,'original_remark',v_item.hq_remark,
      'late_receipt_remark',nullif(trim(coalesce(p_remark,'')),''),'received_at',now(),
      'previous_dispatch_status',v_dispatch.status,'new_dispatch_status',v_next_status));
end $$;

revoke all on function public.portal_receive_missing_tada_svr(uuid,text) from public;
revoke execute on function public.portal_receive_missing_tada_svr(uuid,text) from anon;
grant execute on function public.portal_receive_missing_tada_svr(uuid,text) to authenticated;
