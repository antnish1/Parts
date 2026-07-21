const fs = require('fs');
const path = require('path');
const filePath = path.resolve(__dirname, '../src/layouts/AppLayout.tsx');
let source = fs.readFileSync(filePath, 'utf8');
const item = `  { to: '/installations', label: 'Installations', icon: Settings, desktopLabel: 'Engine Installations', desktopGroup: 'Operations', desktopOrder: 32 },`;
if (!source.includes(item)) {
  const preferred = `  { to: '/credit-dispatch', label: 'Credit Dispatch', icon: FileSignature, desktopIcon: Truck, desktopGroup: 'Operations', desktopOrder: 30 },`;
  const fallback = `  { to: '/docket-scanner', label: 'Docket', icon: ScanLine, desktopLabel: 'Docket Scanner', desktopGroup: 'Operations', desktopOrder: 31 },`;
  if (source.includes(preferred)) source = source.replace(preferred, `${preferred}\n${item}`);
  else if (source.includes(fallback)) source = source.replace(fallback, `${fallback}\n${item}`);
  else console.warn('Installation navigation insertion point not found; continuing build without duplicate patch failure.');
}
fs.writeFileSync(filePath, source);
console.log('Installation navigation applied.');
