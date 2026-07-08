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
  next = next.replace(
    '<div className="mx-auto max-w-7xl space-y-4 pb-20 xl:pb-0">',
    '<div data-cd-theme="tracker" className="cd-shell cd-tracker mx-auto max-w-7xl space-y-4 pb-20 xl:pb-0">',
  );
  next = next.replace(
    '<div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">',
    '<div className="cd-stat-card rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">',
  );
  next = next.replace(
    '<article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">',
    '<article className="cd-record-card rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">',
  );
  next = next.replace(
    '<div className="hidden overflow-x-auto rounded-3xl border border-slate-200 xl:block">',
    '<div className="cd-table-wrap hidden overflow-x-auto rounded-3xl border border-slate-200 xl:block">',
  );
  next = next.replace(
    '<div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">',
    '<div className="cd-hero flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">',
  );
  next = next.replace(
    '<div className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-3 grid gap-2 md:grid-cols-[1fr_220px]">',
    '<div className="cd-panel rounded-3xl border border-slate-200 bg-white p-3 shadow-sm"><div className="mb-3 grid gap-2 md:grid-cols-[1fr_220px]">',
  );
  return next;
});

patchFile('src/features/credit-dispatch/NewCreditDispatchPage.tsx', (content) => {
  let next = content;
  next = next.replace(
    '<div className="mx-auto max-w-4xl pb-24">',
    '<div data-cd-theme="request" className="cd-shell cd-request mx-auto max-w-4xl pb-24">',
  );
  next = next.replace(
    '<div className="mx-auto max-w-4xl pb-[11rem] xl:pb-24">',
    '<div data-cd-theme="request" className="cd-shell cd-request mx-auto max-w-4xl pb-[11rem] xl:pb-24">',
  );
  next = next.replace(
    '<section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">',
    '<section className="cd-hero rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">',
  );
  next = next.replaceAll(
    '<section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">',
    '<section className="cd-panel rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">',
  );
  next = next.replace(
    '<div className="rounded-3xl bg-slate-950 px-4 py-3 text-white">',
    '<div className="cd-amount-badge rounded-3xl bg-slate-950 px-4 py-3 text-white">',
  );
  return next;
});

patchFile('src/features/credit-dispatch/SignaturePad.tsx', (content) => {
  return content.replace(
    '<section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">',
    '<section className="cd-signature-card rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">',
  );
});

patchFile('src/features/credit-dispatch/CreditDispatchDetailPage.tsx', (content) => {
  let next = content;
  next = next.replace(
    '<div className="mx-auto max-w-6xl space-y-4 pb-20 print:max-w-none print:space-y-0 print:pb-0">',
    '<div data-cd-theme="detail" className="cd-shell cd-detail mx-auto max-w-6xl space-y-4 pb-20 print:max-w-none print:space-y-0 print:pb-0">',
  );
  next = next.replace(
    '<div className="mx-auto max-w-6xl space-y-4 pb-20 print:pb-0">',
    '<div data-cd-theme="detail" className="cd-shell cd-detail mx-auto max-w-6xl space-y-4 pb-20 print:pb-0">',
  );
  next = next.replace(
    '<section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm print:border-none print:p-0 print:shadow-none">',
    '<section className="cd-slip rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm print:border-none print:p-0 print:shadow-none">',
  );
  return next;
});

patchFile('src/features/credit-dispatch/RequestReportsPage.tsx', (content) => {
  let next = content;
  next = next.replace(
    '<div className="mx-auto max-w-7xl space-y-4 pb-20">',
    '<div data-cd-theme="reports" className="cd-shell cd-reports mx-auto max-w-7xl space-y-4 pb-20">',
  );
  next = next.replace(
    '<div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">',
    '<div className="cd-hero rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">',
  );
  return next;
});
