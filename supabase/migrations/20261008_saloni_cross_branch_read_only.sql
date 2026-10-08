-- Narrow, audited read-only all-branch visibility for one verified branch profile.
-- Does not grant any Accounts, Manager, Developer, payment, or approval authority.
create table if not exists public.portal_cross_branch_read_grants (
  profile_id uuid not null references public.portal_profiles(id) on delete cascade,
  module text not null check (module in ('tada', 'credit_dispatch')),
  granted_at timestamptz not null default now(),
  reason text not null,
  primary key (profile_id, module)
);
revoke all on public.portal_cross_branch_read_grants from public, anon, authenticated;
alter table public.portal_cross_branch_read_grants enable row level security;

-- Fail closed rather than accidentally assigning privileges to a same-name account.
do $$
declare
  v_profile_id uuid;
  v_count integer;
begin
  select count(*), min(id) into v_count, v_profile_id
  from public.portal_profiles
  where lower(btrim(full_name)) = 'saloni patel'
    and role = 'branch'
    and coalesce(is_active, false)
    and upper(regexp_replace(coalesce(branch,''), '[^A-Za-z0-9]', '', 'g')) = 'JABALPURBHL'
    and auth_user_id is not null;
  if v_count <> 1 then
    raise exception 'Expected exactly one active, authenticated Saloni Patel branch profile in JABALPUR_BHL; found %. No read grant applied.', v_count;
  end if;
  insert into public.portal_cross_branch_read_grants(profile_id, module, reason)
  values (v_profile_id, 'tada', 'User-approved all-branch TA/DA read-only access (2026-10-08)'),
         (v_profile_id, 'credit_dispatch', 'User-approved all-branch Credit Dispatch read-only access (2026-10-08)')
  on conflict (profile_id, module) do nothing;
end $$;

create or replace function public.portal_has_cross_branch_read(p_module text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1
    from public.portal_profiles p
    join public.portal_cross_branch_read_grants g on g.profile_id = p.id
    where p.auth_user_id = auth.uid()
      and p.role = 'branch'
      and coalesce(p.is_active, false)
      and g.module = p_module
  );
$$;
revoke all on function public.portal_has_cross_branch_read(text) from public;
grant execute on function public.portal_has_cross_branch_read(text) to authenticated;

-- Existing TA/DA read policies for SVRs, receipts and events call this helper.
-- The branch-wide exception is read-only and is NOT used by receipt/update RPCs.
create or replace function public.portal_can_view_tada_branch(p_branch text)
returns boolean language sql stable security definer set search_path=public as $$
  select public.portal_has_cross_branch_read('tada') or exists (
    select 1 from public.portal_profiles p
    where p.auth_user_id=auth.uid() and coalesce(p.is_active,true)
      and (
        p.role in ('manager','developer','hq','accounts')
        or (p.role='branch' and coalesce(public.resolve_portal_branch(p.branch),p.branch)=p_branch)
      )
  );
$$;

-- Dispatch SELECT: grant all-branch visibility without widening UPDATE/INSERT policies.
drop policy if exists credit_dispatch_select_policy on public.portal_credit_dispatches;
create policy credit_dispatch_select_policy on public.portal_credit_dispatches
for select to authenticated
using (
  public.portal_has_cross_branch_read('credit_dispatch')
  or exists (
    select 1 from public.portal_current_profile_for_rls() p
    where p.role in ('accounts','manager','admin','developer','super')
       or portal_credit_dispatches.branch = p.branch
       or portal_credit_dispatches.created_by = p.id
  )
);

-- SELECT-only detail history helper. Keep write permissions on pre-existing scope.
create or replace function public.portal_can_access_credit_dispatch(p_dispatch_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.portal_credit_dispatches d
    cross join public.portal_current_profile_for_rls() p
    where d.id = p_dispatch_id and (
      p.role in ('accounts','manager','admin','developer','super')
      or d.branch = p.branch
      or d.created_by = p.id
      or public.portal_has_cross_branch_read('credit_dispatch')
    )
  );
$$;

-- Important: the existing payment/event INSERT policies also used the read helper.
-- Decouple them to prevent newly visible cross-branch records becoming writable.
create or replace function public.portal_can_write_credit_dispatch_child(p_dispatch_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.portal_credit_dispatches d
    cross join public.portal_current_profile_for_rls() p
    where d.id = p_dispatch_id and (
      p.role in ('accounts','manager','admin','developer','super')
      or d.branch = p.branch
      or d.created_by = p.id
    )
  );
$$;
revoke all on function public.portal_can_write_credit_dispatch_child(uuid) from public;
grant execute on function public.portal_can_write_credit_dispatch_child(uuid) to authenticated;
drop policy if exists credit_dispatch_payments_insert_policy on public.portal_credit_dispatch_payments;
create policy credit_dispatch_payments_insert_policy on public.portal_credit_dispatch_payments
for insert to authenticated
with check (public.portal_can_write_credit_dispatch_child(dispatch_id));
drop policy if exists credit_dispatch_events_insert_policy on public.portal_credit_dispatch_events;
create policy credit_dispatch_events_insert_policy on public.portal_credit_dispatch_events
for insert to authenticated
with check (public.portal_can_write_credit_dispatch_child(dispatch_id));

-- Read of customer record accompanying a visible dispatch, without permission to alter it.
drop policy if exists credit_customers_select_policy on public.portal_credit_customers;
create policy credit_customers_select_policy on public.portal_credit_customers
for select to authenticated using (
  exists (
    select 1 from public.portal_current_profile_for_rls() p
    where p.role in ('accounts','manager','admin','developer','super')
      or portal_credit_customers.default_branch = p.branch
      or portal_credit_customers.created_by = p.id
      or exists (
        select 1 from public.portal_credit_dispatches d
        where d.customer_id = portal_credit_customers.id
          and (d.branch = p.branch or d.created_by = p.id)
      )
  )
  or (
    public.portal_has_cross_branch_read('credit_dispatch')
    and exists (
      select 1 from public.portal_credit_dispatches d
      where d.customer_id = portal_credit_customers.id
    )
  )
);
