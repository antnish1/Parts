-- Credit customer admin controls.
-- Only admin, manager and developer can edit customer profiles or merge customers.

create or replace function public.portal_can_manage_credit_customers()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('admin', 'manager', 'developer')
  );
$$;

drop policy if exists credit_customers_update_policy on public.portal_credit_customers;
create policy credit_customers_update_policy
on public.portal_credit_customers
for update
to authenticated
using (public.portal_can_manage_credit_customers())
with check (public.portal_can_manage_credit_customers());

create or replace function public.portal_merge_credit_customers(
  p_source_customer_id uuid,
  p_target_customer_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.portal_profiles%rowtype;
  v_source public.portal_credit_customers%rowtype;
  v_target public.portal_credit_customers%rowtype;
begin
  if p_source_customer_id is null or p_target_customer_id is null then
    raise exception 'Source and target customer are required';
  end if;

  if p_source_customer_id = p_target_customer_id then
    raise exception 'Source and target customer cannot be same';
  end if;

  select * into v_profile
  from public.portal_profiles
  where auth_user_id = auth.uid()
    and coalesce(is_active, false) = true
  limit 1;

  if v_profile.role not in ('admin', 'manager', 'developer') then
    raise exception 'Only admin, manager or developer can merge customers';
  end if;

  select * into v_source from public.portal_credit_customers where id = p_source_customer_id for update;
  select * into v_target from public.portal_credit_customers where id = p_target_customer_id for update;

  if v_source.id is null then
    raise exception 'Source customer not found';
  end if;
  if v_target.id is null then
    raise exception 'Target customer not found';
  end if;

  update public.portal_credit_dispatches
  set customer_id = p_target_customer_id,
      updated_at = now()
  where customer_id = p_source_customer_id;

  update public.portal_credit_customers
  set
    address = coalesce(address, v_source.address),
    gst_no = coalesce(gst_no, v_source.gst_no),
    business_partner_code = coalesce(business_partner_code, v_source.business_partner_code),
    credit_limit = coalesce(credit_limit, v_source.credit_limit),
    updated_by = v_profile.id,
    updated_at = now()
  where id = p_target_customer_id;

  update public.portal_credit_customers
  set
    is_active = false,
    updated_by = v_profile.id,
    updated_at = now()
  where id = p_source_customer_id;

  return p_target_customer_id;
end;
$$;

create or replace view public.portal_credit_customer_outstanding_view as
with dispatch_totals as (
  select
    customer_id,
    coalesce(sum(credit_amount) filter (where approval_status = 'Approved'), 0)::numeric(14,2) as total_credit,
    coalesce(sum(total_received_amount) filter (where approval_status = 'Approved'), 0)::numeric(14,2) as total_received,
    coalesce(sum(balance_amount) filter (where approval_status = 'Approved'), 0)::numeric(14,2) as outstanding,
    coalesce(sum(balance_amount) filter (where approval_status = 'Approved' and due_date < current_date), 0)::numeric(14,2) as overdue,
    max(document_date) filter (where approval_status = 'Approved') as last_credit_date
  from public.portal_credit_dispatches
  where customer_id is not null
  group by customer_id
),
payment_totals as (
  select
    d.customer_id,
    max(p.received_date) as last_payment_date
  from public.portal_credit_dispatch_payments p
  join public.portal_credit_dispatches d on d.id = p.dispatch_id
  where d.customer_id is not null
  group by d.customer_id
)
select
  c.id as customer_id,
  c.customer_name,
  c.mobile_no,
  c.customer_type,
  c.default_branch,
  c.credit_limit,
  c.is_active,
  coalesce(dt.total_credit, 0)::numeric(14,2) as total_credit,
  coalesce(dt.total_received, 0)::numeric(14,2) as total_received,
  coalesce(dt.outstanding, 0)::numeric(14,2) as outstanding,
  coalesce(dt.overdue, 0)::numeric(14,2) as overdue,
  dt.last_credit_date,
  pt.last_payment_date,
  public.portal_credit_customer_risk(coalesce(dt.outstanding, 0), coalesce(dt.overdue, 0), c.credit_limit) as risk_category
from public.portal_credit_customers c
left join dispatch_totals dt on dt.customer_id = c.id
left join payment_totals pt on pt.customer_id = c.id
where coalesce(c.is_active, true) = true;

alter view if exists public.portal_credit_customer_outstanding_view set (security_invoker = true);

create or replace view public.portal_credit_customer_aging_view as
select
  c.id as customer_id,
  c.customer_name,
  c.mobile_no,
  c.customer_type,
  c.default_branch,
  c.credit_limit,
  c.is_active,
  coalesce(sum(d.balance_amount) filter (where d.approval_status = 'Approved'), 0)::numeric(14,2) as outstanding,
  coalesce(sum(d.balance_amount) filter (where d.approval_status = 'Approved' and d.balance_amount > 0 and current_date - d.due_date between 0 and 7), 0)::numeric(14,2) as bucket_0_7,
  coalesce(sum(d.balance_amount) filter (where d.approval_status = 'Approved' and d.balance_amount > 0 and current_date - d.due_date between 8 and 15), 0)::numeric(14,2) as bucket_8_15,
  coalesce(sum(d.balance_amount) filter (where d.approval_status = 'Approved' and d.balance_amount > 0 and current_date - d.due_date between 16 and 30), 0)::numeric(14,2) as bucket_16_30,
  coalesce(sum(d.balance_amount) filter (where d.approval_status = 'Approved' and d.balance_amount > 0 and current_date - d.due_date > 30), 0)::numeric(14,2) as bucket_30_plus,
  coalesce(sum(d.balance_amount) filter (where d.approval_status = 'Approved' and d.balance_amount > 0 and d.due_date < current_date), 0)::numeric(14,2) as overdue,
  max(d.due_date) filter (where d.approval_status = 'Approved') as latest_due_date,
  public.portal_credit_customer_risk(
    coalesce(sum(d.balance_amount) filter (where d.approval_status = 'Approved'), 0),
    coalesce(sum(d.balance_amount) filter (where d.approval_status = 'Approved' and d.balance_amount > 0 and d.due_date < current_date), 0),
    c.credit_limit
  ) as risk_category
from public.portal_credit_customers c
left join public.portal_credit_dispatches d on d.customer_id = c.id
where coalesce(c.is_active, true) = true
group by c.id;

alter view if exists public.portal_credit_customer_aging_view set (security_invoker = true);
