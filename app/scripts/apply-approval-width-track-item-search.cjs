const fs = require('fs');
const path = require('path');

function patchFile(filePath, replacements) {
  let source = fs.readFileSync(filePath, 'utf8');
  for (const { from, to, label } of replacements) {
    if (source.includes(to)) continue;
    if (!source.includes(from)) throw new Error(`${label} marker not found`);
    source = source.replace(from, to);
  }
  fs.writeFileSync(filePath, source);
}

const approvalsPath = path.resolve(__dirname, '../src/features/approvals/ApprovalsPage.tsx');
patchFile(approvalsPath, [
  {
    from: '<div className="overflow-hidden rounded-lg border border-[#263244]">\n        <table className="w-full min-w-[1280px] border-collapse text-left text-xs">',
    to: '<div className="approval-queue-table overflow-hidden rounded-lg border border-[#263244]">\n        <table className="w-full table-fixed border-collapse text-left text-xs">',
    label: 'approval queue fixed table',
  },
]);

const trackingPath = path.resolve(__dirname, '../src/features/tracking/TrackOrdersPage.tsx');
patchFile(trackingPath, [
  {
    from: "import { getTestTrackingMeta, type TrackingMeta } from '../../services/testTrackingMeta.service';",
    to: "import { getTestTrackingMeta, type TrackingMeta } from '../../services/testTrackingMeta.service';\nimport { searchOrderIdsByItem } from '../../services/orderItemSearch.service';",
    label: 'Track Orders item search import',
  },
  {
    from: '  const metaMap = metaQuery.data ?? {};',
    to: "  const metaMap = metaQuery.data ?? {};\n  const normalizedSearch = search.trim();\n  const itemSearchQuery = useQuery({ queryKey: ['track-order-item-search', normalizedSearch.toLowerCase()], queryFn: () => searchOrderIdsByItem(normalizedSearch), enabled: normalizedSearch.length >= 2, staleTime: 30_000 });\n  const itemMatchOrderIds = useMemo(() => new Set(itemSearchQuery.data ?? []), [itemSearchQuery.data]);",
    label: 'Track Orders item search query',
  },
  {
    from: "      const matchesSearch = !term || `${order.order_no} ${order.final_order_no ?? ''} ${order.branch} ${getOrderForLabel(order)} ${order.customer_name ?? ''} ${order.machine_no ?? ''} ${order.order_type} ${resolvedStatus} ${order.dbms_invoice_no ?? ''} ${meta.searchText ?? ''}`.toLowerCase().includes(term);",
    to: "      const matchesSearch = !term || `${order.order_no} ${order.final_order_no ?? ''} ${order.branch} ${getOrderForLabel(order)} ${order.customer_name ?? ''} ${order.machine_no ?? ''} ${order.order_type} ${resolvedStatus} ${order.dbms_invoice_no ?? ''} ${meta.searchText ?? ''}`.toLowerCase().includes(term) || itemMatchOrderIds.has(order.id);",
    label: 'Track Orders item search match',
  },
  {
    from: '  }, [orders, search, statusFilter, dateFrom, dateTo, sortKey, sortDir, metaMap]);',
    to: '  }, [orders, search, statusFilter, dateFrom, dateTo, sortKey, sortDir, metaMap, itemMatchOrderIds]);',
    label: 'Track Orders item search dependency',
  },
]);

console.log('Approval width and Track Orders item search applied.');
