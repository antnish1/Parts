const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/features/tracking/PendingIssueOrdersPage.tsx');
let source = fs.readFileSync(filePath, 'utf8');

const oldTotalCard = `{ key: 'all', label: 'Total Pending', data: totals.all, onClick: () => { updateParam('age', 'all'); updateParam('type', 'all'); }, active: age === 'all' && type === 'all' },`;
const newTotalCard = `{ key: 'all', label: 'Total Pending', data: totals.all, onClick: () => { const next = new URLSearchParams(params); next.delete('age'); next.delete('type'); setParams(next, { replace: true }); }, active: age === 'all' && type === 'all' },`;
if (!source.includes(newTotalCard)) {
  if (!source.includes(oldTotalCard)) throw new Error('Total Pending KPI marker not found');
  source = source.replace(oldTotalCard, newTotalCard);
}

const oldCount = `<strong className="mt-1 block text-xl">{card.data.count}</strong>`;
const newCount = `<strong className={\`mt-1 block text-xl \${card.active ? '!text-white' : '!text-[#0f172a]'}\`}>{card.data.count}</strong>`;
if (!source.includes(newCount)) {
  if (!source.includes(oldCount)) throw new Error('Pending Issue KPI count marker not found');
  source = source.replace(oldCount, newCount);
}

fs.writeFileSync(filePath, source);
console.log('Pending Issue KPI fixes applied.');
