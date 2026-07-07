-- Credit Dispatch / Payment Recovery module
-- Phase 1: database foundation only. No existing order/inventory/docket workflow is changed.

create extension if not exists pgcrypto;

-- Storage buckets for signatures and payment proof attachments.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'credit-dispatch-signatures',
    'credit-dispatch-signatures',
    false,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'credit-dispatch-attachments',
    'credit-dispatch-attachments',
    false,
    10485760,
    array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.portal_credit_dispatch_counters (
  branch_key text not null,
  dispatch_year integer not null,
  last_serial integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (branch_key, dispatch_year)
);

create table if not exists public.portal_credit_dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_no text unique,
  branch text not null,
  created_by uuid references public.portal_profiles(id) on delete set null,
  approved_by uuid references public.portal_profiles(id) on delete set null,
  approved_at timestamptz,

  customer_name text not null,
  customer_type text not null check (customer_type in ('Major Account', 'Retailer', 'Customer')),
  mobile_no text not null,

  document_type text not null check (document_type in ('DC', 'Tax Invoice', 'PI')),
  document_no text,
  document_date date not null default current_date,

  credit_amount numeric(14,2) not null check (credit_amount >= 0),
  tentative_closure_days integer not null check (tentative_closure_days in (7, 15, 30)),
  due_date date not null,

  total_received_amount numeric(14,2) not null default 0 check (total_received_amount >= 0),
  balance_amount numeric(14,2) not null default 0,

  approval_status text not null default 'Draft' check (
    approval_status in ('Draft', 'Pending Approval', 'Approved', 'Rejected', 'Correction Required')
  ),
  recovery_status text not null default 'Pending Payment' check (
    recovery_status in ('Pending Payment', 'Partial Payment', 'Partial Payment - Overdue', 'Payment Overdue', 'Closed')
  ),

  customer_signature_path text,
  issuer_signature_path text,
  customer_signed_at timestamptz,
  issuer_signed_at timestamptz,

  remarks text,
  rejection_reason text,
  correction_note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_credit_dispatch_payments (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.portal_credit_dispatches(id) on delete cascade,
  received_amount numeric(14,2) not null check (received_amount > 0),
  received_date date not null default current_date,
  payment_mode text not null check (payment_mode in ('Cash', 'UPI', 'Bank', 'Cheque', 'Adjustment', 'Other')),
  reference_no text,
  remarks text,
  attachment_path text,
  created_by uuid references public.portal_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.portal_credit_dispatch_events (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.portal_credit_dispatches(id) on delete cascade,
  event_type text not null,
  event_note text,
  created_by uuid references public.portal_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_dispatch_branch on public.portal_credit_dispatches(branch);
create index if not exists idx_credit_dispatch_approval_status on public.portal_credit_dispatches(approval_status);
create index if not exists idx_credit_dispatch_recovery_status on public.portal_credit_dispatches(recovery_status);
create index if not exists idx_credit_dispatch_due_date on public.portal_credit_dispatches(due_date);
create index if not exists idx_credit_dispatch_created_by on public.portal_credit_dispatches(created_by);
create index if not exists idx_credit_dispatch_payments_dispatch on public.portal_credit_dispatch_payments(dispatch_id);
create index if not exists idx_credit_dispatch_events_dispatch on public.portal_credit_dispatch_events(dispatch_id);

create or replace function public.portal_credit_dispatch_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_credit_dispatch_touch_updated_at on public.portal_credit_dispatches;
create trigger trg_credit_dispatch_touch_updated_at
before update on public.portal_credit_dispatches
for each row execute function public.portal_credit_dispatch_touch_updated_at();

create or replace function public.next_portal_credit_dispatch_no(
  p_branch_key text,
  p_year integer default extract(year from current_date)::integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch_key text := upper(replace(trim(coalesce(p_branch_key, '')), ' ', '_'));
  v_next integer;
begin
  if nullif(v_branch_key, '') is null then
    raise exception 'Branch key is required for credit dispatch number';
  end if;

  insert into public.portal_credit_dispatch_counters (branch_key, dispatch_year, last_serial)
  values (v_branch_key, p_year, 1)
  on conflict (branch_key, dispatch_year)
  do update set
    last_serial = public.portal_credit_dispatch_counters.last_serial + 1,
    updated_at = now()
  returning last_serial into v_next;

  return 'CD/' || v_branch_key || '/' || p_year::text || '/' || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function public.portal_credit_dispatch_recovery_status(
  p_credit_amount numeric,
  p_received_amount numeric,
  p_due_date date
)
returns text
language sql
stable
as $$
  select case
    when coalesce(p_received_amount, 0) >= coalesce(p_credit_amount, 0) then 'Closed'
    when coalesce(p_received_amount, 0) > 0 and current_date > p_due_date then 'Partial Payment - Overdue'
    when coalesce(p_received_amount, 0) > 0 then 'Partial Payment'
    when current_date > p_due_date then 'Payment Overdue'
    else 'Pending Payment'
  end;
$$;

create or replace function public.portal_refresh_credit_dispatch_totals(p_dispatch_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_received numeric(14,2);
  v_credit numeric(14,2);
  v_due date;
begin
  select coalesce(sum(received_amount), 0)
  into v_received
  from public.portal_credit_dispatch_payments
  where dispatch_id = p_dispatch_id;

  select credit_amount, due_date
  into v_credit, v_due
  from public.portal_credit_dispatches
  where id = p_dispatch_id;

  update public.portal_credit_dispatches
  set
    total_received_amount = v_received,
    balance_amount = greatest(coalesce(v_credit, 0) - v_received, 0),
    recovery_status = public.portal_credit_dispatch_recovery_status(v_credit, v_received, v_due),
    updated_at = now()
  where id = p_dispatch_id;
end;
$$;

create or replace function public.portal_credit_dispatch_after_payment()
returns trigger
language plpgsql
as $$
begin
  perform public.portal_refresh_credit_dispatch_totals(coalesce(new.dispatch_id, old.dispatch_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_credit_dispatch_after_payment_insert on public.portal_credit_dispatch_payments;
create trigger trg_credit_dispatch_after_payment_insert
after insert on public.portal_credit_dispatch_payments
for each row execute function public.portal_credit_dispatch_after_payment();

drop trigger if exists trg_credit_dispatch_after_payment_update on public.portal_credit_dispatch_payments;
create trigger trg_credit_dispatch_after_payment_update
after update on public.portal_credit_dispatch_payments
for each row execute function public.portal_credit_dispatch_after_payment();

drop trigger if exists trg_credit_dispatch_after_payment_delete on public.portal_credit_dispatch_payments;
create trigger trg_credit_dispatch_after_payment_delete
after delete on public.portal_credit_dispatch_payments
for each row execute function public.portal_credit_dispatch_after_payment();

create or replace function public.portal_credit_dispatch_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.portal_profiles%rowtype;
  v_resolved_branch text;
begin
  select * into v_profile
  from public.portal_profiles
  where auth_user_id = auth.uid()
    and coalesce(is_active, false) = true
  limit 1;

  if v_profile.id is null then
    raise exception 'Active portal profile is required';
  end if;

  if new.created_by is null then
    new.created_by = v_profile.id;
  end if;

  if new.branch is null or trim(new.branch) = '' then
    new.branch = v_profile.branch;
  end if;

  begin
    v_resolved_branch = public.resolve_portal_branch(new.branch);
  exception when undefined_function then
    v_resolved_branch = upper(replace(trim(new.branch), ' ', '_'));
  end;

  new.branch = coalesce(v_resolved_branch, upper(replace(trim(new.branch), ' ', '_')));
  new.due_date = coalesce(new.due_date, new.document_date + new.tentative_closure_days);
  new.balance_amount = greatest(coalesce(new.credit_amount, 0) - coalesce(new.total_received_amount, 0), 0);
  new.recovery_status = public.portal_credit_dispatch_recovery_status(new.credit_amount, new.total_received_amount, new.due_date);

  if new.dispatch_no is null or trim(new.dispatch_no) = '' then
    new.dispatch_no = public.next_portal_credit_dispatch_no(new.branch, extract(year from new.document_date)::integer);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_credit_dispatch_before_insert on public.portal_credit_dispatches;
create trigger trg_credit_dispatch_before_insert
before insert on public.portal_credit_dispatches
for each row execute function public.portal_credit_dispatch_before_insert();

-- RLS
alter table public.portal_credit_dispatches enable row level security;
alter table public.portal_credit_dispatch_payments enable row level security;
alter table public.portal_credit_dispatch_events enable row level security;

create or replace function public.portal_current_profile_for_rls()
returns table(id uuid, role text, branch text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.role, p.branch
  from public.portal_profiles p
  where p.auth_user_id = auth.uid()
    and coalesce(p.is_active, false) = true
  limit 1;
$$;

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
    where p.role in ('manager', 'admin', 'developer', 'super')
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
        p.role in ('manager', 'admin', 'developer', 'super')
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
    where p.role in ('manager', 'admin', 'developer', 'super')
      or portal_credit_dispatches.branch = p.branch
      or portal_credit_dispatches.created_by = p.id
  )
);

drop policy if exists credit_dispatch_insert_policy on public.portal_credit_dispatches;
create policy credit_dispatch_insert_policy
on public.portal_credit_dispatches
for insert
to authenticated
with check (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('branch', 'manager', 'admin', 'developer', 'super')
      and (
        p.role in ('manager', 'admin', 'developer', 'super')
        or coalesce(public.resolve_portal_branch(portal_credit_dispatches.branch), portal_credit_dispatches.branch) = p.branch
      )
  )
);

drop policy if exists credit_dispatch_update_policy on public.portal_credit_dispatches;
create policy credit_dispatch_update_policy
on public.portal_credit_dispatches
for update
to authenticated
using (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('manager', 'admin', 'developer', 'super')
      or portal_credit_dispatches.branch = p.branch
      or portal_credit_dispatches.created_by = p.id
  )
)
with check (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('manager', 'admin', 'developer', 'super')
      or portal_credit_dispatches.branch = p.branch
      or portal_credit_dispatches.created_by = p.id
  )
);

drop policy if exists credit_dispatch_payments_select_policy on public.portal_credit_dispatch_payments;
create policy credit_dispatch_payments_select_policy
on public.portal_credit_dispatch_payments
for select
to authenticated
using (public.portal_can_access_credit_dispatch(dispatch_id));

drop policy if exists credit_dispatch_payments_insert_policy on public.portal_credit_dispatch_payments;
create policy credit_dispatch_payments_insert_policy
on public.portal_credit_dispatch_payments
for insert
to authenticated
with check (public.portal_can_access_credit_dispatch(dispatch_id));

drop policy if exists credit_dispatch_events_select_policy on public.portal_credit_dispatch_events;
create policy credit_dispatch_events_select_policy
on public.portal_credit_dispatch_events
for select
to authenticated
using (public.portal_can_access_credit_dispatch(dispatch_id));

drop policy if exists credit_dispatch_events_insert_policy on public.portal_credit_dispatch_events;
create policy credit_dispatch_events_insert_policy
on public.portal_credit_dispatch_events
for insert
to authenticated
with check (public.portal_can_access_credit_dispatch(dispatch_id));

-- Storage policies for this module. Object paths should be scoped by dispatch id/folder.
drop policy if exists credit_dispatch_signature_select on storage.objects;
create policy credit_dispatch_signature_select
on storage.objects
for select
to authenticated
using (bucket_id in ('credit-dispatch-signatures', 'credit-dispatch-attachments'));

drop policy if exists credit_dispatch_signature_insert on storage.objects;
create policy credit_dispatch_signature_insert
on storage.objects
for insert
to authenticated
with check (bucket_id in ('credit-dispatch-signatures', 'credit-dispatch-attachments'));
