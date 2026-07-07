const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'features', 'orders', 'NewOrderPage.tsx');
if (!fs.existsSync(file)) process.exit(0);

let text = fs.readFileSync(file, 'utf8');

text = text.replace(
  "const inputClass = 'mt-1 h-9 w-full rounded-lg border border-[#263244] bg-[#0b1020] px-3 text-xs font-semibold text-white outline-none transition placeholder:text-[#6D8196] focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/20 disabled:cursor-not-allowed disabled:opacity-55';",
  "const inputClass = 'mt-1 min-h-[44px] w-full rounded-lg border border-[#263244] bg-[#0b1020] px-3 py-2 text-sm font-semibold text-white outline-none transition placeholder:text-[#6D8196] focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/20 disabled:cursor-not-allowed disabled:opacity-55 md:h-9 md:min-h-0 md:py-0 md:text-xs';"
);

text = text.replace(
  "const tableInputClass = 'h-8 w-full rounded-lg border border-[#263244] bg-[#0b1020] px-2 text-xs font-semibold text-white outline-none transition focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/20 disabled:cursor-not-allowed disabled:opacity-55';",
  "const tableInputClass = 'min-h-[40px] w-full rounded-lg border border-[#263244] bg-[#0b1020] px-2 py-2 text-sm font-semibold text-white outline-none transition focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/20 disabled:cursor-not-allowed disabled:opacity-55 md:h-8 md:min-h-0 md:py-0 md:text-xs';"
);

text = text.replace(
  '<form onSubmit={handleSubmit} className="space-y-3" aria-busy={isFormBusy}>',
  '<form onSubmit={handleSubmit} className="space-y-3 pb-24 md:pb-0" aria-busy={isFormBusy}>'
);

text = text.replace(
  '<div className="overflow-hidden rounded-xl border border-[#334155] bg-[#111827]">',
  '<div className="overflow-x-auto rounded-xl border border-[#334155] bg-[#111827]">'
);

text = text.replace(
  '<section className="rounded-xl border border-[#6b5b15] bg-[#0b1020] p-3 shadow-sm shadow-black/10">',
  '<section className="rounded-xl border border-[#6b5b15] bg-[#0b1020] p-3 shadow-sm shadow-black/10" data-mobile-parts-builder>'
);

fs.writeFileSync(file, text, 'utf8');
