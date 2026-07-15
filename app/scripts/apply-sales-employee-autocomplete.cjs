const fs = require('fs');
const path = require('path');

function patch(filePath, from, to, label) {
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`${label} marker not found`);
  source = source.replace(from, to);
  fs.writeFileSync(filePath, source);
}

const pagePath = path.resolve(__dirname, '../src/features/credit-dispatch/NewCreditDispatchPage.tsx');
patch(
  pagePath,
  "import { SignaturePad } from './SignaturePad';",
  "import { SignaturePad } from './SignaturePad';\nimport { SalesEmployeeAutocomplete } from './SalesEmployeeAutocomplete';",
  'sales employee autocomplete import',
);
patch(
  pagePath,
  `<Field label="Sales Employee Name"><input className={inputClass} value={form.salesEmployeeName ?? ''} onChange={(event) => update('salesEmployeeName', event.target.value.toUpperCase())} placeholder="Enter sales employee name" /></Field>`,
  `<Field label="Sales Employee Name"><SalesEmployeeAutocomplete inputClassName={inputClass} value={form.salesEmployeeName ?? ''} onChange={(value) => update('salesEmployeeName', value)} /></Field>`,
  'sales employee autocomplete field',
);

const servicePath = path.resolve(__dirname, '../src/services/creditDispatch.service.ts');
patch(
  servicePath,
  "import { supabase } from '../lib/supabase';",
  "import { supabase } from '../lib/supabase';\nimport { ensureSalesEmployeeName } from './salesEmployee.service';",
  'sales employee service import',
);
patch(
  servicePath,
  `export async function createCreditDispatch(input: CreditDispatchFormInput) {\n  validateRequestInput(input);`,
  `export async function createCreditDispatch(input: CreditDispatchFormInput) {\n  validateRequestInput(input);\n  const salesEmployeeName = await ensureSalesEmployeeName(input.salesEmployeeName ?? '');`,
  'sales employee ensure on submit',
);
patch(
  servicePath,
  `sales_employee_name: (input.salesEmployeeName ?? '').trim().toUpperCase(),`,
  `sales_employee_name: salesEmployeeName,`,
  'sales employee normalized insert',
);

console.log('Sales employee autocomplete and reusable master persistence applied.');
