import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const dialogSource = readFileSync(new URL('./IssueOrderPartsDialog.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

describe('Issue Parts header contrast in the light theme', () => {
  const colors = [
    ['order', '#ffe47a'],
    ['title', '#ffffff'],
    ['subtitle', '#dce8f5'],
    ['close', '#ffffff'],
  ] as const;

  it('uses a uniquely scoped header even when global light-theme text rules apply', () => {
    expect(dialogSource).toContain('pc-issue-parts-header flex');
    expect(css).toContain("[data-theme='light-pro'] [class*='text-white']");
    expect(css).toContain("[data-theme='light-pro'] .pc-issue-parts-header {");
    expect(css).toContain('background-color: #0b1f3a !important;');
  });

  it.each(colors)('keeps %s legible against the navy header', (name, color) => {
    const cls = `pc-issue-parts-header-${name}`;
    expect(dialogSource).toContain(cls);
    const selector = `[data-theme='light-pro'] .pc-issue-parts-header .${cls} {`;
    const start = css.indexOf(selector);
    expect(start).toBeGreaterThan(-1);
    expect(css.slice(start, css.indexOf('}', start))).toContain(`color: ${color} !important;`);
  });
});
