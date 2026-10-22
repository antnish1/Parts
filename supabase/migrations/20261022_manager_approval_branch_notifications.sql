-- 2026-10-22: route terminal Manager approval/rejection notices to the relevant branch only.
-- Historical notification rows are preserved. Mobile filters any old Manager-owned terminal notices.
create or replace function public.portal_notify_event()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  o public.portal_orders%rowtype;
  headline text;
  category_name text;
  event_name text := upper(coalesce(new.event_type,''));
  is_manager_terminal boolean;
begin
  if event_name not in (
    'ORDER_CREATED',
    'SUPER_FORWARDED_MANAGER',
    'SUPER_APPROVED_PENDING_MANAGER',
    'MANAGER_APPROVED',
    'MANAGER_DIRECT_APPROVED',
    'MANAGER_REJECTED',
    'ORDER_REJECTED',
    'REVIEW_EDITS_PENDING_MANAGER',
    'REVIEW_ORIGINAL_PENDING_MANAGER',
    'REVIEW_EDITS_MANAGER_APPROVED',
    'REVIEW_ORIGINAL_MANAGER_APPROVED'
  ) then
    return new;
  end if;

  select * into o from public.portal_orders where id=new.order_id;
  if not found then return new; end if;

  is_manager_terminal := event_name in (
    'MANAGER_APPROVED',
    'MANAGER_DIRECT_APPROVED',
    'MANAGER_REJECTED',
    'REVIEW_EDITS_MANAGER_APPROVED',
    'REVIEW_ORIGINAL_MANAGER_APPROVED'
  );

  headline := case
    when event_name='ORDER_CREATED' then 'New order awaiting approval'
    when event_name like '%REJECT%' then 'Order rejected'
    when event_name like '%APPROV%' then 'Order approved'
    else 'Order forwarded for review'
  end;
  category_name := case when event_name='ORDER_CREATED' then 'order' else 'approval' end;

  insert into public.portal_notifications(
    recipient_profile_id,
    order_id,
    event_key,
    category,
    title,
    body
  )
  select
    p.id,
    o.id,
    'event:'||new.id::text,
    category_name,
    headline,
    'Order '||coalesce(o.final_order_no,o.order_no)||' updated.'
  from public.portal_profiles p
  where p.is_active=true
    and p.id is distinct from new.actor_id
    and (
      (
        is_manager_terminal
        and lower(p.role)='branch'
        and o.branch is not null
        and regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=
            regexp_replace(upper(o.branch),'[ _-]','','g')
      )
      or (
        not is_manager_terminal
        and (
          (p.id=o.approver_id and lower(p.role) in ('manager','super'))
          or (p.id=o.employee_id and lower(p.role) in ('branch','super','manager'))
          or (
            lower(p.role)='manager'
            and event_name in (
              'ORDER_CREATED',
              'SUPER_FORWARDED_MANAGER',
              'SUPER_APPROVED_PENDING_MANAGER',
              'REVIEW_EDITS_PENDING_MANAGER',
              'REVIEW_ORIGINAL_PENDING_MANAGER'
            )
          )
        )
      )
    )
  on conflict do nothing;

  return new;
end
$$;
