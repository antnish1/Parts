-- 2026-11-17: Restrict missing-at-HQ Receive/Delete actions to Manager and Developer.
-- Do not modify regular Accounts receipt or other Director capabilities.
-- Fail closed on unexpected production function structure; avoid broader privilege changes.
do $migration$
declare
  rec record;
  original_ddl text;
  modified_ddl text;
  allowed_gate text := 'v_profile.role not in (''manager'',''developer'')';
  previous_gate text := 'v_profile.role not in (''manager'',''director'',''developer'',''accounts'')';
  before_accounts_gate text := 'v_profile.role not in (''manager'',''director'',''developer'')';
  updated_count integer := 0;
begin
  for rec in
    select p.oid, p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('portal_receive_missing_tada_svr','portal_delete_missing_tada_svr')
  loop
    original_ddl := pg_get_functiondef(rec.oid);
    if position('v_item.accounts_received is not null' in original_ddl)=0
       or position('v_item.current_location<>''MISSING_HQ''' in original_ddl)=0 then
      raise exception 'Missing-HQ safeguards changed in %; aborting', rec.proname;
    end if;
    if rec.proname='portal_receive_missing_tada_svr'
       and position('MISSING_HQ_SVR_RECEIVED_LATER' in original_ddl)=0 then
      raise exception 'Missing receive audit in %; aborting', rec.proname;
    end if;
    if rec.proname='portal_delete_missing_tada_svr'
       and (position('MISSING_HQ_SVR_DELETED' in original_ddl)=0
            or position('portal_developer_override_audit' in original_ddl)=0) then
      raise exception 'Missing delete audit in %; aborting', rec.proname;
    end if;

    if position(previous_gate in original_ddl)>0 then
      modified_ddl := replace(original_ddl,previous_gate,allowed_gate);
    elsif position(before_accounts_gate in original_ddl)>0 then
      modified_ddl := replace(original_ddl,before_accounts_gate,allowed_gate);
    elsif position(allowed_gate in original_ddl)>0 then
      modified_ddl := original_ddl;
    else
      raise exception 'Unexpected role guard in %; aborting',rec.proname;
    end if;

    modified_ddl := replace(modified_ddl,
      'Only Manager, Director, Developer or Accounts can receive a missing HQ SVR',
      'Only Manager or Developer can receive a missing HQ SVR');
    modified_ddl := replace(modified_ddl,
      'Only Manager, Director, Developer or Accounts can delete a missing HQ SVR',
      'Only Manager or Developer can delete a missing HQ SVR');
    modified_ddl := replace(modified_ddl,
      'Only Manager, Director or Developer can delete a missing HQ SVR',
      'Only Manager or Developer can delete a missing HQ SVR');
    if modified_ddl <> original_ddl then
      execute modified_ddl;
    end if;
    updated_count := updated_count + 1;
  end loop;
  if updated_count <> 2 then
    raise exception 'Expected 2 missing-HQ functions; found %; aborting',updated_count;
  end if;
end $migration$;
