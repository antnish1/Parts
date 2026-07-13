const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/auth/roleGuards.ts');
let source = fs.readFileSync(filePath, 'utf8');

const marker = `  if (path === '/orders/new') return role === 'branch';`;
const replacement = `  if (/^\\/orders\\/[^/]+\\/correct$/.test(path)) return ['manager', 'developer'].includes(role);\n${marker}`;

if (!source.includes(replacement)) {
  if (!source.includes(marker)) throw new Error('Order correction route guard marker not found');
  source = source.replace(marker, replacement);
  fs.writeFileSync(filePath, source);
}

console.log('Order correction route guard applied.');
