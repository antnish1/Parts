const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'credit-dispatch', 'CreditDispatchListPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');

if (!content.includes('/credit-dispatch/reports')) {
  content = content.replace(
    '<Link to="/credit-dispatch/new"><Button className="w-full sm:w-auto"><Plus className="h-4 w-4" />New Request</Button></Link>',
    '<div className="flex flex-col gap-2 sm:flex-row"><Link to="/credit-dispatch/reports"><Button variant="secondary" className="w-full sm:w-auto">Reports</Button></Link><Link to="/credit-dispatch/new"><Button className="w-full sm:w-auto"><Plus className="h-4 w-4" />New Request</Button></Link></div>'
  );
}

fs.writeFileSync(filePath, content);
