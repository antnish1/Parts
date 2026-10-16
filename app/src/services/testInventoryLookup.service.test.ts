import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  branchScope: ['JABALPUR_BHL', 'JABALPUR_HL', 'JABALPUR_PARTS', 'WARRANTY'],
  rows: [
    { branch_key: 'JABALPUR_PARTS', item_code: '400/23424', report_date: '2026-10-15', qty: 3 },
    { branch_key: 'JABALPUR_PARTS', item_code: '400/23424', report_date: '2026-07-31', qty: 5 },
    { branch_key: null, item_code: '400/23424', report_date: '2026-06-25', qty: 8 },
    { branch_key: 'JABALPUR_PARTS', item_code: '402/N3956', report_date: '2026-10-15', qty: 1 },
    { branch_key: 'DAMOH', item_code: '400/23424', report_date: '2026-06-25', qty: 2 },
  ],
  queries: [] as Array<{ filters: string[]; fields: string }>,
}));

vi.mock('./branchCalculation.service', () => ({
  getBranchCalculationScope: async () => mock.branchScope,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from(table: string) {
      if (table !== 'portal_inventory_current') throw new Error('Unexpected inventory table');
      return {
        select(fields: string) {
          const filters: Array<(row: Record<string, unknown>) => boolean> = [];
          const queryNotes: string[] = [];
          let descending = false;
          let limit = Infinity;
          function filtered() {
            return mock.rows.filter((row) => filters.every((filter) => filter(row)))
              .sort((a, b) => descending ? b.report_date.localeCompare(a.report_date) : 0)
              .slice(0, limit)
              .map((row) => Object.fromEntries(fields.split(',').map((column) => [column.trim(), row[column.trim() as keyof typeof row]])));
          }
          const chain = {
            in(column: string, values: string[]) {
              queryNotes.push(`in:${column}`);
              filters.push((row: Record<string, unknown>) => values.includes(String(row[column] ?? '')));
              return chain;
            },
            eq(column: string, value: string) {
              queryNotes.push(`eq:${column}:${value}`);
              filters.push((row: Record<string, unknown>) => row[column] === value);
              return chain;
            },
            order(_field: string, options: { ascending: boolean }) {
              descending = !options.ascending;
              return chain;
            },
            limit(n: number) { limit = n; return chain; },
            async maybeSingle() {
              mock.queries.push({ fields, filters: [...queryNotes] });
              return { data: filtered()[0] ?? null, error: null };
            },
            then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => unknown) {
              mock.queries.push({ fields, filters: [...queryNotes] });
              return Promise.resolve({ data: filtered(), error: null }).then(resolve);
            },
          };
          return chain;
        },
      };
    },
  },
}));

import {
  formatInventoryReportDate,
  getCurrentInventoryByBranchParts,
  getInventoryQtyByBranchParts,
} from './testInventoryLookup.service';

describe('latest uploaded branch inventory snapshot', () => {
  beforeEach(() => {
    mock.branchScope = ['JABALPUR_BHL', 'JABALPUR_HL', 'JABALPUR_PARTS', 'WARRANTY'];
    mock.queries.length = 0;
  });

  it('never adds July stock or old shared-code inventory to October stock', async () => {
    const snapshot = await getCurrentInventoryByBranchParts('JABALPUR BHL', ['400/23424']);
    expect(snapshot).toEqual({ reportDate: '2026-10-15', quantities: { '400/23424': 3 } });
    expect(mock.queries[1].filters).toContain('eq:report_date:2026-10-15');
    expect(mock.queries[1].filters).toContain('in:branch_key');
  });

  it('does not use an older part row when it is missing from latest report', async () => {
    const snapshot = await getCurrentInventoryByBranchParts('JABALPUR_PARTS', ['OLD/PART']);
    expect(snapshot).toEqual({ reportDate: '2026-10-15', quantities: {} });
  });

  it('shows an older date when that is genuinely the most recent branch report', async () => {
    mock.branchScope = ['DAMOH'];
    const snapshot = await getCurrentInventoryByBranchParts('DAMOH', ['400/23424']);
    expect(snapshot).toEqual({ reportDate: '2026-06-25', quantities: { '400/23424': 2 } });
  });

  it('preserves existing quantity-only consumers', async () => {
    const inventory = await getInventoryQtyByBranchParts('JABALPUR_PARTS', ['402/N3956']);
    expect(inventory).toEqual({ '402/N3956': 1 });
  });

  it('formats the actual upload date, not the current date', () => {
    expect(formatInventoryReportDate('2026-10-15')).toBe('15/10/26');
    expect(formatInventoryReportDate('2026-06-25')).toBe('25/06/26');
    expect(formatInventoryReportDate(null)).toBe('—');
  });
});
