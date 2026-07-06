const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'orders', 'OrderDetailPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/\n\s*const totalQty = items\.reduce\(\(sum, item\) => sum \+ getEffectiveQty\(item\), 0\);\n\s*const totalBilled = items\.reduce\(\(sum, item\) => sum \+ getBilledQty\(item\), 0\);\n\s*const totalPending = items\.reduce\(\(sum, item\) => sum \+ getPendingQty\(item\), 0\);\n\s*const totalValue = items\.reduce\(\(sum, item\) => sum \+ getEffectiveValue\(item\), 0\);/g, '');

const startText = '<div className="mt-4 rounded-xl border border-[#c7d7e5]';
const start = content.indexOf(startText);
if (start !== -1) {
  const endText = '\n      </section>';
  const end = content.indexOf(endText, start);
  if (end !== -1) {
    content = content.slice(0, start) + content.slice(end);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
