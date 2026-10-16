-- Route manager approval/rejection notifications only to the originating branch.
-- No audit records or existing order data are modified.
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
   -- Approval and rejection messages are for the relevant branch only.
   (new.event_type in ('MANAGER_APPROVED','MANAGER_REJECTED')
    and p.role='branch'
    and o.branch is not null
    and regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=
        regexp_replace(upper(o.branch),'[ _-]','','g'))
   or
   -- Preserve existing recipients for newly punched orders.
   (new.event_type='ORDER_CREATED' and
    (p.id=o.employee_id or p.id=o.approver_id or
     (o.branch is not null and
      regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=
      regexp_replace(upper(o.branch),'[ _-]','','g'))))
 )
 on conflict do nothing;
 return new;
end $$;
