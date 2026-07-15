const fs = require('fs');
const path = require('path');

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`${label} marker not found`);
  return source.replace(from, to);
}

const pagePath = path.resolve(__dirname, '../src/features/credit-dispatch/NewCreditDispatchPage.tsx');
let pageSource = fs.readFileSync(pagePath, 'utf8');

if (!pageSource.includes("from './SalesEmployeeAutocomplete'")) {
  pageSource = replaceOnce(
    pageSource,
    "import { SignaturePad } from './SignaturePad';",
    "import { SignaturePad } from './SignaturePad';\nimport { SalesEmployeeAutocomplete } from './SalesEmployeeAutocomplete';",
    'sales employee autocomplete import',
  );
}

if (!pageSource.includes("salesEmployeeName: ''")) {
  pageSource = replaceOnce(
    pageSource,
    `    remarks: '',\n    customerSignatureDataUrl: '',`,
    `    remarks: '',\n    salesEmployeeName: '',\n    customerSignatureDataUrl: '',`,
    'sales employee initial state',
  );
}

if (!pageSource.includes('documentDate: today, customerSignatureDataUrl')) {
  pageSource = pageSource.replace(
    `setForm({ ...initialState(profile?.branch ?? ''), ...JSON.parse(saved), customerSignatureDataUrl: '', issuerSignatureDataUrl: '' });`,
    `setForm({ ...initialState(profile?.branch ?? ''), ...JSON.parse(saved), documentDate: today, customerSignatureDataUrl: '', issuerSignatureDataUrl: '' });`,
  );
}

if (!pageSource.includes("Sales employee name is required.")) {
  pageSource = replaceOnce(
    pageSource,
    `    if (targetStep === 2) {\n      if (!form.customerSignatureDataUrl) return 'Customer signature is required.';`,
    `    if (targetStep === 2) {\n      if (!(form.salesEmployeeName ?? '').trim()) return 'Sales employee name is required.';\n      if (!form.customerSignatureDataUrl) return 'Customer signature is required.';`,
    'sales employee validation',
  );
}

if (!pageSource.includes('<SalesEmployeeAutocomplete')) {
  pageSource = replaceOnce(
    pageSource,
    `          <div className="space-y-4">\n            <SignaturePad title="Customer Signature"`,
    `          <div className="space-y-4">\n            <section className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">\n              <Field label="Sales Employee Name"><SalesEmployeeAutocomplete inputClassName={inputClass} value={form.salesEmployeeName ?? ''} onChange={(value) => update('salesEmployeeName', value)} /></Field>\n            </section>\n            <SignaturePad title="Customer Signature"`,
    'sales employee autocomplete field',
  );
}

if (!pageSource.includes("['Sales Employee', form.salesEmployeeName")) {
  pageSource = replaceOnce(
    pageSource,
    `['Customer', form.customerName], ['Mobile', form.mobileNo], ['Customer Type', form.customerType],`,
    `['Customer', form.customerName], ['Mobile', form.mobileNo], ['Customer Type', form.customerType], ['Sales Employee', form.salesEmployeeName ?? ''],`,
    'sales employee review value',
  );
}
fs.writeFileSync(pagePath, pageSource);

const servicePath = path.resolve(__dirname, '../src/services/creditDispatch.service.ts');
let serviceSource = fs.readFileSync(servicePath, 'utf8');

if (!serviceSource.includes("from './salesEmployee.service'")) {
  serviceSource = replaceOnce(
    serviceSource,
    "import { supabase } from '../lib/supabase';",
    "import { supabase } from '../lib/supabase';\nimport { ensureSalesEmployeeName } from './salesEmployee.service';",
    'sales employee service import',
  );
}

if (!serviceSource.includes('sales_employee_name: string | null;')) {
  serviceSource = replaceOnce(
    serviceSource,
    `  issuer_signature_path: string | null;`,
    `  issuer_signature_path: string | null;\n  sales_employee_name: string | null;`,
    'sales employee record type',
  );
}

if (!serviceSource.includes('salesEmployeeName?: string;')) {
  serviceSource = replaceOnce(
    serviceSource,
    `  remarks: string;\n  customerSignatureDataUrl: string;`,
    `  remarks: string;\n  salesEmployeeName?: string;\n  customerSignatureDataUrl: string;`,
    'sales employee form type',
  );
}

if (!serviceSource.includes("if (!(input.salesEmployeeName ?? '').trim())")) {
  serviceSource = replaceOnce(
    serviceSource,
    `  if (!input.customerSignatureDataUrl) throw new Error('Customer signature is required.');`,
    `  if (!(input.salesEmployeeName ?? '').trim()) throw new Error('Sales employee name is required.');\n  if (!input.customerSignatureDataUrl) throw new Error('Customer signature is required.');`,
    'sales employee service validation',
  );
}

if (!serviceSource.includes('const salesEmployeeName = await ensureSalesEmployeeName')) {
  serviceSource = replaceOnce(
    serviceSource,
    `export async function createCreditDispatch(input: CreditDispatchFormInput) {\n  validateRequestInput(input);`,
    `export async function createCreditDispatch(input: CreditDispatchFormInput) {\n  validateRequestInput(input);\n  const salesEmployeeName = await ensureSalesEmployeeName(input.salesEmployeeName ?? '');`,
    'sales employee ensure on submit',
  );
}

if (!serviceSource.includes('sales_employee_name: salesEmployeeName,')) {
  serviceSource = replaceOnce(
    serviceSource,
    `      remarks: input.remarks.trim() || null,\n      customer_signature_path: customerSignaturePath,`,
    `      remarks: input.remarks.trim() || null,\n      sales_employee_name: salesEmployeeName,\n      customer_signature_path: customerSignaturePath,`,
    'sales employee insert',
  );
}
fs.writeFileSync(servicePath, serviceSource);

console.log('Sales employee autocomplete and reusable master persistence applied.');
