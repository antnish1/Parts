const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/features/tracking/PendingIssueOrdersPage.tsx');
let source = fs.readFileSync(filePath, 'utf8');

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`${label} marker not found`);
  source = source.replace(from, to);
}

replaceOnce(
  `type AgeFilter = 'all' | '0-2' | '3-7' | 'over-7';`,
  `type AgeFilter = 'all' | '0-2' | '3-7' | 'over-7';\nconst PAGE_SIZE = 15;`,
  'page size',
);

replaceOnce(
  `  const branch = params.get('branch') ?? 'all';`,
  `  const branch = params.get('branch') ?? 'all';\n  const requestedPage = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);`,
  'requested page',
);

replaceOnce(
  `  }, [age, branch, orders, search, type]);\n\n  const totals = useMemo(() => {`,
  `  }, [age, branch, orders, search, type]);\n\n  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));\n  const currentPage = Math.min(requestedPage, totalPages);\n  const paginated = useMemo(\n    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),\n    [currentPage, filtered],\n  );\n\n  const totals = useMemo(() => {`,
  'pagination calculation',
);

replaceOnce(
  `    if (!value || value === 'all') next.delete(key); else next.set(key, value);\n    setParams(next, { replace: true });`,
  `    if (!value || value === 'all' || (key === 'page' && value === '1')) next.delete(key); else next.set(key, value);\n    if (key !== 'page') next.delete('page');\n    setParams(next, { replace: true });`,
  'page reset on filter changes',
);

replaceOnce(
  `<tbody>{filtered.map((order) =>`,
  `<tbody>{paginated.map((order) =>`,
  'paginated rows',
);

replaceOnce(
  `        </div>\n        {!query.isLoading && filtered.length === 0 ? <div className="p-10 text-center text-sm text-[#64748b]">No orders are pending to be marked as issued.</div> : null}`,
  `        </div>\n        {!query.isLoading && filtered.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#d8e0ea] bg-[#f8fafc] px-3 py-2 text-xs text-[#475569]">\n          <span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} orders</span>\n          <div className="flex items-center gap-2">\n            <button type="button" disabled={currentPage <= 1} onClick={() => updateParam('page', String(currentPage - 1))} className="h-8 rounded-md border border-[#cbd5e1] bg-white px-3 font-semibold text-[#334155] disabled:cursor-not-allowed disabled:opacity-40">Previous</button>\n            <span className="min-w-[76px] text-center font-semibold text-[#334155]">Page {currentPage} of {totalPages}</span>\n            <button type="button" disabled={currentPage >= totalPages} onClick={() => updateParam('page', String(currentPage + 1))} className="h-8 rounded-md border border-[#cbd5e1] bg-white px-3 font-semibold text-[#334155] disabled:cursor-not-allowed disabled:opacity-40">Next</button>\n          </div>\n        </div> : null}\n        {!query.isLoading && filtered.length === 0 ? <div className="p-10 text-center text-sm text-[#64748b]">No orders are pending to be marked as issued.</div> : null}`,
  'pagination controls',
);

fs.writeFileSync(filePath, source);
console.log('Pending Issue pagination applied.');
