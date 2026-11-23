-- Give exactly the verified SHUBHAM branch account Saloni's existing cross-branch grants.
-- Other users and pre-existing Saloni permissions remain unchanged.
do $grant$
declare
  saloni_id uuid := '6a4fad26-55bb-4894-a2cd-e2b2cfa070e8';
  shubham_id uuid := 'd90d0384-540c-43bf-b7b7-07d60814be67';
  saloni_ok boolean;
  shubham_ok boolean;
  grant_count integer;
begin
  select exists(
    select 1 from public.portal_profiles
    where id=saloni_id
      and auth_user_id='767bd1c7-3c4c-4925-b125-888a27906250'
      and upper(trim(legacy_user_id))='SALONI'
      and role='branch' and is_active is true
  ) into saloni_ok;
  select exists(
    select 1 from public.portal_profiles
    where id=shubham_id
      and auth_user_id='d49ab8cd-4169-4de3-86a3-a70cf5ad377e'
      and upper(trim(legacy_user_id))='SHUBHAM'
      and role='branch' and is_active is true
  ) into shubham_ok;
  if not saloni_ok or not shubham_ok then
    raise exception 'Saloni/Shubham identity verification failed; permissions unchanged';
  end if;
  select count(*) into grant_count
  from public.portal_cross_branch_read_grants
  where profile_id=saloni_id and module in ('tada','credit_dispatch');
  if grant_count <> 2 then
    raise exception 'Saloni reference grants changed; expected both modules';
  end if;
  insert into public.portal_cross_branch_read_grants(profile_id,module,reason)
  select shubham_id,module,'User-approved parity with Saloni Patel (2026-11-23)'
  from public.portal_cross_branch_read_grants
  where profile_id=saloni_id and module in ('tada','credit_dispatch')
  on conflict (profile_id,module) do nothing;
end $grant$;

-- Both named accounts may choose a different office while creating a TA/DA dispatch.
-- Do not use generic cross-branch read grants as authorization for every holder.
create or replace function public.portal_can_create_tada_cross_branch()
returns boolean language sql stable security definer set search_path = public as $function$
  select exists (
    select 1 from public.portal_profiles p
    join public.portal_cross_branch_read_grants g on g.profile_id=p.id and g.module='tada'
    where p.auth_user_id=auth.uid()
      and p.is_active is true
      and p.role='branch'
      and (
        (p.id='6a4fad26-55bb-4894-a2cd-e2b2cfa070e8'::uuid
         and p.auth_user_id='767bd1c7-3c4c-4925-b125-888a27906250'::uuid
         and upper(trim(p.legacy_user_id))='SALONI')
        or
        (p.id='d90d0384-540c-43bf-b7b7-07d60814be67'::uuid
         and p.auth_user_id='d49ab8cd-4169-4de3-86a3-a70cf5ad377e'::uuid
         and upper(trim(p.legacy_user_id))='SHUBHAM')
      )
  );
$function$;
revoke all on function public.portal_can_create_tada_cross_branch() from public, anon;
grant execute on function public.portal_can_create_tada_cross_branch() to authenticated;
