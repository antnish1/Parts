-- One-time, audited, ALL-OR-NOTHING reconciliation approved on 2026-10-16.
-- Source physical verification: order 1650644138 and its historical receipt dates.
-- 32 fully billed+duly dated rows -> RECEIVED; 5 partially billed+duly dated
-- rows -> PARTIALLY_RECEIVED, recording only billed quantities; one undated
-- dispatched row -> DISPATCHED, without inventing any receipt.
-- A different order has 1 stale PROCESSED item with already recorded full receipt;
-- align that item's status to RECEIVED (not back to DISPATCHED).
-- Preserve source legacy requests, invoice references, raw statuses, item quantities,
-- raw billing dates, original timestamps, and order headers.
-- Re-run protection: batch event check aborts before any writes.
DO $legacy_receipt_reconciliation$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_batch text := 'LEGACY-RECEIPT-DISPATCH-20261016-1650644138';
  v_target public.portal_orders%rowtype;
  v_receipt_count integer;
  v_dispatch_count integer;
  v_other_count integer;
  v_events integer;
  v_changed integer;
BEGIN
  SELECT * INTO v_target FROM public.portal_orders
  WHERE order_no = '1650644138' FOR UPDATE;
  IF v_target.id IS NULL OR lower(v_target.status)<>'partially_received'
     OR upper(coalesce(v_target.branch,''))<>'JABALPUR_PARTS' THEN
    RAISE EXCEPTION 'Target order missing or header changed; refusing reconciliation';
  END IF;

  CREATE TEMP TABLE legacy_confirmed_rows ON COMMIT DROP AS
  SELECT i.id AS item_id,i.order_id,i.part_no,i.row_status AS before_status,
    i.legacy_status AS before_legacy_status,i.dispatch_status_legacy,
    i.received_date,i.legacy_request_id,i.updated_at AS before_updated_at,
    greatest(coalesce(i.edited_qty,i.qty,0),0) AS effective_qty,
    i.billed_qty AS before_item_billed,
    i.dbms_invoice_no,i.dbms_invoice_date,
    b.id AS billing_id,b.billed_qty AS billed_qty,b.received_qty AS before_received_qty,
    b.received_at AS before_received_at,b.received_by AS before_received_by,
    b.billing_date AS before_billing_date,b.billing_date_raw,
    b.invoice_no AS billing_invoice_no,b.raw_status AS before_billing_status,
    b.updated_at AS before_billing_updated_at,
    CASE WHEN i.received_date IS NULL THEN 'DISPATCHED'
      WHEN b.billed_qty >= greatest(coalesce(i.edited_qty,i.qty,0),0) THEN 'RECEIVED'
      ELSE 'PARTIALLY_RECEIVED' END AS new_status
  FROM public.portal_order_items i
  JOIN public.portal_order_item_billings b ON b.item_id=i.id
  WHERE i.order_id=v_target.id
    AND upper(coalesce(i.row_status,''))='PROCESSED'
    AND upper(coalesce(i.dispatch_status_legacy,'')) IN ('DISPATCHED','PARTIALLY DISPATCHED');
  PERFORM 1 FROM public.portal_order_items i
    JOIN legacy_confirmed_rows t ON t.item_id=i.id FOR UPDATE OF i;
  PERFORM 1 FROM public.portal_order_item_billings b
    JOIN legacy_confirmed_rows t ON t.billing_id=b.id FOR UPDATE OF b;

  -- Per-item unique billing chunks and reliable legacy invoice/billing-date evidence.
  IF (SELECT count(*) FROM legacy_confirmed_rows)<>38
    OR (SELECT count(distinct item_id) FROM legacy_confirmed_rows)<>38
    OR (SELECT count(distinct billing_id) FROM legacy_confirmed_rows)<>38
    OR EXISTS (SELECT 1 FROM legacy_confirmed_rows
      WHERE before_received_qty<>0 OR before_received_at IS NOT NULL
         OR effective_qty<=0 OR billed_qty<=0 OR billed_qty>effective_qty
         OR dbms_invoice_no IS NULL OR billing_invoice_no IS NULL
         OR nullif(trim(billing_date_raw),'') IS NULL
         OR trim(billing_date_raw) !~ '^[0-9]{5}$'
         OR (CASE WHEN trim(billing_date_raw)~'^[0-9]{5}$' THEN trim(billing_date_raw)::int END)
             NOT BETWEEN 35000 AND 60000
         OR before_status<>'processed'
    )
  THEN RAISE EXCEPTION 'Legacy 38-line snapshot no longer matches; nothing changed'; END IF;

  IF (SELECT count(*) FROM legacy_confirmed_rows WHERE new_status='RECEIVED')<>32
    OR (SELECT count(*) FROM legacy_confirmed_rows WHERE new_status='PARTIALLY_RECEIVED')<>5
    OR (SELECT count(*) FROM legacy_confirmed_rows WHERE new_status='DISPATCHED')<>1
    OR (SELECT sum(billed_qty) FROM legacy_confirmed_rows WHERE received_date IS NOT NULL)<>1356
    OR (SELECT sum(effective_qty-billed_qty) FROM legacy_confirmed_rows WHERE new_status='PARTIALLY_RECEIVED')<>74
    OR NOT EXISTS (SELECT 1 FROM legacy_confirmed_rows
      WHERE part_no='400/23424' AND new_status='RECEIVED'
        AND effective_qty=5 AND billed_qty=5)
  THEN RAISE EXCEPTION 'Verified receipt/dispatch classification changed; refusing all writes'; END IF;

  IF EXISTS(SELECT 1 FROM public.portal_order_events e
    WHERE e.order_id=v_target.id AND e.metadata->>'batch_id'=v_batch)
  THEN RAISE EXCEPTION 'Reconciliation batch already applied'; END IF;

  -- Additional non-legacy stale processed row: already physically received in
  -- structured billing (1 of 1), order header already received. No new receipt.
  CREATE TEMP TABLE legacy_extra_received ON COMMIT DROP AS
  SELECT i.id AS item_id,i.order_id,i.row_status,i.part_no,i.qty,i.edited_qty,
    i.legacy_status,i.received_date,i.updated_at,
    o.order_no,o.status AS order_status,b.id AS billing_id,b.billed_qty,
    b.received_qty,b.received_at,b.raw_status,b.invoice_no
  FROM public.portal_orders o
  JOIN public.portal_order_items i ON i.order_id=o.id
  JOIN public.portal_order_item_billings b ON b.item_id=i.id
  WHERE o.order_no='PORTAL-1784380072066-276' AND i.part_no='320/06168'
    AND upper(coalesce(i.row_status,''))='PROCESSED'
    AND lower(o.status)='received'
    AND upper(coalesce(b.raw_status,''))='DISPATCHED'
    AND b.billed_qty=1 AND b.received_qty=1
    AND greatest(coalesce(i.edited_qty,i.qty,0),0)=1;

  IF (SELECT count(*) FROM legacy_extra_received)<>1 THEN
    RAISE EXCEPTION 'Additional confirmed received item changed; refusing all writes';
  END IF;
  PERFORM 1 FROM public.portal_orders o JOIN legacy_extra_received x ON x.order_id=o.id FOR UPDATE OF o;
  PERFORM 1 FROM public.portal_order_items i JOIN legacy_extra_received x ON x.item_id=i.id FOR UPDATE OF i;
  IF EXISTS (SELECT 1 FROM public.portal_order_events e JOIN legacy_extra_received x ON x.order_id=e.order_id
    WHERE e.metadata->>'batch_id'=v_batch)
  THEN RAISE EXCEPTION 'Additional item already reconciled'; END IF;

  -- Durable per-line snapshots BEFORE data changes. actor_id intentionally NULL.
  INSERT INTO public.portal_order_events
   (order_id,event_type,old_status,new_status,actor_id,notes,metadata)
  SELECT t.order_id,'legacy_item_receipt_dispatch_reconciled',t.before_status,t.new_status,NULL,
    'Administrative legacy part reconciliation. Physical receipt confirmed by requestor for dated billed units. '
      || 'Unbilled balances remain outstanding; undated dispatched part is not marked received.',
    jsonb_build_object(
      'batch_id',v_batch,'recorded_at',v_now,'item_id',t.item_id,'part_no',t.part_no,
      'old_item_status',t.before_status,'new_item_status',t.new_status,
      'original_legacy_status',t.before_legacy_status,
      'original_dispatch_status',t.dispatch_status_legacy,
      'original_received_date',t.received_date,
      'original_item_updated_at',t.before_updated_at,
      'original_item_billed_qty',t.before_item_billed,
      'effective_qty',t.effective_qty,'billing_id',t.billing_id,
      'original_billing_qty',t.billed_qty,'original_billing_received',t.before_received_qty,
      'original_billing_received_at',t.before_received_at,'original_billing_received_by',t.before_received_by,
      'original_billing_date',t.before_billing_date,'original_billing_date_raw',t.billing_date_raw,
      'original_billing_status',t.before_billing_status,
      'original_billing_updated_at',t.before_billing_updated_at,
      'original_invoice_ref',t.dbms_invoice_no,'billing_invoice_ref',t.billing_invoice_no,
      'legacy_request_id',t.legacy_request_id,
      'reconciled_received_qty',case when t.received_date IS NOT NULL then t.billed_qty else 0 end,
      'actual_receipt_time_source','historical_imported_received_date',
      'actor_record','backend administrative reconciliation; not an authenticated portal user'
    )
  FROM legacy_confirmed_rows t;
  GET DIAGNOSTICS v_events=ROW_COUNT;
  IF v_events<>38 THEN RAISE EXCEPTION 'Missing target audit events'; END IF;

  INSERT INTO public.portal_order_events(order_id,event_type,old_status,new_status,actor_id,notes,metadata)
  SELECT x.order_id,'legacy_item_receipt_dispatch_reconciled','processed','RECEIVED',NULL,
    'Aligned outdated part status to its already documented full structured receipt; no quantity changed.',
    jsonb_build_object('batch_id',v_batch,'recorded_at',v_now,
      'item_id',x.item_id,'part_no',x.part_no,'original_status',x.row_status,
      'original_legacy_status',x.legacy_status,'original_item_updated_at',x.updated_at,
      'original_received_date',x.received_date,'billing_id',x.billing_id,
      'billed_qty',x.billed_qty,'received_qty',x.received_qty,
      'recorded_received_at',x.received_at,'invoice_ref',x.invoice_no,
      'actor_record','backend administrative reconciliation; not an authenticated portal user')
  FROM legacy_extra_received x;
  GET DIAGNOSTICS v_other_count=ROW_COUNT;
  IF v_other_count<>1 THEN RAISE EXCEPTION 'Missing additional audit event'; END IF;

  UPDATE public.portal_order_item_billings b
    SET received_qty=t.billed_qty,
        received_at=t.received_date,
        received_by=NULL,
        billing_date=COALESCE(b.billing_date, date '1899-12-30'+trim(t.billing_date_raw)::int),
        updated_at=v_now
  FROM legacy_confirmed_rows t
  WHERE b.id=t.billing_id AND t.received_date IS NOT NULL;
  GET DIAGNOSTICS v_receipt_count=ROW_COUNT;
  IF v_receipt_count<>37 THEN RAISE EXCEPTION 'Receipt updates % != 37',v_receipt_count; END IF;

  -- Undated dispatch-only row: normalize its existing Excel billing date, NOT receipt.
  UPDATE public.portal_order_item_billings b
    SET billing_date=COALESCE(b.billing_date, date '1899-12-30'+trim(t.billing_date_raw)::int),
      updated_at=v_now
  FROM legacy_confirmed_rows t
  WHERE b.id=t.billing_id AND t.received_date IS NULL;
  GET DIAGNOSTICS v_dispatch_count=ROW_COUNT;
  IF v_dispatch_count<>1 THEN RAISE EXCEPTION 'Undated billing-date correction !=1'; END IF;

  UPDATE public.portal_order_items i
    SET row_status=t.new_status,updated_at=v_now
  FROM legacy_confirmed_rows t WHERE i.id=t.item_id;
  GET DIAGNOSTICS v_changed=ROW_COUNT;
  IF v_changed<>38 THEN RAISE EXCEPTION 'Item updates % != 38',v_changed; END IF;

  UPDATE public.portal_order_items i SET row_status='RECEIVED',updated_at=v_now
  FROM legacy_extra_received x WHERE x.item_id=i.id;
  GET DIAGNOSTICS v_changed=ROW_COUNT;
  IF v_changed<>1 THEN RAISE EXCEPTION 'Additional item update count !=1'; END IF;

  IF (SELECT count(*) FROM public.portal_order_item_billings b
      JOIN legacy_confirmed_rows t ON t.billing_id=b.id
      WHERE t.received_date IS NOT NULL AND b.received_qty=t.billed_qty
        AND b.received_at=t.received_date)<>37
    OR (SELECT count(*) FROM public.portal_order_items i
      JOIN legacy_confirmed_rows t ON t.item_id=i.id WHERE i.row_status=t.new_status)<>38
  THEN RAISE EXCEPTION 'Reconciliation final verification failed'; END IF;
  RAISE NOTICE 'Legacy reconciliation succeeded: 32 received, 5 partially received, 1 dispatched; 37 billing receipts; 1 additional already-received item corrected';
END
$legacy_receipt_reconciliation$;
