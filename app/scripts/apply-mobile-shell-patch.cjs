const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'layouts', 'AppLayout.tsx');
if (!fs.existsSync(file)) process.exit(0);

let text = fs.readFileSync(file, 'utf8');

text = text.replace(
  '<div className="p-2.5 lg:p-3"><Outlet /></div>',
  '<div className="p-2.5 pb-24 lg:p-3 xl:pb-3"><Outlet /></div>'
);

text = text.replace(
  '<div className="flex items-center justify-between gap-3">\n              <div className="flex min-w-fit items-center gap-2">\n                <img src={brandLogoSrc} alt="Parts Connect Portal logo" className="h-8 w-8 rounded-md bg-white object-contain p-0.5" />\n                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#82C8E5]">Parts Connect Portal</p>\n              </div>\n              <Button variant="secondary" className="rounded-md border-[#314158] bg-[#1e293b] px-3 py-1.5 text-xs font-black !text-[#f8fafc] shadow-sm hover:border-[#64748b] hover:bg-[#0f172a] [&_svg]:!text-[#f8fafc]" onClick={handleSignOut}>',
  '<div className="flex items-center justify-between gap-3">\n              <div className="flex min-w-0 items-center gap-2">\n                <img src={brandLogoSrc} alt="Parts Connect Portal logo" className="h-8 w-8 shrink-0 rounded-md bg-white object-contain p-0.5" />\n                <div className="min-w-0">\n                  <p className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-[#82C8E5]">Parts Connect Portal</p>\n                  <p className="truncate text-[10px] font-bold text-[#667085]">{profile?.fullName ?? \'User\'} • {profile?.role ?? \'role\'} • {profile?.branch ?? \'branch\'}</p>\n                </div>\n              </div>\n              <Button variant="secondary" className="rounded-md border-[#314158] bg-[#1e293b] px-3 py-1.5 text-xs font-black !text-[#f8fafc] shadow-sm hover:border-[#64748b] hover:bg-[#0f172a] [&_svg]:!text-[#f8fafc]" onClick={handleSignOut}>'
);

fs.writeFileSync(file, text, 'utf8');
