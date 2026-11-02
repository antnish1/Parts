-- Saloni-only TA/DA dispatch office selection. Existing cross-branch read grant is not write permission.
-- Deliberately fail closed if the verified identity or RPC definition differs.
create or replace function public.portal_can_create_tada_cross_branch()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.portal_profiles p
    join public.portal_cross_branch_read_grants g on g.profile_id=p.id and g.module='tada'
    where p.auth_user_id=auth.uid()
      and p.is_active is true
      and p.role='branch'
      and lower(btrim(p.full_name))='saloni patel'
      and upper(regexp_replace(coalesce(p.branch,''),'[^A-Za-z0-9]','','g'))='JABALPURBHL'
  );
$$;
revoke all on function public.portal_can_create_tada_cross_branch() from public, anon;
grant execute on function public.portal_can_create_tada_cross_branch() to authenticated;

do $$
declare
  v_oid oid;
  v_definition text;
  v_old text := 'if v_profile.role=''branch'' and coalesce(public.resolve_portal_branch(v_profile.branch),v_profile.branch)<>v_branch then';
  v_new text := 'if v_profile.role=''branch'' and not public.portal_can_create_tada_cross_branch() and coalesce(public.resolve_portal_branch(v_profile.branch),v_profile.branch)<>v_branch then';
begin
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='portal_create_tada_dispatch'
    and pg_get_function_identity_arguments(p.oid)='p_branch text, p_dispatch_date date, p_dispatched_by text, p_dispatch_mode text, p_reference_no text, p_items jsonb';
  if v_oid is null then raise exception 'TA/DA create RPC signature has changed: no migration applied'; end if;
  v_definition := pg_get_functiondef(v_oid);
  if position(v_old in v_definition)=0 then raise exception 'TA/DA create RPC guard has changed: no migration applied'; end if;
  execute replace(v_definition,v_old,v_new);
end $$;
