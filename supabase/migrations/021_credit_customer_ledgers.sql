-- Credit Dispatch customer master and ledger foundation.
-- Safe migration: existing credit dispatch workflow remains compatible.

create extension if not exists pgcrypto;

create or replace function public.portal_credit_normalize_text(p_value text)
returns text
language sql
immutable
as $$
  select regexp_replace(upper(trim(coalesce(p_value, ''))), '\s+', ' ', 'g');
$$;

create table if not exists public.portal_credit_customers (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  normalized_name text generated always as (public.portal_credit_normalize_text(customer_name)) stored,
  mobile_no text not null,
  customer_type text not null default 'Customer' check (customer_type in ('Major Account', 'Retailer', 'Customer')),
  default_branch text,
  address text,
  gst_no text,
  business_partner_code text,
  credit_limit numeric(14,2),
  risk_category text not null default 'Green' check (risk_category in ('Green', 'Amber', 'Red')),
  is_active boolean not null default true,
  created_by uuid references public.portal_profiles(id) on delete set null,
  updated_by uuid references public.portal_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name, mobile_no)
);

alter table public.portal_credit_dispatches
  add column if not exists customer_id uuid references public.portal_credit_customers(id) on delete set null;

create index if not exists idx_credit_customers_mobile on public.portal_credit_customers(mobile_no);
create index if not exists idx_credit_customers_name on public.portal_credit_customers(normalized_name);
create index if not exists idx_credit_customers_branch on public.portal_credit_customers(default_branch);
create index if not exists idx_credit_dispatch_customer on public.portal_credit_dispatches(customer_id);

create or replace function public.portal_credit_customer_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_credit_customer_touch_updated_at on public.portal_credit_customers;
create trigger trg_credit_customer_touch_updated_at
before update on public.portal_credit_customers
for each row execute function public.portal_credit_customer_touch_updated_at();

create or replace function public.portal_credit_customer_risk(p_outstanding numeric, p_overdue numeric, p_limit numeric)
returns text
language sql
stable
as $$
  select case
    when coalesce(p_overdue, 0) > 0 then 'Red'
    when coalesce(p_limit, 0) > 0 and coalesce(p_outstanding, 0) > coalesce(p_limit, 0) then 'Amber'
    when coalesce(p_outstanding, 0) > 0 then 'Amber'
    else 'Green'
  end;
$$;

create or replace function public.portal_upsert_credit_customer(
  p_customer_name text,
  p_mobile_no text,
  p_customer_type text default 'Customer',
  p_branch text default null,
  p_customer_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.portal_profiles%rowtype;
  v_customer_id uuid;
  v_name text := trim(coalesce(p_customer_name, ''));
  v_mobile text := regexp_replace(coalesce(p_mobile_no, ''), '\D', '', 'g');
  v_branch text := nullif(trim(coalesce(p_branch, '')), '');
begin
  if v_name = '' then
    raise exception 'Customer name is required';
  end if;
  if v_mobile = '' then
    raise exception 'Customer mobile no. is required';
  end if;

  select * into v_profile
  from public.portal_profiles
  where auth_user_id = auth.uid()
    and coalesce(is_active, false) = true
  limit 1;

  if p_customer_id is not null then
    update public.portal_credit_customers
    set
      customer_name = v_name,
      mobile_no = v_mobile,
      customer_type = coalesce(nullif(p_customer_type, ''), customer_type),
      default_branch = coalesce(v_branch, default_branch),
      updated_by = v_profile.id
    where id = p_customer_id
    returning id into v_customer_id;

    if v_customer_id is not null then
      return v_customer_id;
    end if;
  end if;

  select id into v_customer_id
  from public.portal_credit_customers
  where normalized_name = public.portal_credit_normalize_text(v_name)
    and mobile_no = v_mobile
  limit 1;

  if v_customer_id is null then
    insert into public.portal_credit_customers (
      customer_name,
      mobile_no,
      customer_type,
      default_branch,
      created_by,
      updated_by
    ) values (
      v_name,
      v_mobile,
      coalesce(nullif(p_customer_type, ''), 'Customer'),
      v_branch,
      v_profile.id,
      v_profile.id
    )
    on conflict (normalized_name, mobile_no) do update set
      customer_name = excluded.customer_name,
      customer_type = excluded.customer_type,
      default_branch = coalesce(public.portal_credit_customers.default_branch, excluded.default_branch),
      updated_by = excluded.updated_by,
      updated_at = now()
    returning id into v_customer_id;
  end if;

  return v_customer_id;
end;
$$;

insert into public.portal_credit_customers (customer_name, mobile_no, customer_type, default_branch, created_by, updated_by)
select distinct on (public.portal_credit_normalize_text(customer_name), regexp_replace(coalesce(mobile_no, ''), '\D', '', 'g'))
  trim(customer_name),
  regexp_replace(coalesce(mobile_no, ''), '\D', '', 'g'),
  customer_type,
  branch,
  created_by,
  created_by
from public.portal_credit_dispatches
where trim(coalesce(customer_name, '')) <> ''
  and regexp_replace(coalesce(mobile_no, ''), '\D', '', 'g') <> ''
on conflict (normalized_name, mobile_no) do nothing;

update public.portal_credit_dispatches d
set customer_id = c.id
from public.portal_credit_customers c
where d.customer_id is null
  and public.portal_credit_normalize_text(d.customer_name) = c.normalized_name
  and regexp_replace(coalesce(d.mobile_no, ''), '\D', '', 'g') = c.mobile_no;

create or replace function public.portal_credit_dispatch_customer_before_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.customer_id = public.portal_upsert_credit_customer(
    new.customer_name,
    new.mobile_no,
    new.customer_type,
    new.branch,
    new.customer_id
  );
  return new;
end;
$$;

drop trigger if exists trg_credit_dispatch_customer_before_insert on public.portal_credit_dispatches;
create trigger trg_credit_dispatch_customer_before_insert
before insert on public.portal_credit_dispatches
for each row execute function public.portal_credit_dispatch_customer_before_save();

drop trigger if exists trg_credit_dispatch_customer_before_update on public.portal_credit_dispatches;
create trigger trg_credit_dispatch_customer_before_update
before update of customer_name, mobile_no, customer_type, branch, customer_id on public.portal_credit_dispatches
for each row execute function public.portal_credit_dispatch_customer_before_save();

create or replace view public.portal_credit_customer_outstanding_view as
select
  c.id as customer_id,
  c.customer_name,
  c.mobile_no,
  c.customer_type,
  c.default_branch,
  c.credit_limit,
  coalesce(sum(case when d.approval_status = 'Approved' then d.credit_amount else 0 end), 0)::numeric(14,2) as total_credit,
  coalesce(sum(case when d.approval_status = 'Approved' then d.total_received_amount else 0 end), 0)::numeric(14,2) as total_received,
  coalesce(sum(case when d.approval_status = 'Approved' then d.balance_amount else 0 end), 0)::numeric(14,2) as outstanding,
  coalesce(sum(case when d.approval_status = 'Approved' and d.due_date < current_date then d.balance_amount else 0 end), 0)::numeric(14,2) as overdue,
  max(d.document_date) filter (where d.approval_status = 'Approved') as last_credit_date,
  max(p.received_date) as last_payment_date,
  public.portal_credit_customer_risk(
    coalesce(sum(case when d.approval_status = 'Approved' then d.balance_amount else 0 end), 0),
    coalesce(sum(case when d.approval_status = 'Approved' and d.due_date < current_date then d.balance_amount else 0 end), 0),
    c.credit_limit
  ) as risk_category
from public.portal_credit_customers c
left join public.portal_credit_dispatches d on d.customer_id = c.id
left join public.portal_credit_dispatch_payments p on p.dispatch_id = d.id
group by c.id;

create or replace view public.portal_credit_customer_ledger_view as
select
  d.customer_id,
  d.id as dispatch_id,
  d.document_date as transaction_date,
  d.created_at as sort_at,
  'Credit Dispatch'::text as entry_type,
  coalesce(d.dispatch_no, d.document_no, 'Credit Dispatch') as particulars,
  d.document_type,
  d.document_no,
  d.branch,
  d.credit_amount::numeric(14,2) as debit,
  0::numeric(14,2) as credit
from public.portal_credit_dispatches d
where d.customer_id is not null
  and d.approval_status = 'Approved'
union all
select
  d.customer_id,
  d.id as dispatch_id,
  p.received_date as transaction_date,
  p.created_at as sort_at,
  'Payment Received'::text as entry_type,
  coalesce(p.reference_no, p.payment_mode, 'Payment') as particulars,
  d.document_type,
  d.document_no,
  d.branch,
  0::numeric(14,2) as debit,
  p.received_amount::numeric(14,2) as credit
from public.portal_credit_dispatch_payments p
join public.portal_credit_dispatches d on d.id = p.dispatch_id
where d.customer_id is not null;

alter table public.portal_credit_customers enable row level security;

drop policy if exists credit_customers_select_policy on public.portal_credit_customers;
create policy credit_customers_select_policy
on public.portal_credit_customers
for select
to authenticated
using (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('manager', 'admin', 'developer', 'super')
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

drop policy if exists credit_customers_insert_policy on public.portal_credit_customers;
create policy credit_customers_insert_policy
on public.portal_credit_customers
for insert
to authenticated
with check (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('branch', 'manager', 'admin', 'developer', 'super')
  )
);

drop policy if exists credit_customers_update_policy on public.portal_credit_customers;
create policy credit_customers_update_policy
on public.portal_credit_customers
for update
to authenticated
using (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('manager', 'admin', 'developer', 'super')
      or portal_credit_customers.created_by = p.id
      or portal_credit_customers.default_branch = p.branch
  )
)
with check (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('manager', 'admin', 'developer', 'super')
      or portal_credit_customers.created_by = p.id
      or portal_credit_customers.default_branch = p.branch
  )
);
