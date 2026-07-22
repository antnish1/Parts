-- Engine & Breaker stage-two refinements.
-- Adds mandatory equipment number and lets Manager/HQ/Developer/Admin complete any Pending entry.

alter table public.portal_installation_entries
  add column if not exists equipment_no text;

-- Assigned branch users and privileged operational users may upload/replace documents.
drop policy if exists installation_documents_insert on public.portal_installation_documents;
create policy installation_documents_insert on public.portal_installation_documents
for insert with check (
  exists (
    select 1
    from public.portal_installation_entries e
    join public.portal_profiles p on p.auth_user_id = auth.uid() and coalesce(p.is_active,true)
    where e.id = installation_id
      and e.status = 'PENDING'
      and (
        public.portal_can_manage_installations()
        or upper(replace(coalesce(p.branch,''),' ','_')) = upper(replace(coalesce(e.branch,''),' ','_'))
      )
  )
);

drop policy if exists installation_documents_update on public.portal_installation_documents;
create policy installation_documents_update on public.portal_installation_documents
for update using (
  exists (
    select 1
    from public.portal_installation_entries e
    join public.portal_profiles p on p.auth_user_id = auth.uid() and coalesce(p.is_active,true)
    where e.id = installation_id
      and e.status = 'PENDING'
      and (
        public.portal_can_manage_installations()
        or upper(replace(coalesce(p.branch,''),' ','_')) = upper(replace(coalesce(e.branch,''),' ','_'))
      )
  )
);

-- Replace the old three-argument submission RPC.
drop function if exists public.portal_submit_installation_entry(uuid,text,text);

create or replace function public.portal_submit_installation_entry(
  p_installation_id uuid,
  p_equipment_no text,
  p_jcb_invoice_no text,
  p_svr_no text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.portal_profiles;
  v_entry public.portal_installation_entries;
  v_docs int;
  v_is_assigned_branch boolean;
begin
  select * into v_profile
  from public.portal_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)
  limit 1;

  select * into v_entry
  from public.portal_installation_entries
  where id=p_installation_id
  for update;

  if v_profile.id is null then raise exception 'Active profile not found'; end if;
  if v_entry.id is null or v_entry.status<>'PENDING' then raise exception 'Entry is not pending'; end if;

  v_is_assigned_branch := upper(replace(coalesce(v_profile.branch,''),' ','_')) = upper(replace(coalesce(v_entry.branch,''),' ','_'));
  if not v_is_assigned_branch and not public.portal_can_manage_installations() then
    raise exception 'Entry belongs to another branch';
  end if;

  if nullif(trim(p_equipment_no),'') is null then raise exception 'Equipment No. is required'; end if;
  if nullif(trim(p_jcb_invoice_no),'') is null then raise exception 'JCB Invoice No. is required'; end if;
  if nullif(trim(p_svr_no),'') is null then raise exception 'SVR No. is required'; end if;

  select count(distinct document_type) into v_docs
  from public.portal_installation_documents
  where installation_id=p_installation_id
    and is_active
    and document_type in ('JCB_INVOICE','DBMS_INVOICE','SVR');

  if v_docs<3 then raise exception 'JCB Invoice, DBMS Invoice and SVR uploads are required'; end if;

  update public.portal_installation_entries
  set status='ACCEPTANCE_PENDING',
      equipment_no=upper(trim(p_equipment_no)),
      jcb_invoice_no=trim(p_jcb_invoice_no),
      svr_no=trim(p_svr_no),
      branch_submitted_by=v_profile.id,
      branch_submitted_at=now(),
      updated_at=now()
  where id=p_installation_id;
end
$$;

grant execute on function public.portal_submit_installation_entry(uuid,text,text,text) to authenticated;
