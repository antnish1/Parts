-- Allow the existing, specifically granted cross-branch Credit Dispatch reader
-- to submit COMMENT events only. No approval/payment/update rights are added.
-- Leave same-branch event insert permissions unchanged.
drop policy if exists credit_dispatch_events_insert_policy on public.portal_credit_dispatch_events;
create policy credit_dispatch_events_insert_policy
on public.portal_credit_dispatch_events
for insert to authenticated
with check (
  public.portal_can_write_credit_dispatch_child(dispatch_id)
  or (
    public.portal_has_cross_branch_read('credit_dispatch')
    and event_type = 'Comment'
    and created_by = (
      select p.id from public.portal_profiles p
      where p.auth_user_id = auth.uid()
        and coalesce(p.is_active,false)
        and p.role = 'branch'
      limit 1
    )
    and exists (
      select 1 from public.portal_credit_dispatches d where d.id = dispatch_id
    )
  )
);
