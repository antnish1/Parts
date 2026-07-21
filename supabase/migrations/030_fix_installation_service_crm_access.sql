-- Treat the configured Service CRM identifier as either portal_profiles.id or auth.users.id.
create or replace function public.portal_is_installation_service_crm()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.portal_profiles p
    where p.auth_user_id = auth.uid() and coalesce(p.is_active,true)
      and (
        p.id = '9f3c378e-89d4-4427-87f2-c66061dbf3e2'::uuid
        or p.auth_user_id = '9f3c378e-89d4-4427-87f2-c66061dbf3e2'::uuid
      )
  )
$$;

create or replace function public.portal_can_view_installation(p_entry public.portal_installation_entries)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.portal_profiles p
    where p.auth_user_id=auth.uid() and coalesce(p.is_active,true)
      and (
        public.portal_can_manage_installations()
        or public.portal_is_installation_service_crm()
        or upper(replace(coalesce(p.branch,''),' ','_'))=upper(replace(coalesce(p_entry.branch,''),' ','_'))
      )
  )
$$;

create or replace function public.portal_accept_installation_entry(p_installation_id uuid, p_registration_no text)
returns void language plpgsql security definer set search_path=public as $$
declare v_profile public.portal_profiles; v_entry public.portal_installation_entries;
begin
  select * into v_profile from public.portal_profiles where auth_user_id=auth.uid() and coalesce(is_active,true) limit 1;
  if v_profile.id is null or not public.portal_is_installation_service_crm() then raise exception 'Only Service CRM can accept entries'; end if;
  select * into v_entry from public.portal_installation_entries where id=p_installation_id for update;
  if v_entry.id is null or v_entry.status<>'COMPLETED' then raise exception 'Only completed entries can be accepted'; end if;
  if nullif(trim(p_registration_no),'') is null then raise exception 'Equipment registration number is required'; end if;
  update public.portal_installation_entries set status='ACCEPTED',equipment_registration_no=trim(p_registration_no),accepted_by=v_profile.id,accepted_at=now(),updated_at=now() where id=p_installation_id;
end $$;

grant execute on function public.portal_is_installation_service_crm() to authenticated;
grant execute on function public.portal_accept_installation_entry(uuid,text) to authenticated;
