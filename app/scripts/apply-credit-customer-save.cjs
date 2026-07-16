const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/services/creditDispatch.service.ts');
let source = fs.readFileSync(filePath, 'utf8');

if (!source.includes("supabase.rpc('portal_upsert_credit_customer'")) {
  const marker = "export async function createCreditDispatch(input: CreditDispatchFormInput) {\n  validateRequestInput(input);\n";
  if (!source.includes(marker)) throw new Error('Credit customer upsert marker not found');
  const addition = [
    marker,
    "  const { data: customerId, error: customerError } = await supabase.rpc('portal_upsert_credit_customer', {",
    "    p_customer_name: input.customerName.trim(),",
    "    p_mobile_no: input.mobileNo.trim(),",
    "    p_customer_type: input.customerType,",
    "    p_branch: input.branch,",
    "    p_customer_id: null,",
    "  });",
    "  if (customerError) throw customerError;",
    "  if (!customerId) throw new Error('Could not save customer details.');",
    "",
  ].join('\n');
  source = source.replace(marker, addition);
}

if (!source.includes('customer_id: customerId,')) {
  const marker = '      branch: input.branch,\n      customer_name: input.customerName.trim(),';
  if (!source.includes(marker)) throw new Error('Credit customer id insert marker not found');
  source = source.replace(marker, '      branch: input.branch,\n      customer_id: customerId,\n      customer_name: input.customerName.trim(),');
}

fs.writeFileSync(filePath, source);
console.log('Credit customer save applied.');
