-- Extend the developer TA/DA edit override so Office can also be corrected at any stage.

drop function if exists public.portal_developer_update_tada_dispatch(uuid,date,text,text,text,text);

create or replace function public.portal_developer_update_tada_dispatch(
  p_dispatch_id uuid,
  p_branch text,
  p_dispatch_date date,
  p_dispatched_by text,
  p_dispatch_mode text,
  p_reference_no text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.portal_profiles;
  v_before public.portal_tada_dispatches;
  v_after public.portal_tada_dispatches;
  v_branch text;
  v_branch_name text;
begin
  v_profile := public.portal_developer_profile();
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Override reason is required'; end if;
  v_branch := public.resolve_portal_branch(p_branch);
  if v_branch is null then raise exception 'Invalid office'; end if;
  select display_name into v_branch_name from public.portal_branches where branch_key=v_branch;
  if p_dispatch_date is null then raise exception 'Dispatch date is required'; end if;
  if nullif(trim(coalesce(p_dispatched_by,'')),'') is null then raise exception 'Dispatched By is required'; end if;
  if p_dispatch_mode not in ('Bus','Transport','By Hand') then raise exception 'Invalid dispatch mode'; end if;
  if p_dispatch_mode in ('Bus','Transport') and nullif(trim(coalesce(p_reference_no,'')),'') is null then raise exception 'Ref. No. is required for Bus or Transport'; end if;

  select * into v_before from public.portal_tada_dispatches where id=p_dispatch_id for update;
  if v_before.id is null then raise exception 'TA/DA dispatch not found'; end if;

  update public.portal_tada_dispatches
  set branch_key=v_branch,
      branch_name_snapshot=coalesce(v_branch_name,v_branch),
      dispatch_date=p_dispatch_date,
      dispatched_by=trim(p_dispatched_by),
      dispatch_mode=p_dispatch_mode,
      reference_no=nullif(trim(coalesce(p_reference_no,'')),''),
      updated_at=now()
  where id=p_dispatch_id
  returning * into v_after;

  insert into public.portal_tada_events(dispatch_id,event_type,actor_id,actor_name_snapshot,actor_role_snapshot,metadata)
  values(p_dispatch_id,'DEVELOPER_DISPATCH_EDITED',v_profile.id,v_profile.full_name,v_profile.role,
    jsonb_build_object('reason',trim(p_reason),'before',to_jsonb(v_before),'after',to_jsonb(v_after)));

  insert into public.portal_developer_override_audit(module,action,entity_id,entity_ref,reason,snapshot,actor_id,actor_name)
  values('TADA','EDIT_DISPATCH',p_dispatch_id,v_before.dispatch_no,trim(p_reason),
    jsonb_build_object('before',to_jsonb(v_before),'after',to_jsonb(v_after)),v_profile.id,v_profile.full_name);
end $$;

grant execute on function public.portal_developer_update_tada_dispatch(uuid,text,date,text,text,text,text) to authenticated;
