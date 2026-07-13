const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/features/orders/OrderDetailPage.tsx');
let source = fs.readFileSync(filePath, 'utf8');

const marker = `        <button type="button" className="h-8 rounded-md border border-[#cfd8e3] bg-white px-3 text-xs font-medium text-[#0f172a] hover:bg-[#f3f8ff]" disabled={isBlockingAction} onClick={() => navigate(-1)}>Back</button>`;
const replacement = `        {(role === 'manager' || role === 'developer') ? <button type="button" className="h-8 rounded-md border border-[#0f5fa8] bg-[#0f5fa8] px-3 text-xs font-semibold text-white hover:bg-[#0b4f8d]" disabled={isBlockingAction} onClick={() => navigate(\`/orders/\${orderId}/correct\`)}>Correct Data</button> : null}\n${marker}`;

if (!source.includes(replacement)) {
  if (!source.includes(marker)) throw new Error('Order Detail action marker not found');
  source = source.replace(marker, replacement);
  fs.writeFileSync(filePath, source);
}

console.log('Order correction entry applied.');
