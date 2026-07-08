const fs = require('fs');
const path = require('path');

function patchFile(relativePath, patcher) {
  const filePath = path.join(__dirname, '..', relativePath);
  if (!fs.existsSync(filePath)) return;
  const original = fs.readFileSync(filePath, 'utf8');
  const next = patcher(original);
  if (next !== original) fs.writeFileSync(filePath, next);
}

patchFile('src/features/credit-dispatch/NewCreditDispatchPage.tsx', (content) => {
  let next = content;
  if (!next.includes('CreditCustomerPicker')) {
    next = next.replace("import { SignaturePad } from './SignaturePad';", "import { SignaturePad } from './SignaturePad';\nimport { CreditCustomerPicker } from './CreditCustomerPicker';");
  }

  const originalRequired = '<Field label="Customer Name" required><input className={inputClass} value={form.customerName} onChange={(event) => update(\'customerName\', event.target.value)} placeholder="Enter customer name" /></Field>';
  const originalPlain = '<Field label="Customer Name"><input className={inputClass} value={form.customerName} onChange={(event) => update(\'customerName\', event.target.value)} placeholder="Enter customer name" /></Field>';
  const picker = '<div className="sm:col-span-2"><CreditCustomerPicker value={form.customerName} onChange={(value) => update(\'customerName\', value)} onSelect={(customer) => { update(\'customerName\', customer.customer_name); update(\'mobileNo\', customer.mobile_no); update(\'customerType\', customer.customer_type); }} /></div>';

  next = next.replace(originalRequired, picker);
  next = next.replace(originalPlain, picker);
  return next;
});

patchFile('src/features/credit-dispatch/CreditDispatchListPage.tsx', (content) => {
  let next = content;
  if (next.includes('/credit-dispatch/customers')) return next;
  next = next.replace(
    '<Link to="/credit-dispatch/reports"><Button variant="secondary" className="w-full sm:w-auto">Reports</Button></Link>',
    '<Link to="/credit-dispatch/customers"><Button variant="secondary" className="w-full sm:w-auto">Customers</Button></Link><Link to="/credit-dispatch/reports"><Button variant="secondary" className="w-full sm:w-auto">Reports</Button></Link>'
  );
  return next;
});
