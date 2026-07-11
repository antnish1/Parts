const fs = require('fs');
const path = require('path');

function edit(file, fn) {
  const p = path.join(__dirname, '..', file);
  if (!fs.existsSync(p)) return;
  const oldText = fs.readFileSync(p, 'utf8');
  const newText = fn(oldText);
  if (newText !== oldText) fs.writeFileSync(p, newText);
}

edit('src/services/testOrderView.service.ts', (s) => {
  s = s.replace('  order_for: string;\n', '  order_for: string;\n  employee_name_legacy: string | null;\n  approved_by_name: string | null;\n  approved_by_super_name: string | null;\n');
  s = s.replace('  approver?: { full_name: string | null; role: string | null } | null;\n};', '  employee?: { full_name: string | null; role: string | null } | null;\n  approver?: { full_name: string | null; role: string | null } | null;\n};');
  s = s.replace("type RawOrderView = Omit<TestOrderView, 'approver'> & { approver?: { full_name: string | null; role: string | null } | Array<{ full_name: string | null; role: string | null }> | null; };", "type PersonLink = { full_name: string | null; role: string | null };\ntype RawOrderView = Omit<TestOrderView, 'approver' | 'employee'> & { approver?: PersonLink | PersonLink[] | null; employee?: PersonLink | PersonLink[] | null; };");
  s = s.replace("  const approver = Array.isArray(order.approver) ? order.approver[0] ?? null : order.approver ?? null;\n  return { ...order, approver };", "  const approver = Array.isArray(order.approver) ? order.approver[0] ?? null : order.approver ?? null;\n  const employee = Array.isArray(order.employee) ? order.employee[0] ?? null : order.employee ?? null;\n  return { ...order, approver, employee };");
  s = s.replace("id, order_no, branch, order_type, order_for, machine_no, customer_name, call_id, warranty_status, status, approval_status, approver_id", "id, order_no, branch, order_type, order_for, employee_name_legacy, approved_by_name, approved_by_super_name, machine_no, customer_name, call_id, warranty_status, status, approval_status, approver_id");
  return s;
});

edit('src/features/orders/OrderDetailPage.tsx', (s) => {
  s = s.replace("{ label: 'Order For', value: order.order_for === 'Customer' ? order.customer_name || 'Customer' : 'Stock' },", "{ label: 'Order For', value: String(order.order_for ?? '').toLowerCase() === 'stock' ? 'Stock' : 'Customer' },");
  s = s.replace("{ label: 'Employee', value: '-' },", "{ label: 'Employee', value: order.employee?.full_name || order.employee_name_legacy || '-' },");
  s = s.replace("{ label: 'Approved By', value: order.approver?.full_name || '-' },", "{ label: 'Approved By', value: order.approved_by_name || order.approved_by_super_name || order.approver?.full_name || '-' },");
  return s;
});
