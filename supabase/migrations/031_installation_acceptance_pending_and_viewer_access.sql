-- Installation workflow refinement: branch-wide completion, viewer-wide read access,
-- and explicit Acceptance Pending status.

alter table public.portal_installation_entries
  drop constraint if exists portal_installation_entries_status_check;

update public.portal_installation_entries
set status = 'ACCEPTANCE_PENDING', updated_at = now()
where status = 'COMPLETED';

alter table public.portal_installation_entries
  add constraint portal_installation_entries_status_check
  check (status in ('PENDING','ACCEPTANCE_PENDING','ACCEPTED'));

create or replace function public.portal_can_view_installation(p_entry public.portal_installation_entries)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.portal_profiles p
    where p.auth_user_id=auth.uid() and coalesce(p.is_active,true)
      and (
        public.portal_can_manage_installations()
        or p.role = 'viewer'
        or public.portal_is_installation_service_crm()
        or upper(replace(coalesce(p.branch,''),' ','_'))=upper(replace(coalesce(p_entry.branch,''),' ','_'))
      )
  )
$$;

create or replace function public.portal_submit_installation_entry(p_installation_id uuid, p_jcb_invoice_no text, p_svr_no text)
returns void language plpgsql security definer set search_path=public as $$
declare v_profile public.portal_profiles; v_entry public.portal_installation_entries; v_docs int;
begin
  select * into v_profile from public.portal_profiles where auth_user_id=auth.uid() and coalesce(is_active,true) limit 1;
  select * into v_entry from public.portal_installation_entries where id=p_installation_id for update;
  if v_profile.id is null then raise exception 'Active profile not found'; end if;
  if v_entry.id is null or v_entry.status<>'PENDING' then raise exception 'Entry is not pending'; end if;
  if upper(replace(coalesce(v_profile.branch,''),' ','_'))<>upper(replace(coalesce(v_entry.branch,''),' ','_')) then raise exception 'Entry belongs to another branch'; end if;
  if nullif(trim(p_jcb_invoice_no),'') is null then raise exception 'JCB Invoice No. is required'; end if;
  if nullif(trim(p_svr_no),'') is null then raise exception 'SVR No. is required'; end if;
  select count(distinct document_type) into v_docs from public.portal_installation_documents where installation_id=p_installation_id and is_active and document_type in ('JCB_INVOICE','DBMS_INVOICE','SVR');
  if v_docs<3 then raise exception 'JCB Invoice, DBMS Invoice and SVR uploads are required'; end if;
  update public.portal_installation_entries
  set status='ACCEPTANCE_PENDING',jcb_invoice_no=trim(p_jcb_invoice_no),svr_no=trim(p_svr_no),branch_submitted_by=v_profile.id,branch_submitted_at=now(),updated_at=now()
  where id=p_installation_id;
end $$;

create or replace function public.portal_accept_installation_entry(p_installation_id uuid, p_registration_no text)
returns void language plpgsql security definer set search_path=public as $$
declare v_profile public.portal_profiles; v_entry public.portal_installation_entries;
begin
  select * into v_profile from public.portal_profiles where auth_user_id=auth.uid() and coalesce(is_active,true) limit 1;
  if v_profile.id is null or not public.portal_is_installation_service_crm() then raise exception 'Only Service CRM can accept entries'; end if;
  select * into v_entry from public.portal_installation_entries where id=p_installation_id for update;
  if v_entry.id is null or v_entry.status<>'ACCEPTANCE_PENDING' then raise exception 'Only Acceptance Pending entries can be accepted'; end if;
  if nullif(trim(p_registration_no),'') is null then raise exception 'Equipment registration number is required'; end if;
  update public.portal_installation_entries set status='ACCEPTED',equipment_registration_no=trim(p_registration_no),accepted_by=v_profile.id,accepted_at=now(),updated_at=now() where id=p_installation_id;
end $$;

grant execute on function public.portal_submit_installation_entry(uuid,text,text) to authenticated;
grant execute on function public.portal_accept_installation_entry(uuid,text) to authenticated;
