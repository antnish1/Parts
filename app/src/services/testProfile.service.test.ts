import { beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  rows: [] as Array<{
    id: string; full_name: string; branch: string; role: string;
    legacy_user_id: string; is_active: boolean; created_at: string;
  }>,
  ranges: [] as Array<[number, number]>,
  requestError: null as Error | null,
}));

vi.mock('../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      if (table !== 'portal_profiles') throw new Error(`Unexpected table: ${table}`);
      return {
        select: (_columns: string) => {
          const query = {
            order: (_field: string, _options: { ascending: boolean }) => query,
            range: async (start: number, end: number) => {
              mock.ranges.push([start, end]);
              if (mock.requestError) return { data: null, error: mock.requestError };
              return { data: mock.rows.slice(start, end + 1).map((row) => ({
                id: row.id, full_name: row.full_name, branch: row.branch, role: row.role,
                login_id: row.legacy_user_id, is_active: row.is_active,
                created_at: row.created_at,
              })), error: null };
            },
          };
          return query;
        },
      };
    },
  },
}));

import { getTestProfiles } from './testProfile.service';

describe('developer full user profile listing', () => {
  beforeEach(() => {
    mock.ranges.length = 0;
    mock.requestError = null;
    mock.rows = Array.from({ length: 223 }, (_, index) => ({
      id: `id-${index}`, full_name: `Employee ${index}`, branch: 'JABALPUR_PARTS',
      role: index % 2 ? 'viewer' : 'branch', legacy_user_id: `USER${index}`,
      is_active: true, created_at: '2026-10-16T00:00:00Z',
    }));
  });

  it('fetches every user across multiple safe server-side batches, not just 12 or 50', async () => {
    const users = await getTestProfiles();
    expect(users).toHaveLength(223);
    expect(users[0].login_id).toBe('USER0');
    expect(users[222].login_id).toBe('USER222');
    expect(mock.ranges).toEqual([[0, 199], [200, 399]]);
  });

  it('loads fewer than 200 users in a single request', async () => {
    mock.rows = mock.rows.slice(0, 23);
    const users = await getTestProfiles();
    expect(users).toHaveLength(23);
    expect(mock.ranges).toEqual([[0, 199]]);
  });

  it('surfaces query failures instead of silently displaying an incomplete list', async () => {
    mock.requestError = new Error('Profile listing failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      await expect(getTestProfiles()).rejects.toThrow('Profile listing failed');
      expect(mock.ranges).toEqual([[0, 199]]);
    } finally {
      log.mockRestore();
    }
  });
});
