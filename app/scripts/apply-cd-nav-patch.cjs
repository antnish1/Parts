const fs = require('fs');
const path = require('path');

const layoutPath = path.join(__dirname, '..', 'src', 'layouts', 'AppLayout.tsx');
let content = fs.readFileSync(layoutPath, 'utf8');

if (!content.includes('FileSignature')) {
  content = content.replace('FilePlus2, Home, LogOut', 'FilePlus2, FileSignature, Home, LogOut');
}

if (!content.includes('/credit-dispatch')) {
  content = content.replace(
    "  { to: '/orders/track', label: 'Track Orders', icon: PackageSearch },",
    "  { to: '/orders/track', label: 'Track Orders', icon: PackageSearch },\n  { to: '/credit-dispatch', label: 'Credit Dispatch', icon: FileSignature },",
  );
}

fs.writeFileSync(layoutPath, content);
