const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'orders', 'OrderDetailPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');

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
