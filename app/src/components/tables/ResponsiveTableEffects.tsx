import { useEffect } from 'react';

const RESPONSIVE_TABLE_CLASS = 'responsive-card-table';
const RESPONSIVE_SHELL_CLASS = 'responsive-card-table-shell';

function getHeaderLabels(table: HTMLTableElement) {
  const headerRows = table.tHead?.rows;
  if (!headerRows?.length) return [];

  const headerRow = headerRows[headerRows.length - 1];
  return Array.from(headerRow.cells).map((cell) => cell.textContent?.trim() || 'Details');
}

function isWideTable(table: HTMLTableElement) {
  const className = table.getAttribute('class') ?? '';
  if (className.includes('min-w-')) return true;

  const shell = table.parentElement;
  return !!shell && table.scrollWidth > shell.clientWidth + 8;
}

function enhanceTable(table: HTMLTableElement) {
  if (!isWideTable(table)) return;

  const labels = getHeaderLabels(table);
  if (!labels.length) return;

  table.classList.add(RESPONSIVE_TABLE_CLASS);
  table.parentElement?.classList.add(RESPONSIVE_SHELL_CLASS);

  Array.from(table.tBodies).forEach((body) => {
    Array.from(body.rows).forEach((row) => {
      let headerIndex = 0;

      Array.from(row.cells).forEach((cell) => {
        const label = cell.colSpan > 1 ? 'Details' : labels[headerIndex] || 'Details';
        cell.dataset.mobileLabel = label;
        headerIndex += Math.max(cell.colSpan, 1);
      });
    });
  });
}

function enhanceWideTables() {
  document.querySelectorAll<HTMLTableElement>('table').forEach(enhanceTable);
}

export function ResponsiveTableEffects() {
  useEffect(() => {
    let frame = 0;

    const scheduleEnhancement = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(enhanceWideTables);
    };

    scheduleEnhancement();

    const observer = new MutationObserver(scheduleEnhancement);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', scheduleEnhancement);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleEnhancement);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
