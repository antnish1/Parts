-- Credit Dispatch two-stage approval workflow:
-- Branch -> Accounts -> Manager -> Payment Recovery.
-- Rejections are final. Any correction resubmission restarts at Accounts.

alter table public.portal_credit_dispatches
  drop constraint if exists portal_credit_dispatches_approval_status_check;

update public.portal_credit_dispatches
set approval_status = case approval_status
  when 'Pending Approval' then 'Pending Accounts Approval'
  when 'Correction Required' then 'Correction Requested by Manager'
  when 'Rejected' then 'Rejected by Manager'
  else approval_status
end
where approval_status in ('Pending Approval', 'Correction Required', 'Rejected');

alter table public.portal_credit_dispatches
  add constraint portal_credit_dispatches_approval_status_check
  check (
    approval_status in (
      'Draft',
      'Pending Accounts Approval',
      'Pending Manager Approval',
      'Approved',
      'Rejected by Accounts',
      'Rejected by Manager',
      'Correction Requested by Accounts',
      'Correction Requested by Manager'
    )
  );

create or replace function public.portal_credit_dispatch_guard_approval_transition()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.portal_profiles%rowtype;
begin
  if new.approval_status is not distinct from old.approval_status then
    return new;
  end if;

  select * into v_profile
  from public.portal_profiles
  where auth_user_id = auth.uid()
    and coalesce(is_active, false) = true
  limit 1;

  if v_profile.id is null then
    raise exception 'Active portal profile is required';
  end if;

  if old.approval_status = 'Pending Accounts Approval' then
    if v_profile.role not in ('accounts', 'developer') then
      raise exception 'Accounts approval is required before Manager can act';
    end if;
    if new.approval_status not in ('Pending Manager Approval', 'Rejected by Accounts', 'Correction Requested by Accounts') then
      raise exception 'Invalid Accounts approval transition';
    end if;
    return new;
  end if;

  if old.approval_status = 'Pending Manager Approval' then
    if v_profile.role not in ('manager', 'developer') then
      raise exception 'Only Manager or Developer can review this stage';
    end if;
    if new.approval_status not in ('Approved', 'Rejected by Manager', 'Correction Requested by Manager') then
      raise exception 'Invalid Manager approval transition';
    end if;
    return new;
  end if;

  if old.approval_status in ('Correction Requested by Accounts', 'Correction Requested by Manager') then
    if v_profile.role <> 'developer' then
      if v_profile.role <> 'branch' then
        raise exception 'Only the owning Branch can resubmit a correction';
      end if;
      if public.resolve_portal_branch(old.branch) is distinct from public.resolve_portal_branch(v_profile.branch) then
        raise exception 'This correction belongs to another branch';
      end if;
    end if;
    if new.approval_status <> 'Pending Accounts Approval' then
      raise exception 'Corrected requests must restart from Accounts approval';
    end if;
    return new;
  end if;

  raise exception 'This Credit Dispatch approval state is final or cannot be changed';
end;
$$;

drop trigger if exists trg_credit_dispatch_guard_approval_transition on public.portal_credit_dispatches;
create trigger trg_credit_dispatch_guard_approval_transition
before update of approval_status on public.portal_credit_dispatches
for each row
execute function public.portal_credit_dispatch_guard_approval_transition();

create or replace function public.portal_review_credit_dispatch(
  p_dispatch_id uuid,
  p_action text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.portal_profiles%rowtype;
  v_dispatch public.portal_credit_dispatches%rowtype;
  v_action text := trim(coalesce(p_action, ''));
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_next_status text;
  v_event_type text;
  v_event_note text;
begin
  select * into v_profile
  from public.portal_profiles
  where auth_user_id = auth.uid()
    and coalesce(is_active, false) = true
  limit 1;

  if v_profile.id is null then
    raise exception 'Active portal profile is required';
  end if;

  select * into v_dispatch
  from public.portal_credit_dispatches
  where id = p_dispatch_id
  for update;

  if v_dispatch.id is null then
    raise exception 'Credit Dispatch request not found';
  end if;

  if v_action not in ('Approved', 'Rejected', 'Correction Required') then
    raise exception 'Invalid review action';
  end if;

  if v_action in ('Rejected', 'Correction Required') and v_note is null then
    raise exception 'A note / reason is required';
  end if;

  if v_dispatch.approval_status = 'Pending Accounts Approval' then
    if v_profile.role not in ('accounts', 'developer') then
      raise exception 'Accounts approval is required before Manager can act';
    end if;

    if v_action = 'Approved' then
      v_next_status := 'Pending Manager Approval';
      v_event_type := 'Approved by Accounts';
      v_event_note := coalesce(v_note, 'Approved by Accounts and forwarded for Manager approval.');
    elsif v_action = 'Rejected' then
      v_next_status := 'Rejected by Accounts';
      v_event_type := 'Rejected by Accounts';
      v_event_note := v_note;
    else
      v_next_status := 'Correction Requested by Accounts';
      v_event_type := 'Correction Requested by Accounts';
      v_event_note := v_note;
    end if;

  elsif v_dispatch.approval_status = 'Pending Manager Approval' then
    if v_profile.role not in ('manager', 'developer') then
      raise exception 'Only Manager or Developer can review this stage';
    end if;

    if v_action = 'Approved' then
      v_next_status := 'Approved';
      v_event_type := 'Approved by Manager';
      v_event_note := coalesce(v_note, 'Approved by Manager. Payment recovery can begin.');
    elsif v_action = 'Rejected' then
      v_next_status := 'Rejected by Manager';
      v_event_type := 'Rejected by Manager';
      v_event_note := v_note;
    else
      v_next_status := 'Correction Requested by Manager';
      v_event_type := 'Correction Requested by Manager';
      v_event_note := v_note;
    end if;

  else
    raise exception 'This request is not awaiting review at your stage';
  end if;

  update public.portal_credit_dispatches
  set
    approval_status = v_next_status,
    rejection_reason = case
      when v_next_status in ('Rejected by Accounts', 'Rejected by Manager') then v_note
      else null
    end,
    correction_note = case
      when v_next_status in ('Correction Requested by Accounts', 'Correction Requested by Manager') then v_note
      else null
    end,
    approved_by = case when v_next_status = 'Approved' then v_profile.id else null end,
    approved_at = case when v_next_status = 'Approved' then now() else null end,
    updated_at = now()
  where id = p_dispatch_id;

  insert into public.portal_credit_dispatch_events (
    dispatch_id,
    event_type,
    event_note,
    created_by
  ) values (
    p_dispatch_id,
    v_event_type,
    case when v_profile.role = 'developer' then v_event_note || ' (Developer override)' else v_event_note end,
    v_profile.id
  );
end;
$$;

grant execute on function public.portal_review_credit_dispatch(uuid, text, text) to authenticated;

-- Accounts may view Credit Dispatch and its related payment/event history.
create or replace function public.portal_is_credit_dispatch_privileged()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('accounts', 'manager', 'admin', 'developer', 'super')
  );
$$;

create or replace function public.portal_can_access_credit_dispatch(p_dispatch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portal_credit_dispatches d
    cross join public.portal_current_profile_for_rls() p
    where d.id = p_dispatch_id
      and (
        p.role in ('accounts', 'manager', 'admin', 'developer', 'super')
        or d.branch = p.branch
        or d.created_by = p.id
      )
  );
$$;

drop policy if exists credit_dispatch_select_policy on public.portal_credit_dispatches;
create policy credit_dispatch_select_policy
on public.portal_credit_dispatches
for select
to authenticated
using (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('accounts', 'manager', 'admin', 'developer', 'super')
      or portal_credit_dispatches.branch = p.branch
      or portal_credit_dispatches.created_by = p.id
  )
);


-- New requests are Branch-originated. Approval roles review through the RPC above.
drop policy if exists credit_dispatch_insert_policy on public.portal_credit_dispatches;
create policy credit_dispatch_insert_policy
on public.portal_credit_dispatches
for insert
to authenticated
with check (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role = 'branch'
      and coalesce(public.resolve_portal_branch(portal_credit_dispatches.branch), portal_credit_dispatches.branch) = p.branch
  )
);

-- Direct row edits are limited to the owning Branch (for correction) and Developer.
-- Accounts and Manager approval changes go only through portal_review_credit_dispatch.
drop policy if exists credit_dispatch_update_policy on public.portal_credit_dispatches;
create policy credit_dispatch_update_policy
on public.portal_credit_dispatches
for update
to authenticated
using (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role = 'developer'
      or (p.role = 'branch' and (portal_credit_dispatches.branch = p.branch or portal_credit_dispatches.created_by = p.id))
  )
)
with check (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role = 'developer'
      or (p.role = 'branch' and (portal_credit_dispatches.branch = p.branch or portal_credit_dispatches.created_by = p.id))
  )
);

drop policy if exists credit_customers_select_policy on public.portal_credit_customers;
create policy credit_customers_select_policy
on public.portal_credit_customers
for select
to authenticated
using (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('accounts', 'manager', 'admin', 'developer', 'super')
      or portal_credit_customers.default_branch = p.branch
      or portal_credit_customers.created_by = p.id
      or exists (
        select 1
        from public.portal_credit_dispatches d
        where d.customer_id = portal_credit_customers.id
          and (d.branch = p.branch or d.created_by = p.id)
      )
  )
);
