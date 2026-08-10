-- TA/DA bill movement and chain-of-custody workflow
create extension if not exists pgcrypto;

-- Extend portal role model for Accounts users while retaining HQ support already used by the app.
alter table public.portal_profiles drop constraint if exists portal_profiles_role_check;
alter table public.portal_profiles add constraint portal_profiles_role_check
  check (role in ('branch','admin','super','manager','viewer','developer','hq','accounts'));

-- Engineer list contains Narsinghpur, which was not present in the original branch master seed.
insert into public.portal_branches(branch_key, branch_name, display_name, inventory_branch_code, head_quarter, sort_order, is_active)
values ('NARSINGHPUR','NARSINGHPUR','Narsinghpur',null,'NARSINGHPUR',115,true)
on conflict (branch_key) do update set
  branch_name=excluded.branch_name,
  display_name=excluded.display_name,
  head_quarter=excluded.head_quarter,
  is_active=true,
  updated_at=now();
select public.add_portal_branch_alias('NARSINGHPUR','NARSINGHPUR');
select public.add_portal_branch_alias('NARSINGHPUR','Narsinghpur');

create table if not exists public.portal_service_engineers (
  id uuid primary key default gen_random_uuid(),
  branch_key text not null references public.portal_branches(branch_key),
  engineer_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(branch_key, engineer_name)
);

insert into public.portal_service_engineers(branch_key, engineer_name) values
('DAMOH','RAVI CHAURASIYA'),('DAMOH','JEETESH VISHWAKARMA'),
('SEONI','SANTRAM PANCHESHWAR'),('SEONI','ROHIT SHRIVASTAVA'),('SEONI','KOUSHAL VISHWAKARMA'),('SEONI','DHARMENDRA PRAJAPATI'),('SEONI','VIJAY KHAIRWAR'),('SEONI','SHIVAM CHOUDHARY'),('SEONI','SAURAV BAGHEL'),
('ANUPPUR','MAHENDRA KUSHWAHA'),('ANUPPUR','RAMANUJ YADAV'),('ANUPPUR','BRAJENDRA KUMAR JOGI'),('ANUPPUR','MD TOUSEEF AHMED'),
('BALAGHAT','LEKHRAM MANESHWAR'),('BALAGHAT','KISHOR BISEN'),('BALAGHAT','SHISHUPAL BISEN'),('BALAGHAT','MOHIT PATLE'),('BALAGHAT','SHIV PRASAD RAUT'),('BALAGHAT','AMAN GANVEER'),('BALAGHAT','SURESH BANOTE'),('BALAGHAT','SUNIL NAGRIKAR'),('BALAGHAT','DUSHYANT RINAYAT'),
('KATNI','PRADEEP DWIVEDI'),('KATNI','LOVEKESH RAI'),('KATNI','LAVKUSH MISHRA'),('KATNI','KAUSHAL KISHOR VISHWAKARMA'),('KATNI','BALJI SINGH PARIHAR'),('KATNI','ANUJ DUBEY'),('KATNI','PAWAN PATEL'),('KATNI','IBRAN KHAN'),
('JABALPUR_BHL','ADITYA TILAK'),('JABALPUR_BHL','ANIL DEHARIYA'),('JABALPUR_BHL','ANKIT VISHWAKARMA'),('JABALPUR_BHL','ABHISHEK KANOJIYA'),('JABALPUR_BHL','BRAJESH PATEL'),('JABALPUR_BHL','DEEPAK NAMDEO'),('JABALPUR_BHL','JAIVEER SAINI'),('JABALPUR_BHL','PIYUSH PATEL'),('JABALPUR_BHL','PRAKASH SHRIVAS'),('JABALPUR_BHL','RAHUL JOUNJARD'),('JABALPUR_BHL','SACHIN NAMDEO'),('JABALPUR_BHL','RAJESH BAIN'),('JABALPUR_BHL','SAT SINGH PAL'),('JABALPUR_BHL','SOURABH SEN'),('JABALPUR_BHL','TUSHAR THAPA'),('JABALPUR_BHL','VIMAL GOTIYA'),('JABALPUR_BHL','PRADEEP SEN'),('JABALPUR_BHL','SHYAM SHIVVEDI'),('JABALPUR_BHL','RAHUL DHAWAN'),('JABALPUR_BHL','SHOBHIT LAKHERA'),
('MANDLA','DEVENDRA DIWAN'),('MANDLA','NITESH RAGHUVANSHI'),('MANDLA','DHARMENDRA CHOUDHARY'),
('NARSINGHPUR','JITENDRA SONI'),('NARSINGHPUR','HARI SHANKAR MALVIYA'),
('DINDORI','PUNEET YADAV'),('DINDORI','RAKESH YADAV'),
('JABALPUR_HL','MO. REZWAN'),('JABALPUR_HL','DURGESH PAWAR'),('JABALPUR_HL','RAJESH GUPTA'),('JABALPUR_HL','PAWAN UPADHYAY'),('JABALPUR_HL','VIKESH RAHANGDALE'),('JABALPUR_HL','SUBHASH PRAJAPATI'),('JABALPUR_HL','LALIT THAKRE'),('JABALPUR_HL','SUKANTA KUMAR DAS'),('JABALPUR_HL','ANKIT DAS'),('JABALPUR_HL','AVINASH KUMAR THAKUR')
on conflict (branch_key, engineer_name) do update set is_active=true, updated_at=now();

create table if not exists public.portal_tada_dispatches (
  id uuid primary key default gen_random_uuid(),
  dispatch_no text not null unique,
  branch_key text not null references public.portal_branches(branch_key),
  branch_name_snapshot text not null,
  status text not null default 'AWAITING_HQ_RECEIPT' check (status in (
    'AWAITING_HQ_RECEIPT','PARTIALLY_RECEIVED_HQ','AWAITING_ACCOUNTS_RECEIPT',
    'PARTIALLY_RECEIVED_ACCOUNTS','COMPLETED'
  )),
  dispatch_date date not null,
  dispatched_by text not null,
  dispatch_mode text not null check (dispatch_mode in ('Bus','Transport','By Hand')),
  reference_no text,
  total_svr_count int not null check (total_svr_count > 0),
  created_by uuid not null references public.portal_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_tada_svr_items (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.portal_tada_dispatches(id) on delete cascade,
  svr_no text not null,
  engineer_id uuid references public.portal_service_engineers(id),
  engineer_name_snapshot text not null,
  date_from date not null,
  date_to date not null,
  machine_no text not null,
  customer_name text not null,
  current_location text not null default 'IN_TRANSIT_TO_HQ' check (current_location in (
    'IN_TRANSIT_TO_HQ','HQ','IN_TRANSIT_TO_ACCOUNTS','ACCOUNTS','MISSING_HQ','MISSING_ACCOUNTS'
  )),
  hq_received boolean,
  hq_exception_reason text,
  hq_remark text,
  accounts_received boolean,
  accounts_exception_reason text,
  accounts_remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (date_to >= date_from)
);

create table if not exists public.portal_tada_receipts (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.portal_tada_dispatches(id) on delete cascade,
  stage text not null check (stage in ('HQ','ACCOUNTS')),
  received_by uuid not null references public.portal_profiles(id),
  received_at timestamptz not null default now(),
  expected_count int not null,
  received_count int not null,
  missing_count int not null,
  unique(dispatch_id, stage)
);

create table if not exists public.portal_tada_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.portal_tada_receipts(id) on delete cascade,
  svr_item_id uuid not null references public.portal_tada_svr_items(id) on delete cascade,
  received boolean not null,
  exception_reason text,
  remark text,
  unique(receipt_id, svr_item_id)
);

create table if not exists public.portal_tada_events (
  id uuid primary key default gen_random_uuid(),
  dispatch_id uuid not null references public.portal_tada_dispatches(id) on delete cascade,
  svr_item_id uuid references public.portal_tada_svr_items(id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.portal_profiles(id),
  actor_name_snapshot text,
  actor_role_snapshot text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_tada_dispatch_branch_status on public.portal_tada_dispatches(branch_key,status,dispatch_date desc);
create index if not exists idx_tada_items_dispatch on public.portal_tada_svr_items(dispatch_id);
create index if not exists idx_tada_items_svr on public.portal_tada_svr_items(upper(svr_no));
create index if not exists idx_tada_events_dispatch on public.portal_tada_events(dispatch_id,created_at);
create index if not exists idx_service_engineers_branch on public.portal_service_engineers(branch_key,is_active,engineer_name);

alter table public.portal_service_engineers enable row level security;
alter table public.portal_tada_dispatches enable row level security;
alter table public.portal_tada_svr_items enable row level security;
alter table public.portal_tada_receipts enable row level security;
alter table public.portal_tada_receipt_items enable row level security;
alter table public.portal_tada_events enable row level security;

create or replace function public.portal_tada_profile()
returns public.portal_profiles language sql stable security definer set search_path=public as $$
  select p from public.portal_profiles p where p.auth_user_id=auth.uid() and coalesce(p.is_active,true) limit 1
$$;

create or replace function public.portal_can_view_tada_branch(p_branch text)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.portal_profiles p
    where p.auth_user_id=auth.uid() and coalesce(p.is_active,true)
      and (
        p.role in ('manager','developer','hq','accounts')
        or (p.role='branch' and coalesce(public.resolve_portal_branch(p.branch),p.branch)=p_branch)
      )
  )
$$;

create policy tada_engineers_read on public.portal_service_engineers for select using (
  exists(select 1 from public.portal_profiles p where p.auth_user_id=auth.uid() and coalesce(p.is_active,true) and p.role in ('branch','manager','developer','hq','accounts'))
);
create policy tada_dispatch_read on public.portal_tada_dispatches for select using (public.portal_can_view_tada_branch(branch_key));
create policy tada_items_read on public.portal_tada_svr_items for select using (
  exists(select 1 from public.portal_tada_dispatches d where d.id=dispatch_id and public.portal_can_view_tada_branch(d.branch_key))
);
create policy tada_receipts_read on public.portal_tada_receipts for select using (
  exists(select 1 from public.portal_tada_dispatches d where d.id=dispatch_id and public.portal_can_view_tada_branch(d.branch_key))
);
create policy tada_receipt_items_read on public.portal_tada_receipt_items for select using (
  exists(select 1 from public.portal_tada_svr_items i join public.portal_tada_dispatches d on d.id=i.dispatch_id where i.id=svr_item_id and public.portal_can_view_tada_branch(d.branch_key))
);
create policy tada_events_read on public.portal_tada_events for select using (
  exists(select 1 from public.portal_tada_dispatches d where d.id=dispatch_id and public.portal_can_view_tada_branch(d.branch_key))
);

create or replace function public.portal_create_tada_dispatch(
  p_branch text,
  p_dispatch_date date,
  p_dispatched_by text,
  p_dispatch_mode text,
  p_reference_no text,
  p_items jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_profile public.portal_profiles;
  v_branch text;
  v_branch_name text;
  v_id uuid;
  v_dispatch_no text;
  v_count int;
  v_duplicate text;
begin
  select * into v_profile from public.portal_profiles where auth_user_id=auth.uid() and coalesce(is_active,true) limit 1;
  if v_profile.id is null or v_profile.role not in ('branch','manager','developer','hq') then raise exception 'Not permitted to create TA/DA dispatches'; end if;

  v_branch := public.resolve_portal_branch(p_branch);
  if v_branch is null then raise exception 'Invalid office'; end if;
  if v_profile.role='branch' and coalesce(public.resolve_portal_branch(v_profile.branch),v_profile.branch)<>v_branch then raise exception 'Branch users can create TA/DA dispatches only for their own office'; end if;
  if p_dispatch_mode not in ('Bus','Transport','By Hand') then raise exception 'Invalid dispatch mode'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'At least one SVR is required'; end if;
  if nullif(trim(p_dispatched_by),'') is null then raise exception 'Dispatched By is required'; end if;
  if p_dispatch_mode in ('Bus','Transport') and nullif(trim(coalesce(p_reference_no,'')),'') is null then raise exception 'Ref. No. is required for Bus or Transport dispatch'; end if;

  select count(*) into v_count from jsonb_array_elements(p_items);
  select x.svr_no into v_duplicate
  from jsonb_to_recordset(p_items) as x(svr_no text, engineer_id uuid, engineer_name text, date_from date, date_to date, machine_no text, customer_name text)
  join public.portal_tada_svr_items existing on upper(trim(existing.svr_no))=upper(trim(x.svr_no))
  join public.portal_tada_dispatches d on d.id=existing.dispatch_id
  where d.status<>'COMPLETED'
  limit 1;
  if v_duplicate is not null then raise exception 'SVR % is already part of an active TA/DA dispatch', v_duplicate; end if;

  select display_name into v_branch_name from public.portal_branches where branch_key=v_branch;
  v_dispatch_no := 'TADA-' || to_char(now(),'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
  insert into public.portal_tada_dispatches(dispatch_no,branch_key,branch_name_snapshot,dispatch_date,dispatched_by,dispatch_mode,reference_no,total_svr_count,created_by)
  values(v_dispatch_no,v_branch,coalesce(v_branch_name,v_branch),p_dispatch_date,trim(p_dispatched_by),p_dispatch_mode,nullif(trim(coalesce(p_reference_no,'')),''),v_count,v_profile.id)
  returning id into v_id;

  insert into public.portal_tada_svr_items(dispatch_id,svr_no,engineer_id,engineer_name_snapshot,date_from,date_to,machine_no,customer_name)
  select v_id, trim(x.svr_no), x.engineer_id, trim(x.engineer_name), x.date_from, x.date_to, trim(x.machine_no), trim(x.customer_name)
  from jsonb_to_recordset(p_items) as x(svr_no text, engineer_id uuid, engineer_name text, date_from date, date_to date, machine_no text, customer_name text)
  where nullif(trim(x.svr_no),'') is not null and nullif(trim(x.engineer_name),'') is not null and x.date_from is not null and x.date_to is not null and x.date_to>=x.date_from and nullif(trim(x.machine_no),'') is not null and nullif(trim(x.customer_name),'') is not null;

  if (select count(*) from public.portal_tada_svr_items where dispatch_id=v_id)<>v_count then raise exception 'One or more SVR rows are incomplete'; end if;

  insert into public.portal_tada_events(dispatch_id,event_type,actor_id,actor_name_snapshot,actor_role_snapshot,metadata)
  values(v_id,'DISPATCH_SUBMITTED',v_profile.id,v_profile.full_name,v_profile.role,jsonb_build_object('dispatch_no',v_dispatch_no,'branch',v_branch,'count',v_count,'dispatch_mode',p_dispatch_mode,'reference_no',p_reference_no));
  return v_id;
end $$;

create or replace function public.portal_receive_tada_dispatch(
  p_dispatch_id uuid,
  p_stage text,
  p_results jsonb
) returns void language plpgsql security definer set search_path=public as $$
declare
  v_profile public.portal_profiles;
  v_dispatch public.portal_tada_dispatches;
  v_expected int;
  v_received int;
  v_missing int;
  v_receipt_id uuid;
begin
  select * into v_profile from public.portal_profiles where auth_user_id=auth.uid() and coalesce(is_active,true) limit 1;
  if v_profile.id is null then raise exception 'Unauthorized'; end if;
  if p_stage='HQ' and v_profile.role not in ('manager','developer') then raise exception 'Only Manager or Developer can record HQ receipt'; end if;
  if p_stage='ACCOUNTS' and v_profile.role not in ('accounts','developer') then raise exception 'Only Accounts or Developer can record Accounts receipt'; end if;
  if p_stage not in ('HQ','ACCOUNTS') then raise exception 'Invalid receipt stage'; end if;

  select * into v_dispatch from public.portal_tada_dispatches where id=p_dispatch_id for update;
  if v_dispatch.id is null then raise exception 'TA/DA dispatch not found'; end if;
  if p_stage='HQ' and v_dispatch.status<>'AWAITING_HQ_RECEIPT' then raise exception 'HQ receipt has already been processed or dispatch is in another stage'; end if;
  if p_stage='ACCOUNTS' and v_dispatch.status not in ('AWAITING_ACCOUNTS_RECEIPT','PARTIALLY_RECEIVED_HQ') then raise exception 'Dispatch is not awaiting Accounts receipt'; end if;

  if p_stage='HQ' then
    select count(*) into v_expected from public.portal_tada_svr_items where dispatch_id=p_dispatch_id;
  else
    select count(*) into v_expected from public.portal_tada_svr_items where dispatch_id=p_dispatch_id and hq_received=true;
  end if;
  if p_results is null or jsonb_typeof(p_results)<>'array' or jsonb_array_length(p_results)<>v_expected then raise exception 'Receipt selection does not match expected SVR count'; end if;

  select count(*) filter (where x.received), count(*) filter (where not x.received)
  into v_received,v_missing
  from jsonb_to_recordset(p_results) as x(svr_item_id uuid, received boolean, exception_reason text, remark text);

  insert into public.portal_tada_receipts(dispatch_id,stage,received_by,expected_count,received_count,missing_count)
  values(p_dispatch_id,p_stage,v_profile.id,v_expected,v_received,v_missing)
  returning id into v_receipt_id;

  insert into public.portal_tada_receipt_items(receipt_id,svr_item_id,received,exception_reason,remark)
  select v_receipt_id,x.svr_item_id,x.received,nullif(trim(coalesce(x.exception_reason,'')),''),nullif(trim(coalesce(x.remark,'')),'')
  from jsonb_to_recordset(p_results) as x(svr_item_id uuid, received boolean, exception_reason text, remark text);

  if exists(select 1 from jsonb_to_recordset(p_results) as x(svr_item_id uuid, received boolean, exception_reason text, remark text) where not x.received and nullif(trim(coalesce(x.exception_reason,'')),'') is null) then
    raise exception 'A reason is required for every SVR marked not received';
  end if;

  if p_stage='HQ' then
    update public.portal_tada_svr_items i set
      hq_received=x.received,
      hq_exception_reason=nullif(trim(coalesce(x.exception_reason,'')),''),
      hq_remark=nullif(trim(coalesce(x.remark,'')),''),
      current_location=case when x.received then 'IN_TRANSIT_TO_ACCOUNTS' else 'MISSING_HQ' end,
      updated_at=now()
    from jsonb_to_recordset(p_results) as x(svr_item_id uuid, received boolean, exception_reason text, remark text)
    where i.id=x.svr_item_id and i.dispatch_id=p_dispatch_id;
    update public.portal_tada_dispatches set status=case when v_missing=0 then 'AWAITING_ACCOUNTS_RECEIPT' else 'PARTIALLY_RECEIVED_HQ' end, updated_at=now() where id=p_dispatch_id;
  else
    update public.portal_tada_svr_items i set
      accounts_received=x.received,
      accounts_exception_reason=nullif(trim(coalesce(x.exception_reason,'')),''),
      accounts_remark=nullif(trim(coalesce(x.remark,'')),''),
      current_location=case when x.received then 'ACCOUNTS' else 'MISSING_ACCOUNTS' end,
      updated_at=now()
    from jsonb_to_recordset(p_results) as x(svr_item_id uuid, received boolean, exception_reason text, remark text)
    where i.id=x.svr_item_id and i.dispatch_id=p_dispatch_id and i.hq_received=true;
    update public.portal_tada_dispatches set status=case when v_missing=0 then 'COMPLETED' else 'PARTIALLY_RECEIVED_ACCOUNTS' end, updated_at=now() where id=p_dispatch_id;
  end if;

  insert into public.portal_tada_events(dispatch_id,event_type,actor_id,actor_name_snapshot,actor_role_snapshot,metadata)
  values(p_dispatch_id,case when p_stage='HQ' then 'HQ_RECEIPT_RECORDED' else 'ACCOUNTS_RECEIPT_RECORDED' end,v_profile.id,v_profile.full_name,v_profile.role,jsonb_build_object('expected',v_expected,'received',v_received,'missing',v_missing));
end $$;

grant select on public.portal_service_engineers to authenticated;
grant select on public.portal_tada_dispatches to authenticated;
grant select on public.portal_tada_svr_items to authenticated;
grant select on public.portal_tada_receipts to authenticated;
grant select on public.portal_tada_receipt_items to authenticated;
grant select on public.portal_tada_events to authenticated;
grant execute on function public.portal_create_tada_dispatch(text,date,text,text,text,jsonb) to authenticated;
grant execute on function public.portal_receive_tada_dispatch(uuid,text,jsonb) to authenticated;
