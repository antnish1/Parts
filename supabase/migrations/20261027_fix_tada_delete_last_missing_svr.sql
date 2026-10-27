-- Fix late-HQ Delete when the missing SVR is the final row in its dispatch.
-- Multi-row dispatches still delete only the selected SVR. A one-row dispatch is removed entirely
-- after a permanent audit snapshot is written outside the cascading TA/DA tables.
create or replace function public.portal_delete_missing_tada_svr(
  p_item_id uuid
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.portal_profiles;
  v_item public.portal_tada_svr_items;
  v_dispatch public.portal_tada_dispatches;
  v_count integer;
  v_snapshot jsonb;
begin
  select * into v_profile
  from public.portal_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)
  limit 1;

  if v_profile.id is null or v_profile.role not in ('manager','director','developer') then
    raise exception 'Only Manager, Director or Developer can delete a missing HQ SVR';
  end if;
  if p_item_id is null then raise exception 'SVR is required'; end if;

  select d.* into v_dispatch
  from public.portal_tada_dispatches d
  join public.portal_tada_svr_items i on i.dispatch_id=d.id
  where i.id=p_item_id
  for update of d;

  if v_dispatch.id is null then raise exception 'TA/DA dispatch not found'; end if;

  select * into v_item
  from public.portal_tada_svr_items
  where id=p_item_id
  for update;

  if v_item.id is null then raise exception 'SVR item not found'; end if;
  if v_item.dispatch_id<>v_dispatch.id then raise exception 'SVR dispatch mismatch'; end if;
  if v_item.hq_received is distinct from false or v_item.current_location<>'MISSING_HQ' then
    raise exception 'Only an SVR currently missing at HQ can be deleted from this action';
  end if;
  if v_item.accounts_received is not null then
    raise exception 'Accounts receipt already exists for this SVR';
  end if;

  select count(*) into v_count
  from public.portal_tada_svr_items
  where dispatch_id=v_dispatch.id;

  if v_count<=1 then
    select jsonb_build_object(
      'dispatch',to_jsonb(v_dispatch),
      'svrs',coalesce((select jsonb_agg(to_jsonb(i)) from public.portal_tada_svr_items i where i.dispatch_id=v_dispatch.id),'[]'::jsonb),
      'receipts',coalesce((select jsonb_agg(to_jsonb(r)) from public.portal_tada_receipts r where r.dispatch_id=v_dispatch.id),'[]'::jsonb),
      'events',coalesce((select jsonb_agg(to_jsonb(e)) from public.portal_tada_events e where e.dispatch_id=v_dispatch.id),'[]'::jsonb)
    ) into v_snapshot;

    insert into public.portal_developer_override_audit(
      module,action,entity_id,entity_ref,reason,snapshot,actor_id,actor_name
    )
    values(
      'TADA',
      'DELETE_MISSING_HQ_DISPATCH',
      v_dispatch.id,
      v_dispatch.dispatch_no,
      'Deleted final missing-HQ SVR from late receipt flow',
      v_snapshot,
      v_profile.id,
      v_profile.full_name
    );

    delete from public.portal_tada_dispatches
    where id=v_dispatch.id;

    return;
  end if;

  delete from public.portal_tada_svr_items
  where id=p_item_id;

  perform public.portal_recalculate_tada_after_developer_delete(v_dispatch.id);

  insert into public.portal_tada_events(
    dispatch_id,event_type,actor_id,actor_name_snapshot,actor_role_snapshot,metadata
  )
  values(
    v_dispatch.id,
    'MISSING_HQ_SVR_DELETED',
    v_profile.id,
    v_profile.full_name,
    v_profile.role,
    jsonb_build_object(
      'deleted_svr',to_jsonb(v_item),
      'previous_dispatch_status',v_dispatch.status,
      'deleted_at',now()
    )
  );
end $$;

revoke all on function public.portal_delete_missing_tada_svr(uuid) from public;
grant execute on function public.portal_delete_missing_tada_svr(uuid) to authenticated;
