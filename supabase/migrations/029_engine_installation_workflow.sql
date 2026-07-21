-- Engine / Rock Breaker installation workflow
create extension if not exists pgcrypto;

create table if not exists public.portal_installation_entries (
  id uuid primary key default gen_random_uuid(),
  entry_no text not null unique,
  equipment_type text not null check (equipment_type in ('ENGINE','ROCK_BREAKER')),
  invoice_date date not null,
  branch text not null,
  invoice_no text not null,
  customer_name text not null,
  status text not null default 'PENDING' check (status in ('PENDING','COMPLETED','ACCEPTED')),
  jcb_invoice_no text,
  svr_no text,
  equipment_registration_no text,
  created_by uuid references public.portal_profiles(id),
  created_at timestamptz not null default now(),
  branch_submitted_by uuid references public.portal_profiles(id),
  branch_submitted_at timestamptz,
  accepted_by uuid references public.portal_profiles(id),
  accepted_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.portal_installation_items (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.portal_installation_entries(id) on delete cascade,
  part_no text not null,
  description text not null,
  quantity numeric not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.portal_installation_documents (
  id uuid primary key default gen_random_uuid(),
  installation_id uuid not null references public.portal_installation_entries(id) on delete cascade,
  document_type text not null check (document_type in ('JCB_INVOICE','DBMS_INVOICE','SVR')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null,
  uploaded_by uuid references public.portal_profiles(id),
  uploaded_at timestamptz not null default now(),
  is_active boolean not null default true
);

create index if not exists idx_installation_entries_branch_status on public.portal_installation_entries(branch, status);
create index if not exists idx_installation_documents_entry on public.portal_installation_documents(installation_id, document_type, is_active);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('installation-documents','installation-documents',false,15728640,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

alter table public.portal_installation_entries enable row level security;
alter table public.portal_installation_items enable row level security;
alter table public.portal_installation_documents enable row level security;

create or replace function public.portal_current_profile()
returns public.portal_profiles language sql stable security definer set search_path=public as $$
  select p from public.portal_profiles p where p.auth_user_id = auth.uid() and coalesce(p.is_active,true) limit 1
$$;

create or replace function public.portal_can_manage_installations()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.portal_profiles p
    where p.auth_user_id=auth.uid() and coalesce(p.is_active,true)
      and (p.role in ('admin','manager','developer','hq') or upper(replace(coalesce(p.branch,''),' ','_'))='JABALPUR_PARTS')
  )
$$;

create or replace function public.portal_can_view_installation(p_entry public.portal_installation_entries)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.portal_profiles p
    where p.auth_user_id=auth.uid() and coalesce(p.is_active,true)
      and (
        public.portal_can_manage_installations()
        or p.id='9f3c378e-89d4-4427-87f2-c66061dbf3e2'::uuid
        or upper(replace(coalesce(p.branch,''),' ','_'))=upper(replace(coalesce(p_entry.branch,''),' ','_'))
      )
  )
$$;

create policy installation_entries_select on public.portal_installation_entries for select using (public.portal_can_view_installation(portal_installation_entries));
create policy installation_items_select on public.portal_installation_items for select using (exists(select 1 from public.portal_installation_entries e where e.id=installation_id and public.portal_can_view_installation(e)));
create policy installation_documents_select on public.portal_installation_documents for select using (exists(select 1 from public.portal_installation_entries e where e.id=installation_id and public.portal_can_view_installation(e)));

create policy installation_documents_insert on public.portal_installation_documents for insert with check (
  exists(select 1 from public.portal_installation_entries e join public.portal_profiles p on p.auth_user_id=auth.uid()
    where e.id=installation_id and e.status='PENDING'
      and upper(replace(coalesce(p.branch,''),' ','_'))=upper(replace(coalesce(e.branch,''),' ','_')))
);
create policy installation_documents_update on public.portal_installation_documents for update using (
  exists(select 1 from public.portal_installation_entries e join public.portal_profiles p on p.auth_user_id=auth.uid()
    where e.id=installation_id and e.status='PENDING'
      and upper(replace(coalesce(p.branch,''),' ','_'))=upper(replace(coalesce(e.branch,''),' ','_')))
);

create policy installation_storage_read on storage.objects for select using (
  bucket_id='installation-documents' and exists(select 1 from public.portal_profiles p where p.auth_user_id=auth.uid() and coalesce(p.is_active,true))
);
create policy installation_storage_insert on storage.objects for insert with check (
  bucket_id='installation-documents' and exists(select 1 from public.portal_profiles p where p.auth_user_id=auth.uid() and coalesce(p.is_active,true))
);
create policy installation_storage_update on storage.objects for update using (
  bucket_id='installation-documents' and exists(select 1 from public.portal_profiles p where p.auth_user_id=auth.uid() and coalesce(p.is_active,true))
);

create or replace function public.portal_create_installation_entry(
  p_equipment_type text, p_invoice_date date, p_branch text, p_invoice_no text, p_customer_name text, p_items jsonb
) returns uuid language plpgsql security definer set search_path=public as $$
declare v_profile public.portal_profiles; v_id uuid; v_entry_no text;
begin
  select * into v_profile from public.portal_profiles where auth_user_id=auth.uid() and coalesce(is_active,true) limit 1;
  if v_profile.id is null or not public.portal_can_manage_installations() then raise exception 'Not permitted to create installation entries'; end if;
  if p_equipment_type not in ('ENGINE','ROCK_BREAKER') then raise exception 'Invalid equipment type'; end if;
  if p_items is null or jsonb_array_length(p_items)=0 then raise exception 'At least one item is required'; end if;
  v_entry_no := 'INS-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.portal_installation_entries(entry_no,equipment_type,invoice_date,branch,invoice_no,customer_name,created_by)
  values(v_entry_no,p_equipment_type,p_invoice_date,trim(p_branch),trim(p_invoice_no),trim(p_customer_name),v_profile.id) returning id into v_id;
  insert into public.portal_installation_items(installation_id,part_no,description,quantity)
  select v_id, trim(x.part_no), trim(x.description), x.quantity
  from jsonb_to_recordset(p_items) as x(part_no text, description text, quantity numeric);
  return v_id;
end $$;

create or replace function public.portal_submit_installation_entry(p_installation_id uuid, p_jcb_invoice_no text, p_svr_no text)
returns void language plpgsql security definer set search_path=public as $$
declare v_profile public.portal_profiles; v_entry public.portal_installation_entries; v_docs int;
begin
  select * into v_profile from public.portal_profiles where auth_user_id=auth.uid() and coalesce(is_active,true) limit 1;
  select * into v_entry from public.portal_installation_entries where id=p_installation_id for update;
  if v_entry.id is null or v_entry.status<>'PENDING' then raise exception 'Entry is not pending'; end if;
  if upper(replace(coalesce(v_profile.branch,''),' ','_'))<>upper(replace(coalesce(v_entry.branch,''),' ','_')) then raise exception 'Entry belongs to another branch'; end if;
  select count(distinct document_type) into v_docs from public.portal_installation_documents where installation_id=p_installation_id and is_active and document_type in ('JCB_INVOICE','DBMS_INVOICE','SVR');
  if v_docs<3 then raise exception 'JCB Invoice, DBMS Invoice and SVR uploads are required'; end if;
  update public.portal_installation_entries set status='COMPLETED',jcb_invoice_no=trim(p_jcb_invoice_no),svr_no=trim(p_svr_no),branch_submitted_by=v_profile.id,branch_submitted_at=now(),updated_at=now() where id=p_installation_id;
end $$;

create or replace function public.portal_accept_installation_entry(p_installation_id uuid, p_registration_no text)
returns void language plpgsql security definer set search_path=public as $$
declare v_profile public.portal_profiles; v_entry public.portal_installation_entries;
begin
  select * into v_profile from public.portal_profiles where auth_user_id=auth.uid() and coalesce(is_active,true) limit 1;
  if v_profile.id is distinct from '9f3c378e-89d4-4427-87f2-c66061dbf3e2'::uuid then raise exception 'Only the designated viewer can accept entries'; end if;
  select * into v_entry from public.portal_installation_entries where id=p_installation_id for update;
  if v_entry.status<>'COMPLETED' then raise exception 'Only completed entries can be accepted'; end if;
  if nullif(trim(p_registration_no),'') is null then raise exception 'Equipment registration number is required'; end if;
  update public.portal_installation_entries set status='ACCEPTED',equipment_registration_no=trim(p_registration_no),accepted_by=v_profile.id,accepted_at=now(),updated_at=now() where id=p_installation_id;
end $$;

grant execute on function public.portal_create_installation_entry(text,date,text,text,text,jsonb) to authenticated;
grant execute on function public.portal_submit_installation_entry(uuid,text,text) to authenticated;
grant execute on function public.portal_accept_installation_entry(uuid,text) to authenticated;
