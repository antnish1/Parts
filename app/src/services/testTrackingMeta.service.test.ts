import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  requests: [] as Array<{ table: string; columns: string; field: string; count: number }>,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => ({
        in: (field: string, ids: string[]) => {
          mock.requests.push({ table, columns, field, count: ids.length });
          const data = table === 'portal_order_items'
            ? ids.map((id) => ({
                id: `item-${id}`,
                order_id: id,
                part_no: '12345',
                description: 'Test part',
                qty: 2,
                edited_qty: null,
                dnp: 25,
                value: 50,
                edited_value: null,
                billed_qty: null,
                row_status: 'received',
                status: 'received',
                approval_status: null,
              }))
            : [];
          const promise = Promise.resolve({ data, error: null });
          return {
            eq: () => promise,
            then: promise.then.bind(promise),
          };
        },
      }),
    }),
  },
}));

import { getTestTrackingMeta } from './testTrackingMeta.service';

describe('Track Orders metadata requests', () => {
  beforeEach(() => {
    mock.requests.length = 0;
  });

  it('uses valid status column aliases and small order-id batches', async () => {
    const ids = Array.from({ length: 205 }, (_, index) => `order-${index}`);
    const meta = await getTestTrackingMeta(ids);
    const itemQueries = mock.requests.filter((query) => query.table === 'portal_order_items');

    expect(itemQueries.map((query) => query.count)).toEqual([100, 100, 5]);
    expect(itemQueries.every((query) => query.field === 'order_id')).toBe(true);
    expect(itemQueries.every((query) =>
      query.columns.includes('status:legacy_status, approval_status:legacy_approval_status'),
    )).toBe(true);
    expect(meta[ids[0]]).toMatchObject({
      totalQty: 2,
      totalValue: 50,
      resolvedStatus: 'received',
    });
    expect(Object.keys(meta)).toHaveLength(205);
  });
});
