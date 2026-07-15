const fs = require('fs');
const path = require('path');

function patch(filePath, from, to, label) {
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`${label} marker not found`);
  source = source.replace(from, to);
  fs.writeFileSync(filePath, source);
}

function patchRegex(filePath, regex, to, label) {
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(to)) return;
  if (!regex.test(source)) throw new Error(`${label} marker not found`);
  source = source.replace(regex, to);
  fs.writeFileSync(filePath, source);
}

const trackingPath = path.resolve(__dirname, '../src/features/tracking/TrackOrdersPage.tsx');
patch(trackingPath, "import { searchOrderIdsByItem } from '../../services/orderItemSearch.service';", "import { searchOrderItemSummaries } from '../../services/orderItemSearchSummary.service';", 'track matched item summary import');
patch(
  trackingPath,
  "  const [searchParams] = useSearchParams();\n  const [search, setSearch] = useState(searchParams.get('q') ?? '');\n  const [statusFilter, setStatusFilter] = useState('all');\n  const [dateFrom, setDateFrom] = useState('');\n  const [dateTo, setDateTo] = useState('');\n  const [page, setPage] = useState(1);\n  const [sortKey, setSortKey] = useState<SortKey>('created_at');\n  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');",
  "  const [searchParams, setSearchParams] = useSearchParams();\n  const [search, setSearch] = useState(searchParams.get('q') ?? '');\n  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'all');\n  const [dateFrom, setDateFrom] = useState(searchParams.get('from') ?? '');\n  const [dateTo, setDateTo] = useState(searchParams.get('to') ?? '');\n  const [page, setPage] = useState(Number(searchParams.get('page') || 1));\n  const [sortKey, setSortKey] = useState<SortKey>((searchParams.get('sort') as SortKey) || 'created_at');\n  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(searchParams.get('dir') === 'asc' ? 'asc' : 'desc');",
  'track URL-backed filter state',
);
patchRegex(
  trackingPath,
  /  const normalizedSearch = search\.trim\(\);\n  const itemSearchQuery = useQuery\(\{ queryKey: \['track-order-item-search',[\s\S]*?const itemMatchOrderIds = useMemo\(\(\) => new Set\(itemSearchQuery\.data \?\? \[\]\), \[itemSearchQuery\.data\]\);/,
  "  const normalizedSearch = search.trim();\n  const itemSearchQuery = useQuery({ queryKey: ['track-order-item-search-summary', normalizedSearch.toLowerCase()], queryFn: () => searchOrderItemSummaries(normalizedSearch), enabled: normalizedSearch.length >= 2, staleTime: 30_000 });\n  const matchedItemSummaries = itemSearchQuery.data ?? {};\n  const itemMatchOrderIds = useMemo(() => new Set(Object.keys(matchedItemSummaries)), [matchedItemSummaries]);",
  'track matched item summary query',
);
patch(
  trackingPath,
  "  useEffect(() => { setSearch(searchParams.get('q') ?? ''); setPage(1); }, [searchParams]);",
  "  useEffect(() => {\n    setSearch(searchParams.get('q') ?? '');\n    setStatusFilter(searchParams.get('status') ?? 'all');\n    setDateFrom(searchParams.get('from') ?? '');\n    setDateTo(searchParams.get('to') ?? '');\n    setPage(Number(searchParams.get('page') || 1));\n    setSortKey((searchParams.get('sort') as SortKey) || 'created_at');\n    setSortDir(searchParams.get('dir') === 'asc' ? 'asc' : 'desc');\n  }, [searchParams]);\n\n  useEffect(() => {\n    const next = new URLSearchParams();\n    if (search) next.set('q', search);\n    if (statusFilter !== 'all') next.set('status', statusFilter);\n    if (dateFrom) next.set('from', dateFrom);\n    if (dateTo) next.set('to', dateTo);\n    if (page > 1) next.set('page', String(page));\n    if (sortKey !== 'created_at') next.set('sort', sortKey);\n    if (sortDir !== 'desc') next.set('dir', sortDir);\n    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });\n  }, [search, statusFilter, dateFrom, dateTo, page, sortKey, sortDir, searchParams, setSearchParams]);\n\n  function getVisibleTrackingMeta(order: TestOrder, itemMeta?: TrackingMeta): TrackingMeta {\n    const base = getTrackingMeta(order, itemMeta);\n    const matched = normalizedSearch.length >= 2 ? matchedItemSummaries[order.id] : undefined;\n    return matched ? { ...base, totalQty: matched.qty, totalValue: matched.value } : base;\n  }",
  'track URL sync and matched metrics',
);
patchRegex(
  trackingPath,
  /  const counts = useMemo\([\s\S]*?\n  \}, \[orders, metaMap\]\);/,
  "  const counts = useMemo(() => {\n    const statuses = orders.map((order) => getTrackingMeta(order, metaMap[order.id]).resolvedStatus || order.status);\n    return { total: orders.length, pending: statuses.filter((status) => status.includes('pending')).length, approved: statuses.filter((status) => status === 'approved').length, processed: statuses.filter((status) => status === 'processed').length, dispatched: statuses.filter((status) => status === 'dispatched').length, received: statuses.filter((status) => status === 'received').length, rejected: statuses.filter((status) => status === 'rejected').length };\n  }, [orders, metaMap]);\n\n  const kpiValues = useMemo(() => {\n    const totals = { all: 0, pending: 0, approved: 0, processed: 0, dispatched: 0, received: 0, rejected: 0 };\n    orders.forEach((order) => {\n      const meta = getTrackingMeta(order, metaMap[order.id]);\n      const status = meta.resolvedStatus || order.status;\n      totals.all += meta.totalValue;\n      if (status.includes('pending')) totals.pending += meta.totalValue;\n      if (status === 'approved') totals.approved += meta.totalValue;\n      if (status === 'processed') totals.processed += meta.totalValue;\n      if (status === 'dispatched') totals.dispatched += meta.totalValue;\n      if (status === 'received') totals.received += meta.totalValue;\n      if (status === 'rejected') totals.rejected += meta.totalValue;\n    });\n    return totals;\n  }, [orders, metaMap]);",
  'track KPI values',
);
patchRegex(
  trackingPath,
  /<div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-7">[\s\S]*?<\/div>\n      <div className="mb-2 grid grid-cols-2 gap-2 lg:grid-cols-/,
  `<div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-7">{[\n        ['all', 'Total', counts.total, kpiValues.all],\n        ['pending', 'Pending', counts.pending, kpiValues.pending],\n        ['approved', 'Approved', counts.approved, kpiValues.approved],\n        ['processed', 'Processed', counts.processed, kpiValues.processed],\n        ['dispatched', 'Dispatched', counts.dispatched, kpiValues.dispatched],\n        ['received', 'Received', counts.received, kpiValues.received],\n        ['rejected', 'Rejected', counts.rejected, kpiValues.rejected],\n      ].map(([key, label, count, value]) => (\n        <button key={String(key)} type="button" className="pc-kpi-card rounded-md px-2 py-1.5 text-left" data-active={statusFilter === String(key)} onClick={() => updateFilter(() => setStatusFilter(String(key)))}>\n          <p className="pc-kpi-label text-[10px] uppercase">{label}</p>\n          <p className="pc-kpi-count text-sm font-bold">{count}</p>\n          <p className="pc-kpi-value absolute bottom-1 right-2 text-[9px] font-semibold">{formatMoney(Number(value))}</p>\n        </button>\n      ))}</div>\n      <div className="mb-2 grid grid-cols-2 gap-2 lg:grid-cols-`,
  'track interactive KPI cards',
);
patchRegex(trackingPath, /getTrackingMeta\(order, metaMap\[order\.id\]\)/g, 'getVisibleTrackingMeta(order, metaMap[order.id])', 'track visible matched metrics');

const approvalsPath = path.resolve(__dirname, '../src/features/approvals/ApprovalsPage.tsx');
patch(approvalsPath, "import { useMemo, useState } from 'react';", "import { useEffect, useMemo, useState } from 'react';", 'approval effect import');
patch(approvalsPath, "import { useNavigate, useParams } from 'react-router-dom';", "import { useNavigate, useParams, useSearchParams } from 'react-router-dom';", 'approval search params import');
patch(
  approvalsPath,
  "  const [message, setMessage] = useState('');\n  const [search, setSearch] = useState('');",
  "  const [searchParams, setSearchParams] = useSearchParams();\n  const [message, setMessage] = useState('');\n  const [search, setSearch] = useState(searchParams.get('q') ?? '');\n  const [queueFilter, setQueueFilter] = useState(searchParams.get('queue') ?? 'all');",
  'approval persistent search state',
);
patch(
  approvalsPath,
  "  const pendingOrders = useMemo(",
  "  useEffect(() => {\n    const next = new URLSearchParams();\n    if (search) next.set('q', search);\n    if (queueFilter !== 'all') next.set('queue', queueFilter);\n    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });\n  }, [search, queueFilter, searchParams, setSearchParams]);\n\n  const pendingOrders = useMemo(",
  'approval URL sync',
);
patch(approvalsPath, "    if (!term) return pendingOrders;", "    const queueOrders = queueFilter === 'manager' ? pendingOrders.filter(isManagerApprovalStage) : queueFilter === 'pending' ? pendingOrders.filter((order) => !isManagerApprovalStage(order)) : pendingOrders;\n    if (!term) return queueOrders;", 'approval KPI filter source');
patch(approvalsPath, "    return pendingOrders.filter((order) => {", "    return queueOrders.filter((order) => {", 'approval search filtered source');
patch(approvalsPath, "  }, [pendingOrders, search]);", "  }, [pendingOrders, search, queueFilter]);", 'approval filtered dependencies');
patch(
  approvalsPath,
  "  const isBlockingAction = !!busyId;",
  "  const approvalKpiValues = useMemo(() => {\n    const pending = pendingOrders.filter((order) => !isManagerApprovalStage(order));\n    const manager = pendingOrders.filter(isManagerApprovalStage);\n    const totalValue = (rows: OrderRow[]) => rows.reduce((sum, order) => sum + getOrderTotalValue(order), 0);\n    return { pending: totalValue(pending), manager: totalValue(manager), all: totalValue(pendingOrders), showing: totalValue(filteredOrders) };\n  }, [pendingOrders, filteredOrders]);\n\n  const isBlockingAction = !!busyId;",
  'approval KPI values',
);
patchRegex(
  approvalsPath,
  /<div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">[\s\S]*?<\/div>\n\n      <div className="mb-2 flex/,
  `<div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">{[\n        ['pending', 'Pending', counts.pending, approvalKpiValues.pending],\n        ['manager', 'Manager', counts.manager, approvalKpiValues.manager],\n        ['all', 'Queue', counts.approved, approvalKpiValues.all],\n        ['all', 'Showing', counts.rejected, approvalKpiValues.showing],\n      ].map(([key, label, count, value]) => (\n        <button key={String(label)} type="button" className="pc-kpi-card rounded-md px-2 py-1.5 text-left" data-active={queueFilter === String(key) && String(label) !== 'Showing'} onClick={() => setQueueFilter(String(key))}>\n          <p className="pc-kpi-label text-[10px] uppercase">{label}</p>\n          <p className="pc-kpi-count text-sm font-bold">{count}</p>\n          <p className="pc-kpi-value absolute bottom-1 right-2 text-[9px] font-semibold">{formatMoney(Number(value))}</p>\n        </button>\n      ))}</div>\n\n      <div className="mb-2 flex`,
  'approval interactive KPI cards',
);

const persistentSearchPages = [
  ['../src/features/admin/AdminPage.tsx', 'admin-global-search'],
  ['../src/features/tracking/DelayedVorPage.tsx', 'delayed-vor-search'],
  ['../src/features/credit-dispatch/CreditCustomersPage.tsx', 'credit-customers-search'],
  ['../src/features/credit-dispatch/CreditAgingPage.tsx', 'credit-aging-search'],
  ['../src/features/credit-dispatch/RequestReportsPage.tsx', 'credit-reports-search'],
];
for (const [relativePath, key] of persistentSearchPages) {
  const filePath = path.resolve(__dirname, relativePath);
  if (!fs.existsSync(filePath)) continue;
  let source = fs.readFileSync(filePath, 'utf8');
  if (!source.includes("../../hooks/usePersistentPageState")) {
    const importMarker = source.match(/import[^\n]+from ['\"]\.\.\/\.\.\/[^'\"]+['\"];\n/);
    if (importMarker) source = source.replace(importMarker[0], `${importMarker[0]}import { usePersistentPageState } from '../../hooks/usePersistentPageState';\n`);
  }
  source = source.replace("const [search, setSearch] = useState('');", `const [search, setSearch] = usePersistentPageState('${key}');`);
  fs.writeFileSync(filePath, source);
}

console.log('Search persistence, matched item totals, and KPI interactions applied.');
