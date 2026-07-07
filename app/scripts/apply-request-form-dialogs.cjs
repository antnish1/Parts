const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'credit-dispatch', 'NewCreditDispatchPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  "import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, FileSignature, IndianRupee, Save, Send } from 'lucide-react';",
  "import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, FileSignature, IndianRupee, Save, Send, X } from 'lucide-react';",
);

const dialogComponent = `
function NoticeDialog({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:justify-center" onMouseDown={onClose}>
      <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-4 shadow-2xl sm:max-w-md" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="text-lg font-black text-slate-950">Action needed</h2><p className="mt-1 text-sm font-semibold text-slate-600">{message}</p></div>
          <button type="button" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-500" onClick={onClose}><X className="h-4 w-4" /></button>
        </div>
        <Button type="button" className="mt-4 w-full" onClick={onClose}>Okay</Button>
      </section>
    </div>
  );
}
`;

if (!content.includes('function NoticeDialog')) {
  const fieldEnd = content.indexOf('\n\nconst inputClass');
  if (fieldEnd !== -1) content = `${content.slice(0, fieldEnd)}${dialogComponent}${content.slice(fieldEnd)}`;
}

if (!content.includes('const [dialogMessage, setDialogMessage]')) {
  content = content.replace(
    "const [form, setForm] = useState<FormState>(() => initialState(profile?.branch ?? ''));",
    "const [form, setForm] = useState<FormState>(() => initialState(profile?.branch ?? ''));\n  const [dialogMessage, setDialogMessage] = useState('');",
  );
}

content = content.replace("if (error) return alert(error);", "if (error) { setDialogMessage(error); return; }");
content = content.replaceAll('alert(error);', "setDialogMessage(error);");

if (!content.includes('NoticeDialog message={dialogMessage}')) {
  content = content.replace(
    "      </div>\n    </div>\n  );\n}",
    "      </div>\n      {dialogMessage ? <NoticeDialog message={dialogMessage} onClose={() => setDialogMessage('')} /> : null}\n    </div>\n  );\n}",
  );
}

fs.writeFileSync(filePath, content);
