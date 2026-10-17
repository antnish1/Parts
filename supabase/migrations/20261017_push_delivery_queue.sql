-- Durable per-device push delivery queue. Existing portal_notifications unchanged.
-- Do not deploy before rollout review and scheduler secret setup.
create table if not exists public.portal_push_deliveries (
 id uuid primary key default gen_random_uuid(),
 notification_id uuid not null references public.portal_notifications(id) on delete cascade,
 device_id uuid not null references public.portal_push_devices(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','leased','ticket_ok','delivered','retry','failed','invalid_token')),
 attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 lease_token uuid,
 lease_until timestamptz,
 expo_ticket_id text,
 last_error text,
 submitted_at timestamptz,
 delivered_at timestamptz,
 updated_at timestamptz not null default now(),
 unique(notification_id,device_id)
);
create index if not exists portal_push_deliveries_due_idx on public.portal_push_deliveries(next_attempt_at) where status in ('pending','retry','leased');
create index if not exists portal_push_deliveries_ticket_idx on public.portal_push_deliveries(expo_ticket_id) where status='ticket_ok';
alter table public.portal_push_deliveries enable row level security;
revoke all on public.portal_push_deliveries from anon,authenticated;
-- No public/user RLS policies: only the isolated service-role dispatcher operates queue.

create or replace function public.portal_push_fill_queue(max_rows integer default 100)
returns integer language plpgsql security definer set search_path=public as $$
declare n integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service_role only'; end if;
 insert into public.portal_push_deliveries(notification_id,device_id)
 select n.id,d.id from public.portal_notifications n
 join public.portal_profiles p on p.id=n.recipient_profile_id and p.is_active=true
 join public.portal_push_devices d on d.profile_id=p.id
 where n.push_sent_at is null
 order by n.created_at asc
 limit greatest(1,least(max_rows,500))
 on conflict do nothing;
 get diagnostics n=row_count;
 return n;
end $$;

create or replace function public.portal_push_claim(max_rows integer default 50)
returns table(id uuid,lease_token uuid,notification_id uuid,device_id uuid,expo_push_token text,order_id uuid,title text,body text)
language plpgsql security definer set search_path=public as $$
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service_role only'; end if;
 return query
 with due as (
 select q.id from public.portal_push_deliveries q
 where (q.status in ('pending','retry') and q.next_attempt_at<=now())
    or (q.status='leased' and q.lease_until<now())
 for update skip locked limit greatest(1,least(max_rows,100))
 ), claimed as (
 update public.portal_push_deliveries q set status='leased',lease_token=gen_random_uuid(),
   lease_until=now()+interval '2 minutes',attempts=q.attempts+1,updated_at=now()
 from due where q.id=due.id returning q.*
 )
 select c.id,c.lease_token,c.notification_id,c.device_id,d.expo_push_token,
 n.order_id,n.title,n.body from claimed c
 join public.portal_push_devices d on d.id=c.device_id
 join public.portal_profiles p on p.id=d.profile_id and p.is_active=true
 join public.portal_notifications n on n.id=c.notification_id and n.recipient_profile_id=p.id;
end $$;

create or replace function public.portal_push_finish(
 p_id uuid,p_lease_token uuid,p_status text,p_ticket_id text default null,p_error text default null)
returns boolean language plpgsql security definer set search_path=public as $$
declare updated_count integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service_role only'; end if;
 if p_status not in ('ticket_ok','delivered','retry','failed','invalid_token') then raise exception 'invalid status'; end if;
 update public.portal_push_deliveries
 set status=case when p_status='retry' and attempts>=6 then 'failed' else p_status end,
   expo_ticket_id=case when p_status='ticket_ok' then p_ticket_id else expo_ticket_id end,
   last_error=left(p_error,500),
   submitted_at=case when p_status='ticket_ok' then now() else submitted_at end,
   delivered_at=case when p_status='delivered' then now() else delivered_at end,
   next_attempt_at=case when p_status='retry'
     then now()+least(interval '12 hours', interval '2 minutes' * power(2,least(attempts,8))) else next_attempt_at end,
   lease_token=null,lease_until=null,updated_at=now()
 where id=p_id and lease_token=p_lease_token and status='leased';
 get diagnostics updated_count=row_count;
 return updated_count=1;
end $$;

revoke all on function public.portal_push_fill_queue(integer) from public,anon,authenticated;
revoke all on function public.portal_push_claim(integer) from public,anon,authenticated;
revoke all on function public.portal_push_finish(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.portal_push_fill_queue(integer) to service_role;
grant execute on function public.portal_push_claim(integer) to service_role;
grant execute on function public.portal_push_finish(uuid,uuid,text,text,text) to service_role;
