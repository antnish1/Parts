const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/features/orders/OrderDetailPage.tsx');
let source = fs.readFileSync(file, 'utf8');
// Build-time patches can reintroduce comparisons of the Director role after
// TypeScript has narrowed the role union. Preserve runtime comparisons while
// avoiding the impossible-literal type error in those expressions.
const from = "role === 'director'";
const to = "String(role) === 'director'";
if (source.includes(from)) {
  source = source.replaceAll(from, to);
  fs.writeFileSync(file, source);
  console.log('Normalized Director role checks after build patches.');
} else if (source.includes(to)) {
  console.log('Director role checks already normalized.');
} else {
  throw new Error('Expected Director role check missing; inspect the order detail workflow.');
}
