-- Safe manager-first rollout: all existing rows are version 1 and retain Accounts -> Manager.
-- New rows (after migration activation only) are version 2: Manager -> Accounts.
-- Do not bulk change approval_status or historic event rows.
alter table public.portal_credit_dispatches
  add column if not exists approval_flow_version smallint not null default 1;
alter table public.portal_credit_dispatches
  alter column approval_flow_version set default 2;
alter table public.portal_credit_dispatches
  drop constraint if exists portal_credit_dispatches_approval_flow_version_check;
alter table public.portal_credit_dispatches
  add constraint portal_credit_dispatches_approval_flow_version_check check (approval_flow_version in (1, 2));

-- Enforce the new entry stage, including requests from older web/mobile installations.
create or replace function public.portal_credit_dispatch_normalize_initial_stage()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.approval_flow_version = 2 and new.approval_status in ('Draft','Pending Accounts Approval') then
    new.approval_status := 'Pending Manager Approval';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_portal_credit_dispatch_initial_stage on public.portal_credit_dispatches;
create trigger trg_portal_credit_dispatch_initial_stage before insert on public.portal_credit_dispatches
for each row execute function public.portal_credit_dispatch_normalize_initial_stage();

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

  -- New requests use Manager then Accounts; historic requests remain unchanged.
  if old.approval_flow_version = 2 then
    if old.approval_status in ('Correction Requested by Accounts', 'Correction Requested by Manager')
       and new.approval_status = 'Pending Accounts Approval' then
      -- Compatibility with older installed clients resubmitting corrections.
      new.approval_status := 'Pending Manager Approval';
    end if;
    if old.approval_status = 'Pending Manager Approval' then
      if v_profile.role not in ('manager', 'developer') then
        raise exception 'Manager approval is required before Accounts can act';
      end if;
      if new.approval_status not in ('Pending Accounts Approval','Rejected by Manager','Correction Requested by Manager') then
        raise exception 'Invalid Manager approval transition';
      end if;
      return new;
    elsif old.approval_status = 'Pending Accounts Approval' then
      if v_profile.role not in ('accounts', 'developer') then
        raise exception 'Only Accounts or Developer can perform final review';
      end if;
      if new.approval_status not in ('Approved','Rejected by Accounts','Correction Requested by Accounts') then
        raise exception 'Invalid Accounts approval transition';
      end if;
      return new;
    elsif old.approval_status in ('Correction Requested by Accounts','Correction Requested by Manager') then
      if v_profile.role <> 'developer' then
        if v_profile.role <> 'branch' or public.resolve_portal_branch(old.branch) is distinct from public.resolve_portal_branch(v_profile.branch) then
          raise exception 'Only the owning Branch can resubmit this correction';
        end if;
      end if;
      if new.approval_status <> 'Pending Manager Approval' then
        raise exception 'Corrected requests must restart from Manager approval';
      end if;
      return new;
    end if;
    raise exception 'This Credit Dispatch approval state is final or cannot be changed';
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

  if v_dispatch.approval_flow_version = 2 then
    if v_dispatch.approval_status = 'Pending Manager Approval' then
      if v_profile.role not in ('manager', 'developer') then
        raise exception 'Only Manager or Developer can review this stage';
      end if;
      if v_action = 'Approved' then
        v_next_status := 'Pending Accounts Approval';
        v_event_type := 'Approved by Manager';
        v_event_note := coalesce(v_note, 'Approved by Manager and forwarded for Accounts approval.');
      elsif v_action = 'Rejected' then
        v_next_status := 'Rejected by Manager';
        v_event_type := 'Rejected by Manager';
        v_event_note := v_note;
      else
        v_next_status := 'Correction Requested by Manager';
        v_event_type := 'Correction Requested by Manager';
        v_event_note := v_note;
      end if;
    elsif v_dispatch.approval_status = 'Pending Accounts Approval' then
      if v_profile.role not in ('accounts', 'developer') then
        raise exception 'Only Accounts or Developer can perform final review';
      end if;
      if v_action = 'Approved' then
        v_next_status := 'Approved';
        v_event_type := 'Approved by Accounts';
        v_event_note := coalesce(v_note, 'Approved by Accounts. Payment recovery can begin.');
      elsif v_action = 'Rejected' then
        v_next_status := 'Rejected by Accounts';
        v_event_type := 'Rejected by Accounts';
        v_event_note := v_note;
      else
        v_next_status := 'Correction Requested by Accounts';
        v_event_type := 'Correction Requested by Accounts';
        v_event_note := v_note;
      end if;
    else
      raise exception 'This request is not awaiting review at your stage';
    end if;
  elsif v_dispatch.approval_status = 'Pending Accounts Approval' then
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

-- Keep RPC execution permissions unchanged; existing grants on replacement functions persist.
