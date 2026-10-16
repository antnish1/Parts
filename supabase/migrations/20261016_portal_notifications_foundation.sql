-- In-app notifications and optional Expo device registration. Review before production application.
create table public.portal_notifications (
 id uuid primary key default gen_random_uuid(),
 recipient_profile_id uuid not null references public.portal_profiles(id) on delete cascade,
 order_id uuid references public.portal_orders(id) on delete cascade,
 event_key text not null,
 category text not null,
 title text not null,
 body text not null,
 created_at timestamptz not null default now(),
 read_at timestamptz,
 push_sent_at timestamptz,
 unique (recipient_profile_id,event_key)
);
create index on public.portal_notifications(recipient_profile_id,created_at desc);
create table public.portal_push_devices (
 id uuid primary key default gen_random_uuid(),
 profile_id uuid not null references public.portal_profiles(id) on delete cascade,
 expo_push_token text not null,
 updated_at timestamptz not null default now(),
 unique(profile_id,expo_push_token)
);
alter table public.portal_notifications enable row level security;
alter table public.portal_push_devices enable row level security;
grant select,update on public.portal_notifications to authenticated;
grant select,insert,update,delete on public.portal_push_devices to authenticated;
create policy notifications_select on public.portal_notifications for select to authenticated using (
 exists(select 1 from public.portal_profiles p where p.id=recipient_profile_id and p.auth_user_id=auth.uid() and p.is_active=true));
create policy notifications_read on public.portal_notifications for update to authenticated using (
 exists(select 1 from public.portal_profiles p where p.id=recipient_profile_id and p.auth_user_id=auth.uid() and p.is_active=true))
 with check (exists(select 1 from public.portal_profiles p where p.id=recipient_profile_id and p.auth_user_id=auth.uid() and p.is_active=true));
create policy devices_select on public.portal_push_devices for select to authenticated using (exists(select 1 from public.portal_profiles p where p.id=profile_id and p.auth_user_id=auth.uid() and p.is_active=true));
create policy devices_insert on public.portal_push_devices for insert to authenticated with check (exists(select 1 from public.portal_profiles p where p.id=profile_id and p.auth_user_id=auth.uid() and p.is_active=true));
create policy devices_update on public.portal_push_devices for update to authenticated using (exists(select 1 from public.portal_profiles p where p.id=profile_id and p.auth_user_id=auth.uid() and p.is_active=true)) with check (exists(select 1 from public.portal_profiles p where p.id=profile_id and p.auth_user_id=auth.uid() and p.is_active=true));
create policy devices_delete on public.portal_push_devices for delete to authenticated using (exists(select 1 from public.portal_profiles p where p.id=profile_id and p.auth_user_id=auth.uid() and p.is_active=true));
create function public.portal_notify_event() returns trigger language plpgsql security definer set search_path=public as $$
declare o record; headline text; notification_category text;
begin
 if new.event_type not in ('ORDER_CREATED','MANAGER_APPROVED','MANAGER_REJECTED') then return new; end if;
 select * into o from public.portal_orders where id=new.order_id;
 if not found then return new; end if;
 headline:=case new.event_type when 'ORDER_CREATED' then 'New order punched' when 'MANAGER_APPROVED' then 'Order approved' else 'Order rejected' end;
 notification_category:=case when new.event_type='ORDER_CREATED' then 'order' else 'approval' end;
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,o.id,'event:'||new.id::text,notification_category,headline,'Order '||coalesce(o.final_order_no,o.order_no)||' updated.'
 from public.portal_profiles p
 where p.is_active=true and p.id is distinct from new.actor_id and
 (p.id=o.employee_id or p.id=o.approver_id or (o.branch is not null and regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=regexp_replace(upper(o.branch),'[ _-]','','g')))
 on conflict do nothing;
 return new;
end $$;
create trigger notify_order_event after insert on public.portal_order_events for each row execute function public.portal_notify_event();
create function public.portal_notify_comment() returns trigger language plpgsql security definer set search_path=public as $$
declare o record;
begin
 if new.comment_type is distinct from 'user' then return new; end if;
 select * into o from public.portal_orders where id=new.order_id;
 if not found then return new; end if;
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,o.id,'comment:'||new.id::text,'comment','New order comment','Comment added to order '||coalesce(o.final_order_no,o.order_no)||'.'
 from public.portal_profiles p where p.is_active=true and p.id is distinct from new.author_id and
 (p.id=o.employee_id or p.id=o.approver_id or (o.branch is not null and regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=regexp_replace(upper(o.branch),'[ _-]','','g')))
 on conflict do nothing;
 return new;
end $$;
create trigger notify_order_comment after insert on public.portal_order_comments for each row execute function public.portal_notify_comment();
-- Billing records may be created outside Status Report. Event source will be narrowed before release.
create function public.portal_notify_dispatch() returns trigger language plpgsql security definer set search_path=public as $$
declare o record;
begin
 if new.source is distinct from 'status_report_upload' or coalesce(new.billed_qty,0)<=0 or (lower(coalesce(new.raw_status,'')) not like '%dispatch%' and lower(coalesce(new.raw_status,'')) not like '%despatch%') then return new; end if;
 select * into o from public.portal_orders where id=new.order_id;
 if not found then return new; end if;
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,o.id,'dispatch:'||new.id::text,'dispatch','Order dispatched','Dispatch recorded for order '||coalesce(o.final_order_no,o.order_no)||'.'
 from public.portal_profiles p where p.is_active=true and o.branch is not null and regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=regexp_replace(upper(o.branch),'[ _-]','','g')
 on conflict do nothing;
 return new;
end $$;
create trigger notify_order_dispatch after insert on public.portal_order_item_billings for each row execute function public.portal_notify_dispatch();

-- Daily ageing job entrypoint, to be called by a protected scheduled worker.
create function public.portal_queue_delayed_vor_alerts() returns integer
language plpgsql security definer set search_path=public as $$
declare inserted_count integer;
begin
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,o.id,'vor:'||o.id::text||':'||case when (timezone('Asia/Kolkata',now())::date-o.processed_date) between 3 and 5 then '3-5' else '5+' end,
 'delayed_vor',
 case when (timezone('Asia/Kolkata',now())::date-o.processed_date) between 3 and 5 then 'Delayed VOR: 3–5 days' else 'Delayed VOR: 5+ days' end,
 'Order '||coalesce(o.final_order_no,o.order_no)||' needs follow-up.'
 from public.portal_orders o join public.portal_profiles p on p.is_active=true and
 regexp_replace(upper(coalesce(p.branch,'')),'[ _-]','','g')=regexp_replace(upper(o.branch),'[ _-]','','g')
 where upper(o.order_type)='VOR' and o.processed_date is not null
 and ((timezone('Asia/Kolkata',now())::date-o.processed_date) between 3 and 5 or (timezone('Asia/Kolkata',now())::date-o.processed_date)>=6)
 and exists (select 1 from public.portal_order_items i where i.order_id=o.id and upper(coalesce(i.row_status,'')) in ('PROCESSED','PARTIALLY DISPATCHED'))
 on conflict do nothing;
 get diagnostics inserted_count=row_count;
 return inserted_count;
end $$;
revoke all on function public.portal_queue_delayed_vor_alerts() from public,anon,authenticated;
-- Scheduled service worker only. No client invocation.
grant execute on function public.portal_queue_delayed_vor_alerts() to service_role;
