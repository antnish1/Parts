-- Correct Engine & Breaker Invoice -> Registration handoff.
-- Separates DBMS No. from DBMS Invoice No., carries the JCB invoice number/document
-- into the registration record, and backfills already-linked invoice registrations.

alter table public.portal_installation_entries
  add column if not exists dbms_no text,
  add column if not exists dbms_invoice_no text;

-- Backfill registrations already created from Invoice intake.
update public.portal_installation_entries e
set jcb_invoice_no = coalesce(nullif(trim(e.jcb_invoice_no), ''), i.jcb_invoice_no),
    dbms_no = coalesce(nullif(trim(e.dbms_no), ''), i.dbms_no),
    invoice_no = i.jcb_invoice_no,
    updated_at = now()
from public.portal_installation_invoices i
where i.installation_id = e.id
  and nullif(trim(i.jcb_invoice_no), '') is not null;

-- Reuse the JCB invoice file already uploaded during Invoice intake.
insert into public.portal_installation_documents(
  installation_id,
  document_type,
  storage_path,
  file_name,
  mime_type,
  file_size,
  uploaded_by,
  is_active
)
select
  i.installation_id,
  'JCB_INVOICE',
  i.document_path,
  i.document_name,
  i.document_mime_type,
  i.document_size,
  i.created_by,
  true
from public.portal_installation_invoices i
where i.installation_id is not null
  and not exists (
    select 1
    from public.portal_installation_documents d
    where d.installation_id = i.installation_id
      and d.document_type = 'JCB_INVOICE'
      and d.is_active
  );

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
    entry_no,
    equipment_type,
    invoice_date,
    branch,
    invoice_no,
    customer_name,
    jcb_invoice_no,
    dbms_no,
    created_by
  ) values (
    v_entry_no,
    v_invoice.equipment_type,
    v_invoice.invoice_date,
    trim(p_branch),
    v_invoice.jcb_invoice_no,
    trim(p_customer_name),
    v_invoice.jcb_invoice_no,
    v_invoice.dbms_no,
    v_profile.id
  ) returning id into v_installation_id;

  insert into public.portal_installation_items(installation_id,part_no,description,quantity)
  values(v_installation_id,v_invoice.part_no,v_invoice.description,p_quantity);

  insert into public.portal_installation_documents(
    installation_id,
    document_type,
    storage_path,
    file_name,
    mime_type,
    file_size,
    uploaded_by,
    is_active
  ) values (
    v_installation_id,
    'JCB_INVOICE',
    v_invoice.document_path,
    v_invoice.document_name,
    v_invoice.document_mime_type,
    v_invoice.document_size,
    coalesce(v_invoice.created_by, v_profile.id),
    true
  );

  update public.portal_installation_invoices
  set installation_id=v_installation_id,updated_at=now()
  where id=v_invoice.id;

  return v_installation_id;
end $$;

grant execute on function public.portal_create_installation_from_invoice(uuid,text,text,numeric) to authenticated;

-- Stage Two no longer asks for the JCB Invoice No. because it is inherited from Invoice intake.
-- Instead, the branch supplies the distinct DBMS Invoice No.
drop function if exists public.portal_submit_installation_entry(uuid,text,text,text);

create function public.portal_submit_installation_entry(
  p_installation_id uuid,
  p_equipment_no text,
  p_dbms_invoice_no text,
  p_svr_no text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.portal_profiles;
  v_entry public.portal_installation_entries;
  v_docs int;
  v_is_assigned_branch boolean;
begin
  select * into v_profile
  from public.portal_profiles
  where auth_user_id=auth.uid() and coalesce(is_active,true)
  limit 1;

  select * into v_entry
  from public.portal_installation_entries
  where id=p_installation_id
  for update;

  if v_profile.id is null then raise exception 'Active profile not found'; end if;
  if v_entry.id is null or v_entry.status<>'PENDING' then raise exception 'Entry is not pending'; end if;

  v_is_assigned_branch := upper(replace(coalesce(v_profile.branch,''),' ','_')) = upper(replace(coalesce(v_entry.branch,''),' ','_'));
  if not v_is_assigned_branch and not public.portal_can_manage_installations() then
    raise exception 'Entry belongs to another branch';
  end if;

  if nullif(trim(p_equipment_no),'') is null then raise exception 'Equipment No. is required'; end if;
  if nullif(trim(v_entry.jcb_invoice_no),'') is null then raise exception 'JCB Invoice No. is missing from Invoice intake'; end if;
  if nullif(trim(p_dbms_invoice_no),'') is null then raise exception 'DBMS Invoice No. is required'; end if;
  if nullif(trim(p_svr_no),'') is null then raise exception 'SVR No. is required'; end if;

  select count(distinct document_type) into v_docs
  from public.portal_installation_documents
  where installation_id=p_installation_id
    and is_active
    and document_type in ('JCB_INVOICE','DBMS_INVOICE','SVR');

  if v_docs<3 then raise exception 'JCB Invoice, DBMS Invoice and SVR uploads are required'; end if;

  update public.portal_installation_entries
  set status='ACCEPTANCE_PENDING',
      equipment_no=upper(trim(p_equipment_no)),
      dbms_invoice_no=upper(trim(p_dbms_invoice_no)),
      svr_no=upper(trim(p_svr_no)),
      branch_submitted_by=v_profile.id,
      branch_submitted_at=now(),
      updated_at=now()
  where id=p_installation_id;
end
$$;

grant execute on function public.portal_submit_installation_entry(uuid,text,text,text) to authenticated;
