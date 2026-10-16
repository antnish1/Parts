import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Both remote SQL RPCs must use the exact same legacy dispatch/ageing rules.
const migration = readFileSync(
  new URL('../../../supabase/migrations/20261016_in_transit_legacy_dispatch_age_guard.sql', import.meta.url),
  'utf8',
);
const reconciliation = readFileSync(
  new URL('../../../supabase/reconciliations/20261016_verified_legacy_receipts_1650644138.sql', import.meta.url),
  'utf8',
);

describe('legacy in-transit dispatch-age guard', () => {
  const details = migration.split('CREATE OR REPLACE FUNCTION public.portal_get_in_transit_details')[1]?.split('CREATE OR REPLACE FUNCTION public.portal_get_in_transit_qty')[0] ?? '';
  const quantity = migration.split('CREATE OR REPLACE FUNCTION public.portal_get_in_transit_qty')[1] ?? '';
  for (const [name, body] of [['detail popup', details], ['quantity KPI', quantity]] as const) {
    it(`${name}: respects explicit per-item legacy dispatch evidence`, () => {
      expect(body).toContain("i.dispatch_status_legacy");
      expect(body).toContain("when item_status = 'PROCESSED' and legacy_dispatch_status in ('DISPATCHED', 'PARTIALLY DISPATCHED')");
      expect(body).toContain("'PARTIALLY RECEIVED'");
      expect(body).toContain("or legacy_dispatch_status in ('DISPATCHED', 'PARTIALLY DISPATCHED')");
    });
    it(`${name}: uses actual historical bill dates and excludes expired transit`, () => {
      expect(body).toContain("effective_billing_date >= current_date - 14");
      expect(body).toContain("effective_billing_date <= current_date");
      expect(body).toContain("date '1899-12-30'");
      expect(body).toContain("'DD.MM.YYYY'");
      expect(body).toContain("coalesce(b.billing_date");
    });
  }

  it('preserves physical-receipt audit and partial-billed quantity boundaries', () => {
    expect(reconciliation).toContain("IF (SELECT count(*) FROM legacy_confirmed_rows WHERE new_status='RECEIVED')<>32");
    expect(reconciliation).toContain("IF v_receipt_count<>37");
    expect(reconciliation).toContain("WHEN b.billed_qty >= greatest(coalesce(i.edited_qty,i.qty,0),0) THEN 'RECEIVED'");
    expect(reconciliation).toContain("ELSE 'PARTIALLY_RECEIVED'");
    expect(reconciliation).toContain("backend administrative reconciliation");
    expect(reconciliation).toContain("original_invoice_ref");
  });
});
