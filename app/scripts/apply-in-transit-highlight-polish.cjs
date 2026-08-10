const fs = require('fs');
const path = require('path');

const relativePath = 'src/features/approvals/ApprovalsPage.tsx';
const filePath = path.join(__dirname, '..', relativePath);
let source = fs.readFileSync(filePath, 'utf8');

source = source
  .replace(
    "className={hasInTransit ? 'bg-[#3a2f0b]' : 'bg-[#111827]'}",
    "className={hasInTransit ? 'bg-[#fff9e8]' : 'bg-[#111827]'}",
  )
  .replace(
    'border-[#f4c542] bg-[#fff3b0] px-2 py-0.5 font-black text-[#6b4e00]',
    'border-[#e7b94d] bg-[#fff7d6] px-2 py-0.5 font-black text-[#7a5200]',
  );

if (!source.includes("hasInTransit ? 'bg-[#fff9e8]'")) {
  throw new Error('Subtle Item Review In Transit row highlight marker not found');
}

fs.writeFileSync(filePath, source, 'utf8');
console.log('Subtle Item Review In Transit highlight applied.');
