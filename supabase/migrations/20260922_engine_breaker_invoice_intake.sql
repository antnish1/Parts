-- Engine & Breaker invoice intake before installation registration.
-- Reversible by dropping the RPCs/policies/table/index below; no existing installation rows are modified.

create table if not exists public.portal_installation_invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_date date not null,
  jcb_invoice_no text not null,
  part_no text not null,
  description text not null,
  equipment_type text not null check (equipment_type in ('ENGINE','ROCK_BREAKER')),
  serial_no text not null,
  dbms_no text,
  document_path text not null,
  document_name text not null,
  document_mime_type text not null,
  document_size bigint not null check (document_size > 0),
  installation_id uuid unique references public.portal_installation_entries(id) on delete set null,
  created_by uuid references public.portal_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_installation_invoice_number_serial
  on public.portal_installation_invoices (upper(trim(jcb_invoice_no)), upper(trim(serial_no)));
create index if not exists idx_installation_invoice_created_at
  on public.portal_installation_invoices (created_at desc);

alter table public.portal_installation_invoices enable row level security;

drop policy if exists installation_invoices_select on public.portal_installation_invoices;
create policy installation_invoices_select on public.portal_installation_invoices
for select using (
  exists (
    select 1 from public.portal_profiles p
    where p.auth_user_id = auth.uid() and coalesce(p.is_active,true)
  )
);

drop policy if exists installation_invoices_insert on public.portal_installation_invoices;
create policy installation_invoices_insert on public.portal_installation_invoices
for insert with check (public.portal_can_manage_installations());

drop policy if exists installation_invoices_update on public.portal_installation_invoices;
create policy installation_invoices_update on public.portal_installation_invoices
for update using (public.portal_can_manage_installations())
with check (public.portal_can_manage_installations());

drop policy if exists installation_storage_delete_invoice_intake on storage.objects;
create policy installation_storage_delete_invoice_intake on storage.objects
for delete using (
  bucket_id='installation-documents' and public.portal_can_manage_installations()
);

create or replace function public.portal_create_installation_invoice(
  p_invoice_date date,
  p_jcb_invoice_no text,
  p_part_no text,
  p_description text,
  p_equipment_type text,
  p_serial_no text,
  p_dbms_no text,
  p_document_path text,
  p_document_name text,
  p_document_mime_type text,
  p_document_size bigint
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_profile public.portal_profiles;
  v_id uuid;
begin
  select * into v_profile from public.portal_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true) limit 1;

  if v_profile.id is null or not public.portal_can_manage_installations() then
    raise exception 'Not permitted to add Engine & Breaker invoices';
  end if;
  if p_equipment_type not in ('ENGINE','ROCK_BREAKER') then raise exception 'Invalid equipment type'; end if;
  if nullif(trim(p_jcb_invoice_no),'') is null then raise exception 'JCB Invoice No. is required'; end if;
  if nullif(trim(p_part_no),'') is null then raise exception 'Part No. is required'; end if;
  if nullif(trim(p_description),'') is null then raise exception 'Part description is required'; end if;
  if nullif(trim(p_serial_no),'') is null then raise exception 'Serial No. is required'; end if;
  if nullif(trim(p_document_path),'') is null then raise exception 'JCB Invoice upload is required'; end if;

  insert into public.portal_installation_invoices(
    invoice_date,jcb_invoice_no,part_no,description,equipment_type,serial_no,dbms_no,
    document_path,document_name,document_mime_type,document_size,created_by
  ) values (
    p_invoice_date,upper(trim(p_jcb_invoice_no)),upper(trim(p_part_no)),trim(p_description),p_equipment_type,
    upper(trim(p_serial_no)),nullif(upper(trim(coalesce(p_dbms_no,''))),''),p_document_path,
    p_document_name,p_document_mime_type,p_document_size,v_profile.id
  ) returning id into v_id;

  return v_id;
end $$;

create or replace function public.portal_create_installation_from_invoice(
  p_invoice_id uuid,
  p_branch text,
  p_customer_name text,
  p_quantity numeric
) returns uuid language plpgsql security definer set search_path=public as $$
declare
  v_profile public.portal_profiles;
  v_invoice public.portal_installation_invoices;
  v_installation_id uuid;
  v_entry_no text;
begin
  select * into v_profile from public.portal_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true) limit 1;

  if v_profile.id is null or not public.portal_can_manage_installations() then
    raise exception 'Not permitted to create installation entries';
  end if;
  if nullif(trim(p_branch),'') is null then raise exception 'Branch is required'; end if;
  if nullif(trim(p_customer_name),'') is null then raise exception 'Customer Name is required'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;

  select * into v_invoice from public.portal_installation_invoices
  where id=p_invoice_id for update;

  if v_invoice.id is null then raise exception 'Invoice not found'; end if;
  if v_invoice.installation_id is not null then raise exception 'This invoice is already registered'; end if;

  v_entry_no := 'INS-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.portal_installation_entries(
    entry_no,equipment_type,invoice_date,branch,invoice_no,customer_name,created_by
  ) values (
    v_entry_no,v_invoice.equipment_type,v_invoice.invoice_date,trim(p_branch),
    coalesce(nullif(v_invoice.dbms_no,''),v_invoice.jcb_invoice_no),trim(p_customer_name),v_profile.id
  ) returning id into v_installation_id;

  insert into public.portal_installation_items(installation_id,part_no,description,quantity)
  values(v_installation_id,v_invoice.part_no,v_invoice.description,p_quantity);

  update public.portal_installation_invoices
  set installation_id=v_installation_id,updated_at=now()
  where id=v_invoice.id;

  return v_installation_id;
end $$;

grant select on public.portal_installation_invoices to authenticated;
grant execute on function public.portal_create_installation_invoice(date,text,text,text,text,text,text,text,text,text,bigint) to authenticated;
grant execute on function public.portal_create_installation_from_invoice(uuid,text,text,numeric) to authenticated;
