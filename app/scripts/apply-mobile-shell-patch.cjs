const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'layouts', 'AppLayout.tsx');
if (!fs.existsSync(file)) process.exit(0);

let text = fs.readFileSync(file, 'utf8');
text = text.replace(
  '<div className="p-2.5 lg:p-3"><Outlet /></div>',
  '<div className="p-2.5 pb-24 lg:p-3 xl:pb-3"><Outlet /></div>'
);
fs.writeFileSync(file, text, 'utf8');
