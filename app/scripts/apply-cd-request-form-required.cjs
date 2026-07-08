const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'credit-dispatch', 'NewCreditDispatchPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "function Field({ label, children }: { label: string; children: ReactNode }) {\n  return (\n    <label className=\"block\">\n      <span className=\"mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500\">{label}</span>\n      {children}\n    </label>\n  );\n}",
  "function Field({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {\n  return (\n    <label className=\"block\">\n      <span className=\"mb-1.5 block text-[11px] font-black uppercase tracking-[0.16em] text-slate-500\">{label}{required ? <span className=\"ml-1 text-red-500\">*</span> : null}</span>\n      {children}\n    </label>\n  );\n}"
);

content = content.replace(
  '<p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit Dispatch</p>',
  '<p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit dispatch Format</p>'
);
content = content.replace(/\s*<h1 className="mt-1 text-2xl font-black text-slate-950">New signed credit request<\/h1>\s*<p className="mt-1 text-sm font-semibold text-slate-500">Digital replacement for manual credit dispatch slip\.<\/p>/g, '');
content = content.replace(
  '<div className="cd-amount-badge rounded-3xl bg-slate-950 px-4 py-3 text-white">',
  '<div className="rounded-3xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950">'
);
content = content.replace(
  '<div className="rounded-3xl bg-slate-950 px-4 py-3 text-white">',
  '<div className="rounded-3xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950">'
);
content = content.replace('text-blue-200">Amount</p>', 'text-blue-600">Amount</p>');

content = content.replace("if (!form.documentDate) return 'Document date is required.';", "if (!form.documentNo.trim()) return 'Document no. is required.';\n      if (!form.documentDate) return 'Document date is required.';");

[
  'Customer Name',
  'Mobile No.',
  'Customer Type',
  'Document Type',
  'Document No.',
  'Document Date',
  'Credit Amount',
  'Tentative Closure'
].forEach((label) => {
  content = content.replace(new RegExp(`<Field label=\"${label.replace('.', '\\.')}\">`, 'g'), `<Field label=\"${label}\" required>`);
});

fs.writeFileSync(filePath, content);
