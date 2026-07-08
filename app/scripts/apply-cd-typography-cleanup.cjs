const fs = require('fs');
const path = require('path');

function patchFile(relativePath, patcher) {
  const filePath = path.join(__dirname, '..', relativePath);
  if (!fs.existsSync(filePath)) return;
  const original = fs.readFileSync(filePath, 'utf8');
  const next = patcher(original);
  if (next !== original) fs.writeFileSync(filePath, next);
}

patchFile('src/features/credit-dispatch/CreditDispatchListPage.tsx', (content) => {
  let next = content;
  next = next.replace('<h1 className="mt-1 text-xl font-black text-slate-950">Payment Recovery Tracker</h1>', '');
  next = next.replace('<p className="mt-1 text-sm font-semibold text-slate-500">Approve requests, record payments, and track pending receipts.</p>', '');
  next = next.replace('<p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit Dispatch</p>', '<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">Credit Dispatch</p>');
  next = next.replaceAll('font-black', 'font-semibold');
  next = next.replaceAll('font-bold', 'font-medium');
  next = next.replace('text-xl font-semibold text-slate-950', 'text-lg font-semibold text-slate-900');
  return next;
});

patchFile('src/features/credit-dispatch/NewCreditDispatchPage.tsx', (content) => {
  let next = content;
  next = next.replace('<h1 className="mt-1 text-2xl font-black text-slate-950">New signed credit request</h1>', '');
  next = next.replace('<p className="mt-1 text-sm font-semibold text-slate-500">Digital replacement for manual credit dispatch slip.</p>', '');
  next = next.replace('<p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit Dispatch</p>', '<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">Credit dispatch Format</p>');
  next = next.replace('<p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit dispatch Format</p>', '<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600">Credit dispatch Format</p>');
  next = next.replace('<div className="cd-amount-badge rounded-3xl bg-slate-950 px-4 py-3 text-white">', '<div className="cd-amount-badge rounded-3xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950">');
  next = next.replace('<div className="rounded-3xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950">', '<div className="cd-amount-badge rounded-3xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950">');
  next = next.replace('text-blue-200">Amount</p>', 'text-blue-600">Amount</p>');
  next = next.replaceAll('font-black', 'font-semibold');
  next = next.replaceAll('font-bold', 'font-medium');
  next = next.replace('text-2xl font-semibold text-slate-950', 'text-xl font-semibold text-slate-900');
  return next;
});

patchFile('src/features/credit-dispatch/CreditDispatchDetailPage.tsx', (content) => {
  let next = content;
  next = next.replaceAll('font-black', 'font-semibold');
  next = next.replaceAll('font-bold', 'font-medium');
  next = next.replace('text-2xl font-semibold text-slate-950', 'text-xl font-semibold text-slate-900');
  return next;
});

patchFile('src/features/credit-dispatch/RequestReportsPage.tsx', (content) => {
  let next = content;
  next = next.replace('<p className="mt-1 text-sm font-semibold text-slate-500">Branch, status, due date and overdue recovery reporting.</p>', '');
  next = next.replace('<p className="mt-1 text-sm font-semibold text-slate-500">Branch and status reporting.</p>', '');
  next = next.replaceAll('font-black', 'font-semibold');
  next = next.replaceAll('font-bold', 'font-medium');
  next = next.replace('text-xl font-semibold text-slate-950', 'text-lg font-semibold text-slate-900');
  return next;
});

patchFile('src/features/credit-dispatch/SignaturePad.tsx', (content) => content.replaceAll('font-black', 'font-semibold').replaceAll('font-bold', 'font-medium'));
