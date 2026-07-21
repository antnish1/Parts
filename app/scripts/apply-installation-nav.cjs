const fs = require('fs');
const path = require('path');
const filePath = path.resolve(__dirname, '../src/layouts/AppLayout.tsx');
let source = fs.readFileSync(filePath, 'utf8');
const marker = `  { to: '/credit-dispatch', label: 'Credit Dispatch', icon: FileSignature, desktopIcon: Truck, desktopGroup: 'Operations', desktopOrder: 30 },`;
const item = `  { to: '/installations', label: 'Installations', icon: Settings, desktopLabel: 'Engine Installations', desktopGroup: 'Operations', desktopOrder: 32 },`;
if (!source.includes(item)) {
  if (!source.includes(marker)) throw new Error('Installation navigation marker not found');
  source = source.replace(marker, `${marker}\n${item}`);
}
fs.writeFileSync(filePath, source);
console.log('Installation navigation applied.');
