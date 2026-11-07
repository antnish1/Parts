-- Permit Accounts to resolve missing-at-HQ SVRs using the existing audited actions.
-- Only the role gates change: all eligibility, custody, locking, and delete safeguards remain.
-- Fail closed if either live procedure has diverged from the reviewed implementation.
do $migration$
declare
  rec record;
  original_ddl text;
  modified_ddl text;
  old_gate text := 'v_profile.role not in (''manager'',''director'',''developer'')';
  new_gate text := 'v_profile.role not in (''manager'',''director'',''developer'',''accounts'')';
begin
  for rec in
    select p.oid,p.proname
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and p.proname in ('portal_receive_missing_tada_svr','portal_delete_missing_tada_svr')
  loop
    original_ddl := pg_get_functiondef(rec.oid);
    if position(old_gate in original_ddl)=0 then
      raise exception 'Unexpected authorization guard in %; aborting',rec.proname;
    end if;
    modified_ddl := replace(original_ddl,old_gate,new_gate);
    if rec.proname='portal_receive_missing_tada_svr' then
      if position('MISSING_HQ_SVR_RECEIVED_LATER' in original_ddl)=0
        or position('v_item.accounts_received is not null' in original_ddl)=0
        or position('v_item.current_location<>''MISSING_HQ''' in original_ddl)=0 then
        raise exception 'Missing-HQ receipt safeguards changed; aborting';
      end if;
      modified_ddl := replace(modified_ddl,
        'Only Manager or Developer can receive a missing HQ SVR',
        'Only Manager, Director, Developer or Accounts can receive a missing HQ SVR');
    elsif rec.proname='portal_delete_missing_tada_svr' then
      if position('MISSING_HQ_SVR_DELETED' in original_ddl)=0
        or position('portal_developer_override_audit' in original_ddl)=0
        or position('v_item.accounts_received is not null' in original_ddl)=0
        or position('v_item.current_location<>''MISSING_HQ''' in original_ddl)=0 then
        raise exception 'Missing-HQ deletion safeguards changed; aborting';
      end if;
      modified_ddl := replace(modified_ddl,
        'Only Manager, Director or Developer can delete a missing HQ SVR',
        'Only Manager, Director, Developer or Accounts can delete a missing HQ SVR');
    end if;
    execute modified_ddl;
  end loop;
  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in
        ('portal_receive_missing_tada_svr','portal_delete_missing_tada_svr'))<>2 then
    raise exception 'Both missing-SVR RPCs must exist';
  end if;
end $migration$;
