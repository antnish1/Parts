const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'credit-dispatch', 'NewCreditDispatchPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');

content = content.replace('mx-auto max-w-4xl pb-24', 'mx-auto max-w-4xl pb-44 xl:pb-24');
content = content.replace('fixed inset-x-0 bottom-0 z-30', 'fixed inset-x-0 bottom-20 z-40');
content = content.replace('py-3 shadow-2xl backdrop-blur lg:left-48', 'py-2 shadow-2xl backdrop-blur xl:bottom-0 xl:left-48 xl:py-3');
content = content.replace('mx-auto flex max-w-4xl items-center justify-between gap-3', 'mx-auto flex max-w-4xl items-center justify-between gap-2 sm:gap-3');
content = content.replace('hidden items-center gap-2 text-xs font-bold text-slate-500 sm:flex', 'flex min-w-0 items-center justify-center gap-1 px-1 text-[10px] font-bold text-slate-500 sm:gap-2 sm:text-xs');
content = content.replace('Draft auto-saved on this device', 'Draft auto-saved');
content = content.replace('variant="secondary" className="px-3"', 'variant="secondary" className="min-w-[86px] px-3"');
content = content.replace('onClick={goNext} disabled={createMutation.isPending}>Next', 'className="min-w-[86px] px-3" onClick={goNext} disabled={createMutation.isPending}>Next');

fs.writeFileSync(filePath, content);
