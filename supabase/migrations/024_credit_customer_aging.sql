-- Credit Dispatch customer aging report.
-- Uses approved dispatch balance and due date buckets.

create or replace view public.portal_credit_customer_aging_view as
select
  c.id as customer_id,
  c.customer_name,
  c.mobile_no,
  c.customer_type,
  c.default_branch,
  c.credit_limit,
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
group by c.id;

alter view if exists public.portal_credit_customer_aging_view set (security_invoker = true);
