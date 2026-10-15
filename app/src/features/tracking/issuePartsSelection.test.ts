import { describe, expect, it } from 'vitest';
import type { PendingIssuePartExportRow } from '../../services/pendingIssue.service';
import { getEligibleIssueParts, toggleSelectAllIssueParts } from './issuePartsSelection';

function item(itemId: string, itemStatus: string, effectiveQty: number, receivedQty: number, issuedAt: string | null = null): PendingIssuePartExportRow {
  return {
    order_id: 'order-a',
    item_id: itemId,
    part_no: '12345',
    description: null,
    original_qty: effectiveQty,
    edited_qty: null,
    effective_qty: effectiveQty,
    item_value: 100,
    edited_value: null,
    effective_value: 100,
    billed_qty: receivedQty,
    received_qty: receivedQty,
    item_status: itemStatus,
    issued_document_type: null,
    issued_document_no: null,
    issued_at: issuedAt,
  };
}

describe('shared part-wise issue dialog selection', () => {
  const parts = [
    item('received-1', 'RECEIVED', 2, 2),
    item('issued-1', 'ISSUED', 3, 3),
    item('received-2', 'RECEIVED', 4, 5), // Historical excess is still fully received
    item('partial-1', 'PARTIALLY RECEIVED', 2, 1),
    item('short-1', 'RECEIVED', 3, 2),
    item('zero-1', 'RECEIVED', 0, 0),
    item('dated-1', 'RECEIVED', 1, 1, '2026-10-15T12:00:00Z'),
  ];

  it('selects only fully received, positive-quantity lines that were not issued', () => {
    expect(getEligibleIssueParts(parts).map((p) => p.item_id)).toEqual(['received-1', 'received-2']);
  });

  it('Select All selects every eligible ID, never issued or short lines', () => {
    const ids = getEligibleIssueParts(parts).map((p) => p.item_id);
    expect(toggleSelectAllIssueParts(ids, true)).toEqual(['received-1', 'received-2']);
  });

  it('unchecking Select All clears all selected IDs', () => {
    expect(toggleSelectAllIssueParts(['received-1', 'received-2'], false)).toEqual([]);
  });

  it('does not select anything if no eligible items exist', () => {
    expect(toggleSelectAllIssueParts([], true)).toEqual([]);
  });
});
