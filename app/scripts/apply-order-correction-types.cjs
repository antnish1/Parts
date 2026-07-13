const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/features/orders/OrderDataCorrectionPage.tsx');
let source = fs.readFileSync(filePath, 'utf8');
source = source.replace('  type CorrectionConsoleData,\n', '');
source = source.replace(' } as never);', ' });');
fs.writeFileSync(filePath, source);
console.log('Order correction TypeScript normalized.');
