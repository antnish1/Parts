-- Add Director alongside existing authorized operational roles in selected RPC checks.
-- Preserves existing stage transitions, audit events, and all other roles.
DO $director$
DECLARE
  item record;
  definition text;
  changed text;
BEGIN
  FOR item IN
    SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname = ANY(ARRAY[
      'portal_can_access_credit_dispatch',
      'portal_can_write_credit_dispatch_child',
      'portal_is_credit_dispatch_privileged',
      'portal_can_manage_installations',
      'portal_can_view_tada_branch',
      'portal_create_tada_dispatch',
      'portal_receive_tada_dispatch',
      'portal_receive_missing_tada_svr',
      'portal_review_credit_dispatch',
      'portal_credit_dispatch_guard_approval_transition'
    ])
  LOOP
    definition := pg_get_functiondef(item.oid);
    changed := definition;
    changed := replace(changed, '(''accounts'',''manager'',''admin'',''developer'',''super'')', '(''accounts'',''manager'',''director'',''admin'',''developer'',''super'')');
    changed := replace(changed, '(''accounts'', ''manager'', ''admin'', ''developer'', ''super'')', '(''accounts'', ''manager'', ''director'', ''admin'', ''developer'', ''super'')');
    changed := replace(changed, '(''admin'',''manager'',''developer'',''hq'')', '(''admin'',''manager'',''director'',''developer'',''hq'')');
    changed := replace(changed, '(''manager'',''developer'',''hq'',''accounts'')', '(''manager'',''director'',''developer'',''hq'',''accounts'')');
    changed := replace(changed, '(''branch'',''manager'',''developer'',''hq'')', '(''branch'',''manager'',''director'',''developer'',''hq'')');
    changed := replace(changed, '(''manager'',''developer'')', '(''manager'',''director'',''developer'')');
    changed := replace(changed, '(''manager'', ''developer'')', '(''manager'', ''director'', ''developer'')');
    changed := replace(changed, '(''accounts'',''developer'')', '(''accounts'',''director'',''developer'')');
    changed := replace(changed, '(''accounts'', ''developer'')', '(''accounts'', ''director'', ''developer'')');
    IF changed <> definition THEN
      EXECUTE changed;
    END IF;
  END LOOP;
END
$director$;

-- Rollback: restore the original function definitions from the prior schema version.
-- No order rows or business records are modified by this migration.
