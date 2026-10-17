-- Non-destructive rollback of NEW request activation.
-- Does not change existing records or their workflow version.
-- Keep version-aware functions and trigger installed so version-2 requests can finish safely.
alter table public.portal_credit_dispatches
  alter column approval_flow_version set default 1;

-- The initial-stage trigger only rewrites rows with version=2; with default=1,
-- new legacy clients once again submit Pending Accounts Approval.
-- New clients explicitly submitting Pending Manager Approval must be rolled back
-- to their previous frontend release as part of the coordinated rollback.
