const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'credit-dispatch', 'CreditDispatchListPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');
if (!content.includes('View record')) {
  content = content.replace(
    "<p className=\"truncate text-sm font-black text-slate-950\">{row.dispatch_no ?? 'Pending No.'}</p>",
    "<Link to={'/credit-dispatch/view?id=' + row.id} className=\"truncate text-sm font-black text-blue-700 hover:text-blue-900\" title=\"View record\">{row.dispatch_no ?? 'Pending No.'}</Link>"
  );
  content = content.replace(
    "<p className=\"font-black text-slate-900\">{row.dispatch_no ?? 'Pending No.'}</p>",
    "<Link to={'/credit-dispatch/view?id=' + row.id} className=\"font-black text-blue-700 hover:text-blue-900\" title=\"View record\">{row.dispatch_no ?? 'Pending No.'}</Link>"
  );
}

fs.writeFileSync(filePath, content);
