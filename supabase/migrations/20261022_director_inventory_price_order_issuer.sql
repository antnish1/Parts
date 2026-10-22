-- Extend existing Manager operational abilities to active Directors.
DO $director$
DECLARE item record; original text; patched text;
BEGIN
 FOR item IN SELECT p.oid, p.proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
 WHERE n.nspname='public' AND p.proname = ANY(ARRAY[
   'mark_portal_order_issued','mark_portal_order_items_issued',
   'portal_price_master_actor','portal_upload_inventory'
 ]) LOOP
  original := pg_get_functiondef(item.oid);
  patched := original;
  patched := replace(patched, '(''branch'', ''admin'', ''manager'', ''developer'', ''hq'')', '(''branch'', ''admin'', ''manager'', ''director'', ''developer'', ''hq'')');
  patched := replace(patched, '(''branch'',''admin'',''manager'',''developer'',''hq'')', '(''branch'',''admin'',''manager'',''director'',''developer'',''hq'')');
  patched := replace(patched, '(''admin'', ''developer'', ''manager'')', '(''admin'', ''developer'', ''manager'', ''director'')');
  patched := replace(patched, '(''admin'', ''manager'', ''developer'', ''super'')', '(''admin'', ''manager'', ''director'', ''developer'', ''super'')');
  IF patched <> original THEN EXECUTE patched; END IF;
 END LOOP;
END $director$;
-- Rollback by restoring previous function definitions.
