import { describe, expect, it } from 'vitest';
import { canAccessRoute } from './roleGuards';

describe('manager inventory navigation permissions', () => {
  it('allows managers and directors to open the inventory lookup', () => {
    expect(canAccessRoute('manager', '/inventory')).toBe(true);
    expect(canAccessRoute('director', '/inventory')).toBe(true);
    expect(canAccessRoute('developer', '/inventory')).toBe(true);
  });

  it('does not grant inventory upload or other inventory routes to managers', () => {
    expect(canAccessRoute('manager', '/inventory/upload')).toBe(false);
    expect(canAccessRoute('manager', '/inventory/unexpected')).toBe(false);
    expect(canAccessRoute('manager', '/developer/workspace')).toBe(false);
    expect(canAccessRoute('developer', '/inventory/upload')).toBe(true);
  });

  it('does not give the inventory lookup to unrelated roles', () => {
    expect(canAccessRoute('branch', '/inventory')).toBe(false);
    expect(canAccessRoute('accounts', '/inventory')).toBe(false);
    expect(canAccessRoute('viewer', '/inventory')).toBe(false);
  });

  it('keeps the existing manager dashboard route available', () => {
    expect(canAccessRoute('manager', '/manager/dashboard')).toBe(true);
  });
});
