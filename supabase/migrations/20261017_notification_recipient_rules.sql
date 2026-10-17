-- 2026-10-17: prospective notification recipient rules only.
-- Historical notifications are preserved; no mass updates or backfill.
-- Require CI and production schema review before applying this migration.
create or replace function public.portal_notify_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare o public.portal_orders%rowtype; headline text; category_name text;
begin
 if upper(new.event_type) not in ('ORDER_CREATED','SUPER_FORWARDED_MANAGER','SUPER_APPROVED_PENDING_MANAGER',
 'MANAGER_APPROVED','MANAGER_DIRECT_APPROVED','MANAGER_REJECTED','ORDER_REJECTED',
 'REVIEW_EDITS_PENDING_MANAGER','REVIEW_ORIGINAL_PENDING_MANAGER',
 'REVIEW_EDITS_MANAGER_APPROVED','REVIEW_ORIGINAL_MANAGER_APPROVED') then return new; end if;
 select * into o from public.portal_orders where id=new.order_id;
 if not found then return new; end if;
 headline := case
 when upper(new.event_type)='ORDER_CREATED' then 'New order awaiting approval'
 when upper(new.event_type) like '%REJECT%' then 'Order rejected'
 when upper(new.event_type) like '%APPROV%' then 'Order approved'
 else 'Order forwarded for review' end;
 category_name := case when upper(new.event_type)='ORDER_CREATED' then 'order' else 'approval' end;
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,o.id,'event:'||new.id::text,category_name,headline,
   'Order '||coalesce(o.final_order_no,o.order_no)||' updated.'
 from public.portal_profiles p
 where p.is_active=true and p.id is distinct from new.actor_id and (
   (p.id=o.approver_id and lower(p.role) in ('manager','super'))
   or (p.id=o.employee_id and lower(p.role) in ('branch','super','manager'))
   or (lower(p.role)='manager' and upper(new.event_type) in
       ('ORDER_CREATED','SUPER_FORWARDED_MANAGER','SUPER_APPROVED_PENDING_MANAGER',
        'REVIEW_EDITS_PENDING_MANAGER','REVIEW_ORIGINAL_PENDING_MANAGER'))
   or (lower(p.role)='admin' and upper(new.event_type) in
        ('MANAGER_APPROVED','MANAGER_DIRECT_APPROVED',
         'REVIEW_EDITS_MANAGER_APPROVED','REVIEW_ORIGINAL_MANAGER_APPROVED'))
 )
 on conflict do nothing;
 return new;
end $$;

create or replace function public.portal_notify_comment()
returns trigger language plpgsql security definer set search_path=public as $$
declare o public.portal_orders%rowtype;
begin
 if new.comment_type is distinct from 'user' then return new; end if;
 select * into o from public.portal_orders where id=new.order_id;
 if not found then return new; end if;
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,o.id,'comment:'||new.id::text,'comment','New order comment',
   'Comment added to order '||coalesce(o.final_order_no,o.order_no)||'.'
 from public.portal_profiles p
 where p.is_active=true and p.id is distinct from new.author_id and
 (p.id=o.employee_id or p.id=o.approver_id or (
   lower(p.role) in ('branch','manager','super','admin') and
   regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=
   regexp_replace(upper(coalesce(o.branch,'')),'[ _-]','','g')))
 on conflict do nothing;
 return new;
end $$;

create or replace function public.portal_notify_dispatch()
returns trigger language plpgsql security definer set search_path=public as $$
declare o public.portal_orders%rowtype;
begin
 if new.source is distinct from 'status_report_upload'
   or coalesce(new.billed_qty,0)<=0
   or (lower(coalesce(new.raw_status,'')) not like '%dispatch%'
   and lower(coalesce(new.raw_status,'')) not like '%despatch%') then return new; end if;
 select * into o from public.portal_orders where id=new.order_id;
 if not found then return new; end if;
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,o.id,'dispatch:'||new.id::text,'dispatch','Order dispatched',
  'Dispatch recorded for order '||coalesce(o.final_order_no,o.order_no)||'.'
 from public.portal_profiles p
 where p.is_active=true and (p.id=o.employee_id or (
 lower(p.role)='branch' and
 regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=
 regexp_replace(upper(coalesce(o.branch,'')),'[ _-]','','g')))
 on conflict do nothing;
 return new;
end $$;
