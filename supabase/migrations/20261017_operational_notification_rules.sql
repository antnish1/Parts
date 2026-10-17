-- Future operational notifications only. No historic backfill.
-- Branch key matching ignores spaces/hyphens, and excludes blank branches.
create or replace function public.portal_notify_credit_dispatch()
returns trigger language plpgsql security definer set search_path=public as $$
declare d record; target_role text; heading text;
begin
 select * into d from public.portal_credit_dispatches where id=new.dispatch_id;
 if not found then return new; end if;
 -- Determine recipients from CURRENT workflow state; supports existing Accounts-first
 -- and newer Manager-first requests without rewriting approval transitions.
 target_role:=case
  when d.approval_status='Pending Manager Approval' then 'manager'
  when d.approval_status='Pending Accounts Approval' then 'accounts'
  else 'branch' end;
 heading:=case
  when d.approval_status='Pending Manager Approval' then 'Credit dispatch: Manager review'
  when d.approval_status='Pending Accounts Approval' then 'Credit dispatch: Accounts review'
  when d.approval_status ilike 'Correction%' then 'Credit dispatch: Correction requested'
  when d.approval_status ilike 'Rejected%' then 'Credit dispatch rejected'
  when d.approval_status='Approved' then 'Credit dispatch approved'
  else 'Credit dispatch updated' end;
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,null,'credit-event:'||new.id::text,'credit_dispatch',heading,
   'Credit dispatch '||coalesce(d.dispatch_no,'')||' updated.'
 from public.portal_profiles p
 where p.is_active=true and p.id is distinct from new.created_by and (
   (p.role=target_role and (
      target_role='accounts' or
      (nullif(trim(coalesce(d.branch,'')),'') is not null and
       regexp_replace(upper(p.branch),'[ _-]','','g')=regexp_replace(upper(d.branch),'[ _-]','','g'))
   )) or
   (target_role='branch' and p.id=d.created_by)
 )
 on conflict do nothing;
 return new;
end $$;
drop trigger if exists notify_credit_dispatch_event on public.portal_credit_dispatch_events;
create trigger notify_credit_dispatch_event after insert on public.portal_credit_dispatch_events
for each row execute function public.portal_notify_credit_dispatch();

create or replace function public.portal_notify_tada()
returns trigger language plpgsql security definer set search_path=public as $$
declare d record; target_role text; heading text;
begin
 select * into d from public.portal_tada_dispatches where id=new.dispatch_id;
 if not found then return new; end if;
 target_role:=case when d.status in ('AWAITING_HQ_RECEIPT','PARTIALLY_RECEIVED_HQ') then 'manager'
 when d.status in ('AWAITING_ACCOUNTS_RECEIPT','PARTIALLY_RECEIVED_ACCOUNTS') then 'accounts'
 else 'branch' end;
 heading:=case when target_role='manager' then 'TA/DA: HQ receipt needed'
 when target_role='accounts' then 'TA/DA: Accounts receipt needed'
 else 'TA/DA dispatch updated' end;
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,null,'tada-event:'||new.id::text,'tada',heading,
 'TA/DA dispatch '||coalesce(d.dispatch_no,'')||' updated.'
 from public.portal_profiles p
 where p.is_active=true and p.id is distinct from new.actor_id and (
  (target_role='accounts' and p.role='accounts') or
  (target_role='manager' and p.role='manager' and
    nullif(trim(coalesce(d.branch_key,'')),'') is not null and
    regexp_replace(upper(p.branch),'[ _-]','','g')=regexp_replace(upper(d.branch_key),'[ _-]','','g')) or
  (target_role='branch' and p.id=d.created_by)
 )
 on conflict do nothing;
 return new;
end $$;
drop trigger if exists notify_tada_event on public.portal_tada_events;
create trigger notify_tada_event after insert on public.portal_tada_events
for each row execute function public.portal_notify_tada();

create or replace function public.portal_notify_installation()
returns trigger language plpgsql security definer set search_path=public as $$
declare heading text; category_name text;
begin
 if new.status is not distinct from old.status then return new; end if;
 if new.status not in ('ACCEPTANCE_PENDING','COMPLETED','ACCEPTED') then return new; end if;
 heading:=case when new.status='ACCEPTED' then 'Installation accepted'
 else 'Installation awaiting acceptance' end;
 category_name:='installation';
 insert into public.portal_notifications(recipient_profile_id,order_id,event_key,category,title,body)
 select p.id,null,'installation:'||new.id::text||':'||new.status||':'||coalesce(new.updated_at::text,''),
 category_name,heading,'Installation '||coalesce(new.entry_no,'')||' updated.'
 from public.portal_profiles p
 where p.is_active=true and (
   (new.status='ACCEPTED' and p.id=new.created_by) or
   (new.status<>'ACCEPTED' and p.role in ('manager','super') and
     nullif(trim(coalesce(new.branch,'')),'') is not null and
     regexp_replace(upper(p.branch),'[ _-]','','g')=regexp_replace(upper(new.branch),'[ _-]','','g'))
 )
 on conflict do nothing;
 return new;
end $$;
drop trigger if exists notify_installation_status on public.portal_installation_entries;
create trigger notify_installation_status after update of status on public.portal_installation_entries
for each row execute function public.portal_notify_installation();
