const fs = require('fs');
const path = require('path');

function replaceOnce(source, from, to, label) {
  if (source.includes(to)) return source;
  if (!source.includes(from)) throw new Error(`${label} marker not found`);
  return source.replace(from, to);
}

const viewPath = path.resolve(__dirname, '../src/services/testOrderView.service.ts');
let view = fs.readFileSync(viewPath, 'utf8');
view = replaceOnce(view, `  transport_name: string | null;\n  created_at: string;`, `  transport_name: string | null;\n  issued_document_type: string | null;\n  issued_document_no: string | null;\n  issued_at: string | null;\n  issued_by: string | null;\n  issuer?: { full_name: string | null; role: string | null } | null;\n  created_at: string;`, 'issued order view type');
view = replaceOnce(view, `type RawOrderView = Omit<TestOrderView, 'approver' | 'employee'>`, `type RawOrderView = Omit<TestOrderView, 'approver' | 'employee' | 'issuer'>`, 'raw issuer type');
view = replaceOnce(view, `employee?: { full_name: string | null; role: string | null } | Array<{ full_name: string | null; role: string | null }> | null; };`, `employee?: { full_name: string | null; role: string | null } | Array<{ full_name: string | null; role: string | null }> | null; issuer?: { full_name: string | null; role: string | null } | Array<{ full_name: string | null; role: string | null }> | null; };`, 'raw issuer relation');
view = replaceOnce(view, `  const employee = Array.isArray(order.employee) ? order.employee[0] ?? null : order.employee ?? null;\n  return { ...order, approver, employee };`, `  const employee = Array.isArray(order.employee) ? order.employee[0] ?? null : order.employee ?? null;\n  const issuer = Array.isArray(order.issuer) ? order.issuer[0] ?? null : order.issuer ?? null;\n  return { ...order, approver, employee, issuer };`, 'normalize issuer');
view = replaceOnce(view, `received_date, docket_no, transport_name, created_at, approver:portal_profiles!portal_orders_approver_id_fkey(full_name, role)`, `received_date, docket_no, transport_name, issued_document_type, issued_document_no, issued_at, issued_by, created_at, approver:portal_profiles!portal_orders_approver_id_fkey(full_name, role), issuer:portal_profiles!portal_orders_issued_by_fkey(full_name, role)`, 'issued select fields');
fs.writeFileSync(viewPath, view);

const detailPath = path.resolve(__dirname, '../src/features/orders/OrderDetailPage.tsx');
let detail = fs.readFileSync(detailPath, 'utf8');
detail = replaceOnce(detail, `import { OrderActivityPanel } from './OrderActivityPanel';`, `import { OrderActivityPanel } from './OrderActivityPanel';\nimport { IssueOrderPartsDialog } from '../tracking/IssueOrderPartsDialog';`, 'issued import');
detail = replaceOnce(detail, `  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});`, `  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});\n  const [showIssueModal, setShowIssueModal] = useState(false);`, 'issued state');
detail = replaceOnce(detail, `  const displayStatus = isManagerApprovalWorkflow ? 'PENDING MANAGER APPROVAL' : status;`, `  const displayStatus = rawStatus === 'issued' ? 'ISSUED' : rawStatus === 'partially_issued' ? 'PARTIALLY ISSUED' : isManagerApprovalWorkflow ? 'PENDING MANAGER APPROVAL' : status;`, 'issued terminal status');
detail = replaceOnce(detail, `  const canProcess = (canAdmin || role === 'manager') && rawStatus === 'approved';`, `  const canProcess = (canAdmin || role === 'manager') && rawStatus === 'approved';\n  const canIssue = ['branch', 'admin', 'manager', 'developer', 'hq'].includes(role ?? '') && String(order.order_for ?? '').toLowerCase() === 'customer' && ['received', 'partially_issued'].includes(rawStatus);`, 'issued eligibility');
detail = replaceOnce(detail, `  const blockingLabel = busyAction === 'approve' ? 'Approving order' : busyAction === 'reject' ? 'Rejecting order' : busyAction === 'process' ? 'Processing order'`, `  const blockingLabel = busyAction === 'approve' ? 'Approving order' : busyAction === 'reject' ? 'Rejecting order' : busyAction === 'process' ? 'Processing order' : busyAction === 'issue' ? 'Marking order as issued'`, 'issued blocking label');
detail = replaceOnce(detail, `    { label: 'Call ID', value: order.call_id || '-' },\n  ];`, `    { label: 'Call ID', value: order.call_id || '-' },\n    ...(['issued', 'partially_issued'].includes(rawStatus) ? [\n      { label: 'Issued Doc Type', value: order.issued_document_type || '-' },\n      { label: 'Issued Doc No', value: order.issued_document_no || '-' },\n      { label: 'Issued By', value: order.issuer?.full_name || '-' },\n      { label: 'Issued At', value: formatDate(order.issued_at) },\n    ] : []),\n  ];`, 'issued summary');
detail = replaceOnce(detail, `        <button type="button" className="h-8 rounded-md border border-[#cfd8e3] bg-white px-3 text-xs font-medium text-[#0f172a] hover:bg-[#f3f8ff]" disabled={isBlockingAction} onClick={downloadOrderWorkbook}>Download</button>`, `        {canIssue ? <button type="button" className="h-8 rounded-md border border-[#0f5fa8] bg-[#0f5fa8] px-3 text-xs font-semibold text-white hover:bg-[#0b4d8a] disabled:opacity-50" disabled={isBlockingAction} onClick={() => setShowIssueModal(true)}>Issue Parts</button> : null}\n        <button type="button" className="h-8 rounded-md border border-[#cfd8e3] bg-white px-3 text-xs font-medium text-[#0f172a] hover:bg-[#f3f8ff]" disabled={isBlockingAction} onClick={downloadOrderWorkbook}>Download</button>`, 'issued button');
detail = replaceOnce(detail, `      {actionMessage ? <p className=\"no-print mb-2`, `      {showIssueModal ? (\n        <IssueOrderPartsDialog orderId={orderId} orderLabel={order.final_order_no || order.order_no}\n          onClose={() => setShowIssueModal(false)}\n          onIssued={async (message) => {\n            setActionMessage(message);\n            await refetch();\n            await Promise.all([\n              queryClient.invalidateQueries({ queryKey: ['test-orders'] }),\n              queryClient.invalidateQueries({ queryKey: ['order-list-paged'] }),\n              queryClient.invalidateQueries({ queryKey: ['tracking-meta'] }),\n              queryClient.invalidateQueries({ queryKey: ['pending-issue-orders'] }),\n              queryClient.invalidateQueries({ queryKey: ['pending-issue-nav-count'] }),\n            ]);\n          }} />\n      ) : null}\n\n      {actionMessage ? <p className=\"no-print mb-2`, 'issued modal');
detail = detail.replace(`const rowDisplayStatus = getResolvedRowStatus(item);`, `const rowDisplayStatus = rawStatus === 'issued' ? 'ISSUED' : getResolvedRowStatus(item);`);
fs.writeFileSync(detailPath, detail);

const trackingPath = path.resolve(__dirname, '../src/features/tracking/TrackOrdersPage.tsx');
let tracking = fs.readFileSync(trackingPath, 'utf8');
tracking = tracking.replace(`resolvedStatus: itemMeta?.resolvedStatus || order.status,`, `resolvedStatus: order.status === 'issued' ? 'issued' : itemMeta?.resolvedStatus || order.status,`);
tracking = tracking.replace(`rejected: statuses.filter((status) => status === 'rejected').length };`, `issued: statuses.filter((status) => status === 'issued').length, rejected: statuses.filter((status) => status === 'rejected').length };`);
tracking = tracking.replace(`const totals = { all: 0, pending: 0, approved: 0, processed: 0, dispatched: 0, received: 0, rejected: 0 };`, `const totals = { all: 0, pending: 0, approved: 0, processed: 0, dispatched: 0, received: 0, issued: 0, rejected: 0 };`);
tracking = tracking.replace(`if (status === 'received') totals.received += meta.totalValue;`, `if (status === 'received') totals.received += meta.totalValue;\n      if (status === 'issued') totals.issued += meta.totalValue;`);
tracking = tracking.replace(`['received', 'Received', counts.received, kpiValues.received],`, `['received', 'Received', counts.received, kpiValues.received],\n        ['issued', 'Issued', counts.issued, kpiValues.issued],`);
tracking = tracking.replace('md:grid-cols-7', 'md:grid-cols-8');
fs.writeFileSync(trackingPath, tracking);

console.log('Order Issued workflow applied.');
