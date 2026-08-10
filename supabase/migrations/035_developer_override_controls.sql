-- Developer-only destructive/edit overrides for TA/DA and Engine & Breaker.
-- All writes are enforced server-side and leave a permanent audit record outside the deleted workflow rows.

create table if not exists public.portal_developer_override_audit (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('TADA','INSTALLATION')),
  action text not null,
  entity_id uuid,
  entity_ref text,
  reason text not null,
  snapshot jsonb not null default '{}'::jsonb,
  actor_id uuid not null references public.portal_profiles(id),
  actor_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_developer_override_audit_module_created
  on public.portal_developer_override_audit(module, created_at desc);

alter table public.portal_developer_override_audit enable row level security;
drop policy if exists developer_override_audit_read on public.portal_developer_override_audit;
create policy developer_override_audit_read on public.portal_developer_override_audit
for select using (
  exists (
    select 1 from public.portal_profiles p
    where p.auth_user_id=auth.uid() and coalesce(p.is_active,true) and p.role='developer'
  )
);
grant select on public.portal_developer_override_audit to authenticated;

create or replace function public.portal_developer_profile()
returns public.portal_profiles
language plpgsql
stable
security definer
set search_path=public
as $$
declare v_profile public.portal_profiles;
begin
  select * into v_profile
  from public.portal_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)
  limit 1;
  if v_profile.id is null or v_profile.role<>'developer' then
    raise exception 'Developer role required';
  end if;
  return v_profile;
end $$;

create or replace function public.portal_developer_update_tada_dispatch(
  p_dispatch_id uuid,
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
begin
  v_profile := public.portal_developer_profile();
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Override reason is required'; end if;
  if p_dispatch_date is null then raise exception 'Dispatch date is required'; end if;
  if nullif(trim(coalesce(p_dispatched_by,'')),'') is null then raise exception 'Dispatched By is required'; end if;
  if p_dispatch_mode not in ('Bus','Transport','By Hand') then raise exception 'Invalid dispatch mode'; end if;
  if p_dispatch_mode in ('Bus','Transport') and nullif(trim(coalesce(p_reference_no,'')),'') is null then raise exception 'Ref. No. is required for Bus or Transport'; end if;

  select * into v_before from public.portal_tada_dispatches where id=p_dispatch_id for update;
  if v_before.id is null then raise exception 'TA/DA dispatch not found'; end if;

  update public.portal_tada_dispatches
  set dispatch_date=p_dispatch_date,
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

create or replace function public.portal_developer_update_tada_svr(
  p_item_id uuid,
  p_svr_no text,
  p_engineer_id uuid,
  p_engineer_name text,
  p_date_from date,
  p_date_to date,
  p_machine_no text,
  p_customer_name text,
  p_reason text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.portal_profiles;
  v_before public.portal_tada_svr_items;
  v_after public.portal_tada_svr_items;
  v_dispatch public.portal_tada_dispatches;
begin
  v_profile := public.portal_developer_profile();
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Override reason is required'; end if;
  if nullif(trim(coalesce(p_svr_no,'')),'') is null or nullif(trim(coalesce(p_engineer_name,'')),'') is null
     or p_date_from is null or p_date_to is null or p_date_to<p_date_from
     or nullif(trim(coalesce(p_machine_no,'')),'') is null or nullif(trim(coalesce(p_customer_name,'')),'') is null then
    raise exception 'Complete all SVR fields before saving';
  end if;

  select * into v_before from public.portal_tada_svr_items where id=p_item_id for update;
  if v_before.id is null then raise exception 'SVR item not found'; end if;
  select * into v_dispatch from public.portal_tada_dispatches where id=v_before.dispatch_id;

  if exists (
    select 1
    from public.portal_tada_svr_items i
    join public.portal_tada_dispatches d on d.id=i.dispatch_id
    where i.id<>p_item_id
      and upper(trim(i.svr_no))=upper(trim(p_svr_no))
      and d.status<>'COMPLETED'
  ) then raise exception 'SVR % is already part of another active TA/DA dispatch', trim(p_svr_no); end if;

  update public.portal_tada_svr_items
  set svr_no=upper(trim(p_svr_no)),
      engineer_id=p_engineer_id,
      engineer_name_snapshot=trim(p_engineer_name),
      date_from=p_date_from,
      date_to=p_date_to,
      machine_no=upper(trim(p_machine_no)),
      customer_name=trim(p_customer_name),
      updated_at=now()
  where id=p_item_id
  returning * into v_after;

  insert into public.portal_tada_events(dispatch_id,svr_item_id,event_type,actor_id,actor_name_snapshot,actor_role_snapshot,metadata)
  values(v_before.dispatch_id,p_item_id,'DEVELOPER_SVR_EDITED',v_profile.id,v_profile.full_name,v_profile.role,
    jsonb_build_object('reason',trim(p_reason),'before',to_jsonb(v_before),'after',to_jsonb(v_after)));

  insert into public.portal_developer_override_audit(module,action,entity_id,entity_ref,reason,snapshot,actor_id,actor_name)
  values('TADA','EDIT_SVR',p_item_id,v_before.svr_no,trim(p_reason),
    jsonb_build_object('dispatch_no',v_dispatch.dispatch_no,'before',to_jsonb(v_before),'after',to_jsonb(v_after)),v_profile.id,v_profile.full_name);
end $$;

create or replace function public.portal_recalculate_tada_after_developer_delete(p_dispatch_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_total int;
  v_status text;
begin
  select count(*) into v_total from public.portal_tada_svr_items where dispatch_id=p_dispatch_id;
  if v_total=0 then return; end if;

  if exists(select 1 from public.portal_tada_svr_items where dispatch_id=p_dispatch_id and hq_received is null) then
    v_status := 'AWAITING_HQ_RECEIPT';
  elsif exists(select 1 from public.portal_tada_svr_items where dispatch_id=p_dispatch_id and hq_received=false) then
    v_status := 'PARTIALLY_RECEIVED_HQ';
  elsif exists(select 1 from public.portal_tada_svr_items where dispatch_id=p_dispatch_id and hq_received=true and accounts_received is null) then
    v_status := 'AWAITING_ACCOUNTS_RECEIPT';
  elsif exists(select 1 from public.portal_tada_svr_items where dispatch_id=p_dispatch_id and hq_received=true and accounts_received=false) then
    v_status := 'PARTIALLY_RECEIVED_ACCOUNTS';
  else
    v_status := 'COMPLETED';
  end if;

  update public.portal_tada_dispatches
  set total_svr_count=v_total,status=v_status,updated_at=now()
  where id=p_dispatch_id;

  update public.portal_tada_receipts r
  set expected_count=(select count(*) from public.portal_tada_receipt_items ri where ri.receipt_id=r.id),
      received_count=(select count(*) from public.portal_tada_receipt_items ri where ri.receipt_id=r.id and ri.received),
      missing_count=(select count(*) from public.portal_tada_receipt_items ri where ri.receipt_id=r.id and not ri.received)
  where r.dispatch_id=p_dispatch_id;
end $$;

create or replace function public.portal_developer_delete_tada_svr(
  p_item_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.portal_profiles;
  v_item public.portal_tada_svr_items;
  v_dispatch public.portal_tada_dispatches;
  v_count int;
begin
  v_profile := public.portal_developer_profile();
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Override reason is required'; end if;

  select * into v_item from public.portal_tada_svr_items where id=p_item_id for update;
  if v_item.id is null then raise exception 'SVR item not found'; end if;
  select * into v_dispatch from public.portal_tada_dispatches where id=v_item.dispatch_id for update;
  select count(*) into v_count from public.portal_tada_svr_items where dispatch_id=v_item.dispatch_id;
  if v_count<=1 then raise exception 'A dispatch must contain at least one SVR. Delete the complete dispatch instead.'; end if;

  insert into public.portal_developer_override_audit(module,action,entity_id,entity_ref,reason,snapshot,actor_id,actor_name)
  values('TADA','DELETE_SVR',v_item.id,v_item.svr_no,trim(p_reason),
    jsonb_build_object('dispatch',to_jsonb(v_dispatch),'svr',to_jsonb(v_item)),v_profile.id,v_profile.full_name);

  delete from public.portal_tada_svr_items where id=p_item_id;
  perform public.portal_recalculate_tada_after_developer_delete(v_item.dispatch_id);

  insert into public.portal_tada_events(dispatch_id,event_type,actor_id,actor_name_snapshot,actor_role_snapshot,metadata)
  values(v_item.dispatch_id,'DEVELOPER_SVR_DELETED',v_profile.id,v_profile.full_name,v_profile.role,
    jsonb_build_object('reason',trim(p_reason),'deleted_svr',to_jsonb(v_item)));
end $$;

create or replace function public.portal_developer_delete_tada_dispatch(
  p_dispatch_id uuid,
  p_reason text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.portal_profiles;
  v_dispatch public.portal_tada_dispatches;
  v_snapshot jsonb;
begin
  v_profile := public.portal_developer_profile();
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Override reason is required'; end if;
  select * into v_dispatch from public.portal_tada_dispatches where id=p_dispatch_id for update;
  if v_dispatch.id is null then raise exception 'TA/DA dispatch not found'; end if;

  select jsonb_build_object(
    'dispatch',to_jsonb(v_dispatch),
    'svrs',coalesce((select jsonb_agg(to_jsonb(i)) from public.portal_tada_svr_items i where i.dispatch_id=p_dispatch_id),'[]'::jsonb),
    'receipts',coalesce((select jsonb_agg(to_jsonb(r)) from public.portal_tada_receipts r where r.dispatch_id=p_dispatch_id),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(to_jsonb(e)) from public.portal_tada_events e where e.dispatch_id=p_dispatch_id),'[]'::jsonb)
  ) into v_snapshot;

  insert into public.portal_developer_override_audit(module,action,entity_id,entity_ref,reason,snapshot,actor_id,actor_name)
  values('TADA','DELETE_DISPATCH',p_dispatch_id,v_dispatch.dispatch_no,trim(p_reason),v_snapshot,v_profile.id,v_profile.full_name);

  delete from public.portal_tada_dispatches where id=p_dispatch_id;
end $$;

create or replace function public.portal_developer_delete_installation(
  p_installation_id uuid,
  p_reason text
) returns text[]
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.portal_profiles;
  v_entry public.portal_installation_entries;
  v_snapshot jsonb;
  v_paths text[];
begin
  v_profile := public.portal_developer_profile();
  if nullif(trim(coalesce(p_reason,'')),'') is null then raise exception 'Override reason is required'; end if;
  select * into v_entry from public.portal_installation_entries where id=p_installation_id for update;
  if v_entry.id is null then raise exception 'Engine & Breaker entry not found'; end if;

  select coalesce(array_agg(storage_path),'{}'::text[]) into v_paths
  from public.portal_installation_documents where installation_id=p_installation_id;

  select jsonb_build_object(
    'entry',to_jsonb(v_entry),
    'items',coalesce((select jsonb_agg(to_jsonb(i)) from public.portal_installation_items i where i.installation_id=p_installation_id),'[]'::jsonb),
    'documents',coalesce((select jsonb_agg(to_jsonb(d)) from public.portal_installation_documents d where d.installation_id=p_installation_id),'[]'::jsonb)
  ) into v_snapshot;

  insert into public.portal_developer_override_audit(module,action,entity_id,entity_ref,reason,snapshot,actor_id,actor_name)
  values('INSTALLATION','DELETE_ENTRY',p_installation_id,v_entry.entry_no,trim(p_reason),v_snapshot,v_profile.id,v_profile.full_name);

  delete from public.portal_installation_entries where id=p_installation_id;
  return v_paths;
end $$;

grant execute on function public.portal_developer_update_tada_dispatch(uuid,date,text,text,text,text) to authenticated;
grant execute on function public.portal_developer_update_tada_svr(uuid,text,uuid,text,date,date,text,text,text) to authenticated;
grant execute on function public.portal_developer_delete_tada_svr(uuid,text) to authenticated;
grant execute on function public.portal_developer_delete_tada_dispatch(uuid,text) to authenticated;
grant execute on function public.portal_developer_delete_installation(uuid,text) to authenticated;
