alter table public.portal_credit_dispatches
  add column if not exists sales_employee_name text;

comment on column public.portal_credit_dispatches.sales_employee_name is
  'Sales employee responsible for the customer credit dispatch request.';
