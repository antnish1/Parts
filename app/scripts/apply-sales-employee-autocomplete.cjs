const fs = require('fs');
const path = require('path');

const pagePath = path.resolve(__dirname, '../src/features/credit-dispatch/NewCreditDispatchPage.tsx');
let pageSource = fs.readFileSync(pagePath, 'utf8');

if (!pageSource.includes('<SalesEmployeeAutocomplete')) {
  const fieldRegex = /<Field label="Sales Employee Name"><input[\s\S]*?placeholder="Enter sales employee name"\s*\/><\/Field>/;
  if (fieldRegex.test(pageSource)) {
    pageSource = pageSource.replace(
      fieldRegex,
      `<Field label="Sales Employee Name"><SalesEmployeeAutocomplete inputClassName={inputClass} value={form.salesEmployeeName ?? ''} onChange={(value) => update('salesEmployeeName', value)} /></Field>`,
    );
  } else {
    throw new Error('sales employee input field marker not found');
  }
}

if (pageSource.includes('<SalesEmployeeAutocomplete') && !pageSource.includes("from './SalesEmployeeAutocomplete'")) {
  pageSource = pageSource.replace(
    "import { SignaturePad } from './SignaturePad';",
    "import { SignaturePad } from './SignaturePad';\nimport { SalesEmployeeAutocomplete } from './SalesEmployeeAutocomplete';",
  );
}
fs.writeFileSync(pagePath, pageSource);

const servicePath = path.resolve(__dirname, '../src/services/creditDispatch.service.ts');
let serviceSource = fs.readFileSync(servicePath, 'utf8');

if (!serviceSource.includes('const salesEmployeeName = await ensureSalesEmployeeName')) {
  const createMarker = `export async function createCreditDispatch(input: CreditDispatchFormInput) {\n  validateRequestInput(input);`;
  if (!serviceSource.includes(createMarker)) throw new Error('credit dispatch create marker not found');
  serviceSource = serviceSource.replace(
    createMarker,
    `${createMarker}\n  const salesEmployeeName = await ensureSalesEmployeeName(input.salesEmployeeName ?? '');`,
  );
}

if (serviceSource.includes('ensureSalesEmployeeName') && !serviceSource.includes("from './salesEmployee.service'")) {
  serviceSource = serviceSource.replace(
    "import { supabase } from '../lib/supabase';",
    "import { supabase } from '../lib/supabase';\nimport { ensureSalesEmployeeName } from './salesEmployee.service';",
  );
}

serviceSource = serviceSource.replace(
  `sales_employee_name: (input.salesEmployeeName ?? '').trim().toUpperCase(),`,
  `sales_employee_name: salesEmployeeName,`,
);
fs.writeFileSync(servicePath, serviceSource);

console.log('Sales employee autocomplete and reusable master persistence applied.');
