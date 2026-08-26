-- Fix Credit Dispatch correction resubmission for users whose profile branch
-- and stored dispatch branch are equivalent but formatted differently
-- (for example JABALPUR PARTS vs JABALPUR_PARTS).
--
-- The correction UI already compares normalized branch values. The original
-- UPDATE RLS policy compared raw strings, so a valid same-branch correction
-- could pass the UI guard and then fail at the database update boundary.

alter table public.portal_credit_dispatches enable row level security;

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
      or regexp_replace(upper(trim(coalesce(portal_credit_dispatches.branch, ''))), '[^A-Z0-9]', '', 'g')
         = regexp_replace(upper(trim(coalesce(p.branch, ''))), '[^A-Z0-9]', '', 'g')
      or portal_credit_dispatches.created_by = p.id
  )
)
with check (
  exists (
    select 1
    from public.portal_current_profile_for_rls() p
    where p.role in ('manager', 'admin', 'developer', 'super')
      or regexp_replace(upper(trim(coalesce(portal_credit_dispatches.branch, ''))), '[^A-Z0-9]', '', 'g')
         = regexp_replace(upper(trim(coalesce(p.branch, ''))), '[^A-Z0-9]', '', 'g')
      or portal_credit_dispatches.created_by = p.id
  )
);

comment on policy credit_dispatch_update_policy on public.portal_credit_dispatches is
  'Allows privileged roles, the creator, or users whose portal profile belongs to the same normalized branch as the Credit Dispatch request.';
