const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/features/tracking/TrackOrdersPage.tsx');
let source = fs.readFileSync(filePath, 'utf8');

function patch(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`${label} marker not found`);
  source = source.replace(from, to);
}

patch(
  "    searchText: itemMeta?.searchText ?? '',\n  };",
  "    searchText: itemMeta?.searchText ?? '',\n    resolvedStatus: itemMeta?.resolvedStatus || order.status,\n  };",
  'tracking meta resolved status',
);

patch(
  "  const counts = useMemo(() => ({ total: orders.length, pending: orders.filter((order) => order.status.includes('pending')).length, approved: orders.filter((order) => order.status === 'approved').length, processed: orders.filter((order) => order.status === 'processed').length, dispatched: orders.filter((order) => order.status === 'dispatched').length, received: orders.filter((order) => order.status === 'received').length, rejected: orders.filter((order) => order.status === 'rejected').length }), [orders]);",
  "  const counts = useMemo(() => {\n    const statuses = orders.map((order) => getTrackingMeta(order, metaMap[order.id]).resolvedStatus || order.status);\n    return { total: orders.length, pending: statuses.filter((status) => status.includes('pending')).length, approved: statuses.filter((status) => status === 'approved').length, processed: statuses.filter((status) => status === 'processed').length, dispatched: statuses.filter((status) => status === 'dispatched').length, received: statuses.filter((status) => status === 'received').length, rejected: statuses.filter((status) => status === 'rejected').length };\n  }, [orders, metaMap]);",
  'tracking counts',
);

patch(
  "      const matchesSearch = !term || `${order.order_no} ${order.final_order_no ?? ''} ${order.branch} ${getOrderForLabel(order)} ${order.customer_name ?? ''} ${order.machine_no ?? ''} ${order.order_type} ${order.status} ${order.dbms_invoice_no ?? ''} ${meta.searchText ?? ''}`.toLowerCase().includes(term);\n      const matchesStatus = statusFilter === 'all' || (statusFilter === 'pending' ? order.status.includes('pending') : order.status === statusFilter);",
  "      const resolvedStatus = meta.resolvedStatus || order.status;\n      const matchesSearch = !term || `${order.order_no} ${order.final_order_no ?? ''} ${order.branch} ${getOrderForLabel(order)} ${order.customer_name ?? ''} ${order.machine_no ?? ''} ${order.order_type} ${resolvedStatus} ${order.dbms_invoice_no ?? ''} ${meta.searchText ?? ''}`.toLowerCase().includes(term);\n      const matchesStatus = statusFilter === 'all' || (statusFilter === 'pending' ? resolvedStatus.includes('pending') : resolvedStatus === statusFilter);",
  'tracking search and filter status',
);

patch(
  "      const av = sortKey === 'qty' ? aMeta.totalQty : sortKey === 'value' ? aMeta.totalValue : sortKey === 'comments' ? aMeta.commentCount : String(a[sortKey] ?? '').toLowerCase();\n      const bv = sortKey === 'qty' ? bMeta.totalQty : sortKey === 'value' ? bMeta.totalValue : sortKey === 'comments' ? bMeta.commentCount : String(b[sortKey] ?? '').toLowerCase();",
  "      const av = sortKey === 'qty' ? aMeta.totalQty : sortKey === 'value' ? aMeta.totalValue : sortKey === 'comments' ? aMeta.commentCount : sortKey === 'status' ? (aMeta.resolvedStatus || a.status) : String(a[sortKey] ?? '').toLowerCase();\n      const bv = sortKey === 'qty' ? bMeta.totalQty : sortKey === 'value' ? bMeta.totalValue : sortKey === 'comments' ? bMeta.commentCount : sortKey === 'status' ? (bMeta.resolvedStatus || b.status) : String(b[sortKey] ?? '').toLowerCase();",
  'tracking status sort',
);

patch(
  '<StatusBadge status={order.status} />',
  '<StatusBadge status={meta.resolvedStatus || order.status} />',
  'mobile status badge',
);

patch(
  'className={`${getStatusRowClasses(order.status)} cursor-pointer transition hover:brightness-110`}',
  'className={`${getStatusRowClasses(meta.resolvedStatus || order.status)} cursor-pointer transition hover:brightness-110`}',
  'desktop row status class',
);

patch(
  '<td className="px-2.5 py-2"><StatusBadge status={order.status} /></td>',
  '<td className="px-2.5 py-2"><StatusBadge status={meta.resolvedStatus || order.status} /></td>',
  'desktop status badge',
);

fs.writeFileSync(filePath, source);
console.log('Track Orders canonical status applied.');
