-- Ensure customer ledger views respect underlying RLS policies.

alter view if exists public.portal_credit_customer_outstanding_view set (security_invoker = true);
alter view if exists public.portal_credit_customer_ledger_view set (security_invoker = true);
