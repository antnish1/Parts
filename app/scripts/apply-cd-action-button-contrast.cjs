const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'credit-dispatch', 'CreditDispatchListPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);
let content = fs.readFileSync(filePath, 'utf8');

content = content.replaceAll(
  '<Button variant="secondary" className="w-full sm:w-auto">Customers</Button>',
  '<Button className="w-full bg-slate-900 text-white hover:bg-slate-800 sm:w-auto">Customers</Button>'
);
content = content.replaceAll(
  '<Button variant="secondary" className="w-full sm:w-auto">Reports</Button>',
  '<Button className="w-full bg-blue-600 text-white hover:bg-blue-700 sm:w-auto">Reports</Button>'
);

fs.writeFileSync(filePath, content);
