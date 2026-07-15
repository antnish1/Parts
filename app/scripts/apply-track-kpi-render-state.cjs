const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/features/tracking/TrackOrdersPage.tsx');
let source = fs.readFileSync(filePath, 'utf8');

const replacements = [
  [
    'className="pc-kpi-card rounded-md px-2 py-1.5 text-left" data-active={statusFilter === String(key)}',
    "className={`pc-kpi-card rounded-md px-2 py-1.5 text-left ${statusFilter === String(key) ? '!border-[#0b1f3a] !bg-[#0b1f3a] !text-white' : ''}`} data-active={statusFilter === String(key)}",
  ],
  [
    'className="pc-kpi-label text-[10px] uppercase"',
    "className={`pc-kpi-label text-[10px] uppercase ${statusFilter === String(key) ? '!text-[#d9e9f8]' : ''}`}",
  ],
  [
    'className="pc-kpi-count text-sm font-bold"',
    "className={`pc-kpi-count text-sm font-bold ${statusFilter === String(key) ? '!text-white' : ''}`}",
  ],
  [
    'className="pc-kpi-value absolute bottom-1 right-2 text-[9px] font-semibold"',
    "className={`pc-kpi-value absolute bottom-1 right-2 text-[9px] font-semibold ${statusFilter === String(key) ? '!text-[#ffe47a]' : ''}`}",
  ],
];

for (const [from, to] of replacements) {
  if (source.includes(to)) continue;
  if (!source.includes(from)) throw new Error(`Track KPI render marker not found: ${from}`);
  source = source.replace(from, to);
}

fs.writeFileSync(filePath, source);
console.log('Track Orders KPI active render state applied.');
