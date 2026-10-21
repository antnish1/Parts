-- Replace inventory upload RPC so inventory rows use canonical branch_key.
-- This is required because inventory Branch_Code DFM003 is shared by multiple Jabalpur branches.

create or replace function public.portal_upload_inventory(
  p_report_date date,
  p_filename text,
  p_rows jsonb,
  p_total_rows int default null,
  p_failed_rows int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_role text;
  v_upload_id uuid;
  v_batch_id uuid := gen_random_uuid();
  v_valid_rows int := 0;
  v_skipped_rows int := 0;
  v_rows jsonb := '[]'::jsonb;
  v_changed_rows int := 0;
  v_unmapped_count int := 0;
begin
  select id, role into v_profile_id, v_role
  from public.portal_profiles
  where auth_user_id = auth.uid()
    and coalesce(is_active, false) = true
  limit 1;

  if v_profile_id is null or v_role not in ('admin', 'manager', 'developer', 'super') then
    raise exception 'Only active admin, manager, developer, or super users can upload inventory';
  end if;

  if p_report_date is null then
    raise exception 'Report date is required';
  end if;

  -- Only allow codes explicitly assigned to active inventory branches.
  -- DFM0033 is Damoh, regardless of the legacy office label in the spreadsheet.
  -- DFM003 is shared, so its resolved office must match the code's branch master.
  with source_rows as (
    select r.value, r.ordinality,
      upper(trim(r.value->>'branch_code')) as code,
      case
        when upper(trim(r.value->>'branch_code')) = 'DFM0033' then 'DAMOH'
        else public.resolve_portal_branch(nullif(trim(r.value->>'branch_name'), ''))
      end as branch_key
    from jsonb_array_elements(p_rows) with ordinality r(value, ordinality)
  ), eligible as (
    select s.value, s.ordinality,
      case when s.code = 'DFM0033'
        then jsonb_set(s.value, '{branch_name}', to_jsonb('DAMOH'::text), true)
        else s.value end as normalized_value
    from source_rows s
    join public.portal_branches b
      on b.branch_key = s.branch_key
     and b.is_active = true
     and b.inventory_branch_code = s.code
  )
  select coalesce(jsonb_agg(normalized_value order by ordinality), '[]'::jsonb)
  into v_rows
  from eligible;

  v_valid_rows := jsonb_array_length(v_rows);
  v_skipped_rows := jsonb_array_length(p_rows) - v_valid_rows;

  if v_valid_rows = 0 then
    raise exception 'No inventory rows matched active branch codes. % row(s) excluded.', v_skipped_rows;
  end if;

  insert into public.portal_inventory_uploads (uploaded_by, report_date, filename, total_rows, valid_rows, failed_rows, status)
  values (v_profile_id, p_report_date, p_filename, coalesce(p_total_rows, v_valid_rows), v_valid_rows, coalesce(p_failed_rows, 0) + v_skipped_rows, 'completed')
  returning id into v_upload_id;

  insert into public.portal_inventory_staging (
    upload_id, upload_batch_id, branch_key, report_date, branch_code, branch_name, item_code, item_name, item_group, uom, dnp,
    opening_balance, opening_value, received_qty, issued_qty, closing_balance, closing_value, source_filename
  )
  select
    v_upload_id,
    v_batch_id,
    coalesce(public.resolve_portal_branch(nullif(trim(r.value->>'branch_name'), '')), public.resolve_portal_branch(upper(trim(r.value->>'branch_code')))),
    p_report_date,
    upper(trim(r.value->>'branch_code')),
    nullif(trim(r.value->>'branch_name'), ''),
    upper(replace(trim(r.value->>'item_code'), ' ', '')),
    nullif(trim(r.value->>'item_name'), ''),
    nullif(trim(r.value->>'item_group'), ''),
    nullif(trim(r.value->>'uom'), ''),
    coalesce(nullif(r.value->>'dnp', '')::numeric, 0),
    coalesce(nullif(r.value->>'opening_balance', '')::numeric, 0),
    nullif(r.value->>'opening_value', '')::numeric,
    coalesce(nullif(r.value->>'received_qty', '')::numeric, 0),
    coalesce(nullif(r.value->>'issued_qty', '')::numeric, 0),
    coalesce(nullif(coalesce(r.value->>'closing_balance', r.value->>'qty'), '')::numeric, 0),
    nullif(coalesce(r.value->>'closing_value', r.value->>'inv_value'), '')::numeric,
    p_filename
  from jsonb_array_elements(v_rows) as r(value);

  with raw_rows as (
    select
      r.ordinality,
      coalesce(public.resolve_portal_branch(nullif(trim(r.value->>'branch_name'), '')), public.resolve_portal_branch(upper(trim(r.value->>'branch_code')))) as branch_key,
      p_report_date as report_date,
      upper(trim(r.value->>'branch_code')) as branch_code,
      nullif(trim(r.value->>'branch_name'), '') as branch_name,
      upper(replace(trim(r.value->>'item_code'), ' ', '')) as item_code,
      nullif(trim(r.value->>'item_name'), '') as item_name,
      nullif(trim(r.value->>'item_group'), '') as item_group,
      nullif(trim(r.value->>'uom'), '') as uom,
      coalesce(nullif(r.value->>'dnp', '')::numeric, 0) as dnp,
      coalesce(nullif(coalesce(r.value->>'closing_balance', r.value->>'qty'), '')::numeric, 0) as qty,
      nullif(coalesce(r.value->>'closing_value', r.value->>'inv_value'), '')::numeric as inv_value
    from jsonb_array_elements(v_rows) with ordinality as r(value, ordinality)
  ), current_rows as (
    select distinct on (branch_key, item_code) *
    from raw_rows
    where branch_key is not null and item_code <> ''
    order by branch_key, item_code, ordinality desc
  ), change_rows as (
    select
      v_upload_id as upload_id,
      c.report_date,
      c.branch_key,
      c.branch_code,
      c.branch_name,
      c.item_code,
      c.item_name,
      e.qty as old_qty,
      c.qty as new_qty,
      e.inv_value as old_value,
      c.inv_value as new_value,
      case when e.id is null then 'new' else 'updated' end as change_type,
      p_filename as source_filename
    from current_rows c
    left join public.portal_inventory_current e
      on e.branch_key = c.branch_key
     and e.item_code = c.item_code
    where e.id is null
       or coalesce(e.qty, 0) <> coalesce(c.qty, 0)
       or coalesce(e.inv_value, 0) <> coalesce(c.inv_value, 0)
  )
  insert into public.portal_inventory_changes (upload_id, report_date, branch_key, branch_code, branch_name, item_code, item_name, old_qty, new_qty, old_value, new_value, change_type, source_filename)
  select upload_id, report_date, branch_key, branch_code, branch_name, item_code, item_name, old_qty, new_qty, old_value, new_value, change_type, source_filename
  from change_rows;

  get diagnostics v_changed_rows = row_count;

  with raw_rows as (
    select
      r.ordinality,
      coalesce(public.resolve_portal_branch(nullif(trim(r.value->>'branch_name'), '')), public.resolve_portal_branch(upper(trim(r.value->>'branch_code')))) as branch_key,
      p_report_date as report_date,
      upper(trim(r.value->>'branch_code')) as branch_code,
      nullif(trim(r.value->>'branch_name'), '') as branch_name,
      upper(replace(trim(r.value->>'item_code'), ' ', '')) as item_code,
      nullif(trim(r.value->>'item_name'), '') as item_name,
      nullif(trim(r.value->>'item_group'), '') as item_group,
      nullif(trim(r.value->>'uom'), '') as uom,
      coalesce(nullif(r.value->>'dnp', '')::numeric, 0) as dnp,
      coalesce(nullif(coalesce(r.value->>'closing_balance', r.value->>'qty'), '')::numeric, 0) as qty,
      nullif(coalesce(r.value->>'closing_value', r.value->>'inv_value'), '')::numeric as inv_value,
      now() as updated_at
    from jsonb_array_elements(v_rows) with ordinality as r(value, ordinality)
  ), current_rows as (
    select distinct on (branch_key, item_code) branch_key, report_date, branch_code, branch_name, item_code, item_name, item_group, uom, dnp, qty, inv_value, updated_at
    from raw_rows
    where branch_key is not null and item_code <> ''
    order by branch_key, item_code, ordinality desc
  )
  insert into public.portal_inventory_current (branch_key, report_date, branch_code, branch_name, item_code, item_name, item_group, uom, dnp, qty, inv_value, updated_at)
  select branch_key, report_date, branch_code, branch_name, item_code, item_name, item_group, uom, dnp, qty, inv_value, updated_at
  from current_rows
  on conflict (branch_key, item_code) do update set
    report_date = excluded.report_date,
    branch_code = excluded.branch_code,
    branch_name = excluded.branch_name,
    item_name = excluded.item_name,
    item_group = excluded.item_group,
    uom = excluded.uom,
    dnp = excluded.dnp,
    qty = excluded.qty,
    inv_value = excluded.inv_value,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'ok', true,
    'totalRows', coalesce(p_total_rows, v_valid_rows),
    'validRows', v_valid_rows,
    'failedRows', coalesce(p_failed_rows, 0) + v_skipped_rows,
    'excludedRows', v_skipped_rows,
    'changedRows', v_changed_rows,
    'stagedRows', v_valid_rows,
    'batchId', v_batch_id,
    'uploadId', v_upload_id
  );
end;
$$;

grant execute on function public.portal_upload_inventory(date, text, jsonb, int, int) to authenticated;
