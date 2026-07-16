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
  if (!next.includes("import { CreditCustomerPicker } from './CreditCustomerPicker';")) {
    const marker = "import { SignaturePad } from './SignaturePad';";
    if (!next.includes(marker)) throw new Error('Credit customer picker import marker not found');
    next = next.replace(marker, `${marker}\nimport { CreditCustomerPicker } from './CreditCustomerPicker';`);
  }

  if (!next.includes('<CreditCustomerPicker value={form.customerName}')) {
    const customerField = /<Field label="Customer Name"(?: required)?><input[^>]*value=\{form\.customerName\}[\s\S]*?placeholder="Enter customer name"\s*\/><\/Field>/;
    if (!customerField.test(next)) throw new Error('Credit customer name field marker not found');
    const picker = '<div className="sm:col-span-2"><CreditCustomerPicker value={form.customerName} onChange={(value) => update(\'customerName\', value.toUpperCase())} onSelect={(customer) => { update(\'customerName\', customer.customer_name); update(\'mobileNo\', customer.mobile_no); update(\'customerType\', customer.customer_type); }} /></div>';
    next = next.replace(customerField, picker);
  }

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

console.log('Credit customer picker and customer navigation applied.');
