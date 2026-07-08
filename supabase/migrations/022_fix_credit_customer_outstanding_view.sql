-- Fix customer outstanding aggregation so dispatch totals are not duplicated by multiple payments.

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
  coalesce(dt.total_credit, 0)::numeric(14,2) as total_credit,
  coalesce(dt.total_received, 0)::numeric(14,2) as total_received,
  coalesce(dt.outstanding, 0)::numeric(14,2) as outstanding,
  coalesce(dt.overdue, 0)::numeric(14,2) as overdue,
  dt.last_credit_date,
  pt.last_payment_date,
  public.portal_credit_customer_risk(coalesce(dt.outstanding, 0), coalesce(dt.overdue, 0), c.credit_limit) as risk_category
from public.portal_credit_customers c
left join dispatch_totals dt on dt.customer_id = c.id
left join payment_totals pt on pt.customer_id = c.id;
