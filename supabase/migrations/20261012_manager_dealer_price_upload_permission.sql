-- Expand only Dealer Price List management to active managers.
-- This guard is shared by start/stage/preview/publish/discard/history RPCs.
-- Existing upload ownership verification and publication confirmation remain unchanged.
create or replace function public.portal_price_master_actor()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_role text;
begin
  select id, role into v_profile_id, v_role
  from public.portal_profiles
  where auth_user_id = auth.uid()
    and coalesce(is_active, false) = true
  limit 1;

  if v_profile_id is null or v_role not in ('admin', 'developer', 'manager') then
    raise exception 'Only active Admin, Developer or Manager users can manage the Dealer Price List';
  end if;

  return v_profile_id;
end;
$$;
revoke all on function public.portal_price_master_actor() from public, anon, authenticated;
