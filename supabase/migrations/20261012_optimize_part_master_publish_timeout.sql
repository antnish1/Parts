-- Optimization only: no production rows are modified by installing this migration.
-- Existing normalized keys were verified populated and identical to normalized PartNo.
-- The atomic publish, permissions, safety checks and history insertion are preserved.
create or replace function public.portal_publish_part_master_upload(p_upload_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid := public.portal_price_master_actor();
  v_owner uuid;
  v_status text;
  v_month date;
  v_valid integer;
  v_staged integer;
  v_current integer;
  v_published_at timestamptz := now();
begin
  select uploaded_by, status, price_list_month, valid_rows into v_owner, v_status, v_month, v_valid
  from public.portal_part_master_uploads where id=p_upload_id for update;
  if v_owner is null then raise exception 'Price-list upload session not found'; end if;
  if v_owner <> v_profile_id then raise exception 'This upload session belongs to another user'; end if;
  if v_status <> 'previewed' then raise exception 'Preview the price list before publishing'; end if;

  select count(*) into v_staged from public.portal_part_master_staging where upload_id=p_upload_id;
  if v_staged <> v_valid or v_staged <= 0 then raise exception 'Staged rows are incomplete; publication cancelled'; end if;

  -- Readers keep AccessShare locks; this lock blocks competing writes without taking the portal offline.
  lock table public.part_master in share row exclusive mode;

  -- Remove legacy duplicates by normalized key before synchronizing the new complete snapshot.
  delete from public.part_master p
  using (
    select ctid, row_number() over (partition by "PartNoNormalized" order by ctid) rn
    from public.part_master where coalesce(trim("PartNo"),'') <> ''
  ) d
  where p.ctid=d.ctid and d.rn>1;

  update public.part_master p set
    "PartNo"=s.part_no,
    "PartNoNormalized"=s.part_no_normalized,
    "Description"=s.description,
    "DNP"=s.dnp,
    "RTL"=s.rtl,
    "MRP"=s.mrp,
    "HSN"=s.hsn,
    "GST"=s.gst,
    "Cat1"=s.cat1,
    "Cat2"=s.cat2
  from public.portal_part_master_staging s
  where s.upload_id=p_upload_id
    and p."PartNoNormalized" = s.part_no_normalized
    and (p."PartNo", p."Description", p."DNP", p."RTL", p."MRP", p."HSN", p."GST", p."Cat1", p."Cat2")
        is distinct from
        (s.part_no, s.description, s.dnp, s.rtl, s.mrp, s.hsn, s.gst, s.cat1, s.cat2);

  insert into public.part_master ("PartNo","PartNoNormalized","Description","DNP","RTL","MRP","HSN","GST","Cat1","Cat2")
  select s.part_no,s.part_no_normalized,s.description,s.dnp,s.rtl,s.mrp,s.hsn,s.gst,s.cat1,s.cat2
  from public.portal_part_master_staging s
  where s.upload_id=p_upload_id
    and not exists (select 1 from public.part_master p where p."PartNoNormalized"=s.part_no_normalized);

  delete from public.part_master p
  where p."PartNoNormalized" <> ''
    and not exists (
      select 1 from public.portal_part_master_staging s
      where s.upload_id=p_upload_id and s.part_no_normalized=p."PartNoNormalized"
    );

  delete from public.portal_part_master_history where upload_id=p_upload_id;
  insert into public.portal_part_master_history (upload_id,price_list_month,part_no,part_no_normalized,description,dnp,rtl,mrp,hsn,gst,cat1,cat2,published_at)
  select p_upload_id,v_month,s.part_no,s.part_no_normalized,s.description,s.dnp,s.rtl,s.mrp,s.hsn,s.gst,s.cat1,s.cat2,v_published_at
  from public.portal_part_master_staging s where s.upload_id=p_upload_id;

  select count(*) into v_current from public.part_master;
  update public.portal_part_master_uploads set status='published', published_by=v_profile_id, published_at=v_published_at where id=p_upload_id;
  return jsonb_build_object('ok',true,'uploadId',p_upload_id,'activeParts',v_current,'publishedAt',v_published_at);
exception when others then
  update public.portal_part_master_uploads set last_error=sqlerrm where id=p_upload_id;
  raise;
end;
$$;


-- Applies only to the admin/developer publication RPC, not a database-wide or role-wide timeout.
ALTER FUNCTION public.portal_publish_part_master_upload(uuid) SET statement_timeout = '10min';
