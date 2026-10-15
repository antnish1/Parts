import { describe, expect, it } from 'vitest';
import { getOrderStatusLabel, getResolvedRowStatus, getPrintableStatusLabel } from './orderLogic';

describe('part-level issue status resolution', () => {
  const received = {
    row_status: 'RECEIVED',
    qty: 2,
    billed_qty: 2,
    billing_chunks: [{ billed_qty: 2, received_qty: 2, received_at: '2026-10-01' }],
  };
  const issued = {
    row_status: 'ISSUED',
    qty: 3,
    billed_qty: 3,
    billing_chunks: [{ billed_qty: 3, received_qty: 3, received_at: '2026-10-01' }],
  };

  it('never reclassifies an issued part as received because of receipt billing', () => {
    expect(getResolvedRowStatus(issued)).toBe('ISSUED');
  });

  it('keeps an order partly issued until all item rows are issued', () => {
    expect(getOrderStatusLabel([issued, received])).toBe('PARTIALLY ISSUED');
    expect(getOrderStatusLabel([issued, { ...issued, qty: 1 }])).toBe('ISSUED');
    expect(getOrderStatusLabel([received, received])).toBe('RECEIVED');
  });

  it('renders a professional partial issue label', () => {
    expect(getPrintableStatusLabel('partially_issued')).toBe('Partially Issued');
  });
});
