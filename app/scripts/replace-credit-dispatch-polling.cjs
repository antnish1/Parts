const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = [
  'src/features/credit-dispatch/CreditDispatchListPage.tsx',
  'src/features/credit-dispatch/RequestReportsPage.tsx',
  'src/features/credit-dispatch/CreditCustomersPage.tsx',
  'src/features/credit-dispatch/CreditAgingPage.tsx',
];

for (const relativePath of files) {
  const filePath = path.join(root, relativePath);
  let source = fs.readFileSync(filePath, 'utf8');
  const replacement = 'staleTime: 60000, refetchOnWindowFocus: true';
  if (source.includes(replacement)) continue;
  if (!source.includes('refetchInterval: 30000')) {
    throw new Error(`30-second polling pattern not found in ${relativePath}`);
  }
  source = source.replace('refetchInterval: 30000', replacement);
  fs.writeFileSync(filePath, source);
}

console.log('Credit Dispatch polling replaced with focus-based refresh.');
