const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'features', 'tracking', 'TrackOrdersPage.tsx');
if (!fs.existsSync(file)) process.exit(0);

let text = fs.readFileSync(file, 'utf8');

text = text.replace(
  'className="mb-2 grid gap-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]"',
  'className="mb-2 grid grid-cols-2 gap-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]"'
);

text = text.replace(
  '<input className="min-h-[44px] rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2 text-sm text-white outline-none focus:border-[#82C8E5] md:min-h-0 md:py-1.5 md:text-xs" placeholder="Search order, part no, part name, branch, customer, machine, invoice, status"',
  '<input className="col-span-2 min-h-[44px] rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2 text-sm text-white outline-none focus:border-[#82C8E5] md:min-h-0 md:py-1.5 md:text-xs lg:col-span-1" placeholder="Search order, part no, part name, branch, customer, machine, invoice, status"'
);

text = text.replace(
  '<select className="min-h-[44px] rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2 text-sm text-white outline-none focus:border-[#82C8E5] md:min-h-0 md:py-1.5 md:text-xs" value={statusFilter}',
  '<select className="col-span-2 min-h-[44px] rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2 text-sm text-white outline-none focus:border-[#82C8E5] md:min-h-0 md:py-1.5 md:text-xs lg:col-span-1" value={statusFilter}'
);

fs.writeFileSync(file, text, 'utf8');
