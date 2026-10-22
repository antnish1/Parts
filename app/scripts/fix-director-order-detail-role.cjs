const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/features/orders/OrderDetailPage.tsx');
let source = fs.readFileSync(file, 'utf8');
const legacy = "role === 'developer' || role === 'manager' || role === 'director' || isSelectedSuperApprover";
const fixed = "(['developer', 'manager', 'director'] as readonly string[]).includes(role ?? '') || isSelectedSuperApprover";
if (source.includes(fixed)) {
  console.log('Director quantity edit type check already applied.');
} else if (source.includes(legacy)) {
  source = source.replace(legacy, fixed);
  fs.writeFileSync(file, source);
  console.log('Director quantity edit type check applied.');
} else {
  throw new Error('Director quantity edit check pattern not found; inspect current workflow before updating.');
}
