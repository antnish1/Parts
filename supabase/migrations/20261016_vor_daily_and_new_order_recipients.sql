-- Notification scope: new orders to Manager/Super only; Delayed VOR once per rolling 24 hours per recipient/order.
-- Additive and reversible via CREATE OR REPLACE; no existing notifications are deleted.
create or replace function public.portal_notify_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare o record; headline text; notification_category text;
begin
 if new.event_type not in ('ORDER_CREATED','MANAGER_APPROVED','MANAGER_REJECTED') then return new; end if;
 select * into o from public.portal_orders where id=new.order_id;
 if not found then return new; end if;
 headline:=case new.event_type when 'ORDER_CREATED' then 'New order punched' when 'MANAGER_APPROVED' then 'Order approved' else 'Order rejected' end;
 notification_category:=case when new.event_type='ORDER_CREATED' then 'order' else 'approval' end;
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,o.id,'event:'||new.id::text,notification_category,headline,
        'Order '||coalesce(o.final_order_no,o.order_no)||' updated.'
 from public.portal_profiles p
 where p.is_active=true and p.id is distinct from new.actor_id
 and (
   (new.event_type='ORDER_CREATED'
    and lower(coalesce(p.role,'')) in ('manager','super')
    and (
      lower(p.role)='super'
      or p.id=o.approver_id
      or (o.branch is not null and
          regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=
          regexp_replace(upper(o.branch),'[ _-]','','g'))
    ))
   or
   (new.event_type in ('MANAGER_APPROVED','MANAGER_REJECTED')
    and lower(p.role)='branch'
    and o.branch is not null
    and regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=
        regexp_replace(upper(o.branch),'[ _-]','','g'))
 )
 on conflict do nothing;
 return new;
end $$;

-- A protected worker may invoke this repeatedly. Each VOR/order/recipient gets
-- at most one new alert per rolling 24 hours, and the alert category reflects its current age.
-- The advisory transaction lock avoids duplicate queueing from overlapping scheduler executions.
create or replace function public.portal_queue_delayed_vor_alerts() returns integer
language plpgsql security definer set search_path=public as $$
declare inserted_count integer;
begin
 perform pg_advisory_xact_lock(hashtext('portal_queue_delayed_vor_alerts'));
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,o.id,
        'vor:'||o.id::text||':'||p.id::text||':'||to_char(timezone('Asia/Kolkata',now()),'YYYYMMDDHH24MI'),
        'delayed_vor',
        case when (timezone('Asia/Kolkata',now())::date-o.processed_date) between 3 and 5
             then 'Delayed VOR: 3–5 days' else 'Delayed VOR: 5+ days' end,
        'Order '||coalesce(o.final_order_no,o.order_no)||' needs follow-up.'
 from public.portal_orders o
 join public.portal_profiles p on p.is_active=true
   and regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=
       regexp_replace(upper(o.branch),'[ _-]','','g')
 where upper(coalesce(o.order_type,''))='VOR'
   and o.processed_date is not null
   and (timezone('Asia/Kolkata',now())::date-o.processed_date)>=3
   and exists (
     select 1 from public.portal_order_items i where i.order_id=o.id
       and upper(coalesce(i.row_status,'')) in ('PROCESSED','PARTIALLY DISPATCHED')
   )
   and not exists (
     select 1 from public.portal_notifications n
     where n.recipient_profile_id=p.id and n.order_id=o.id
       and n.category='delayed_vor'
       and n.created_at>now()-interval '24 hours'
   )
 on conflict do nothing;
 get diagnostics inserted_count=row_count;
 return inserted_count;
end $$;
revoke all on function public.portal_queue_delayed_vor_alerts() from public,anon,authenticated;
grant execute on function public.portal_queue_delayed_vor_alerts() to service_role;
