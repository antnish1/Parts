-- Only the verified active SALONI login may record Credit Dispatch payments for other offices.
-- Keep all other branch accounts (including SHUBHAM), approval rights and TA/DA rights unchanged.
create or replace function public.portal_saloni_can_record_cross_office_payment()
returns boolean language sql stable security definer set search_path = public as $function$
  select exists (
    select 1 from public.portal_profiles p
    where p.id = '6a4fad26-55bb-4894-a2cd-e2b2cfa070e8'::uuid
      and p.auth_user_id = '767bd1c7-3c4c-4925-b125-888a27906250'::uuid
      and p.auth_user_id = (select auth.uid())
      and upper(btrim(p.legacy_user_id)) = 'SALONI'
      and p.role = 'branch'
      and p.branch = 'JABALPUR_BHL'
      and p.is_active is true
  );
$function$;
revoke all on function public.portal_saloni_can_record_cross_office_payment() from public, anon;
grant execute on function public.portal_saloni_can_record_cross_office_payment() to authenticated;

alter policy credit_dispatch_payments_insert_policy on public.portal_credit_dispatch_payments
with check (
  public.portal_can_write_credit_dispatch_child(dispatch_id)
  or (
    public.portal_saloni_can_record_cross_office_payment()
    and exists (select 1 from public.portal_credit_dispatches d where d.id=dispatch_id and d.approval_status='Approved')
  )
);

-- The application adds a 'Payment Added' event after inserting the payment.
-- Retain the existing cross-office comment exception without granting approvals/other writes.
alter policy credit_dispatch_events_insert_policy on public.portal_credit_dispatch_events
with check (
  public.portal_can_write_credit_dispatch_child(dispatch_id)
  or (
    public.portal_has_cross_branch_read('credit_dispatch')
    and event_type='Comment'
    and created_by=(select p.id from public.portal_profiles p
                    where p.auth_user_id=auth.uid() and coalesce(p.is_active,false)
                      and p.role='branch' limit 1)
    and exists(select 1 from public.portal_credit_dispatches d where d.id=dispatch_id)
  )
  or (
    public.portal_saloni_can_record_cross_office_payment()
    and event_type='Payment Added'
    and exists(select 1 from public.portal_credit_dispatches d where d.id=dispatch_id and d.approval_status='Approved')
  )
);
