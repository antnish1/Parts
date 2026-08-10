const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/layouts/AppLayout.tsx');
let source = fs.readFileSync(filePath, 'utf8');

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`${label} pattern not found`);
  source = source.replace(from, to);
}

replaceOnce(
  "import { getOrderList } from '../services/orderList.service';",
  "import { getOrderList } from '../services/orderList.service';\nimport { getDelayedVorEligibleOrderIds } from '../services/delayedVor.service';\nimport { getCreditDispatches } from '../services/creditDispatch.service';",
  'counter service imports',
);

replaceOnce(
  "export function AppLayout() {",
  `function normalizeBranch(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function isDelayedVorOrder(order: Awaited<ReturnType<typeof getOrderList>>[number], eligibleOrderIds: Set<string>) {
  const type = String(order.order_type ?? '').trim().toUpperCase();
  if (type !== 'VOR' || !eligibleOrderIds.has(String(order.id)) || !order.processed_date) return false;
  const processedAt = new Date(order.processed_date).getTime();
  if (!Number.isFinite(processedAt)) return false;
  return Math.floor((Date.now() - processedAt) / 86_400_000) > 3;
}

export function AppLayout() {`,
  'counter helpers',
);

replaceOnce(
  "  const isManager = profile?.role === 'manager';",
  "  const isManager = profile?.role === 'manager';\n  const isBranch = profile?.role === 'branch';",
  'branch role flag',
);

replaceOnce(
  "    enabled: isAdmin || isManager,",
  "    enabled: Boolean(profile),",
  'order counter enablement',
);

replaceOnce(
  `  const approvedOrdersCount = (adminCounterQuery.data ?? []).filter((order) => order.status === 'approved').length;
  const managerApprovalCount = (adminCounterQuery.data ?? []).filter((order) => \`\${order.status} \${order.approval_status}\`.toLowerCase().replace(/[^a-z]/g, '').includes('pendingmanagerapproval')).length;`,
  `  const delayedVorItemsQuery = useQuery({
    queryKey: ['delayed-vor-nav-item-status-orders'],
    queryFn: getDelayedVorEligibleOrderIds,
    enabled: Boolean(profile),
    refetchInterval: 15000,
  });

  const creditDispatchCounterQuery = useQuery({
    queryKey: ['credit-dispatch-nav-counter', profile?.role, profile?.branch],
    queryFn: getCreditDispatches,
    enabled: isManager || isBranch,
    refetchInterval: 15000,
  });

  const orders = adminCounterQuery.data ?? [];
  const eligibleDelayedVorOrderIds = new Set(delayedVorItemsQuery.data ?? []);
  const creditDispatches = creditDispatchCounterQuery.data ?? [];
  const approvedOrdersCount = orders.filter((order) => order.status === 'approved').length;
  const managerApprovalCount = orders.filter((order) => \`\${order.status} \${order.approval_status}\`.toLowerCase().replace(/[^a-z]/g, '').includes('pendingmanagerapproval')).length;
  const delayedVorCount = orders.filter((order) => isDelayedVorOrder(order, eligibleDelayedVorOrderIds)).length;
  const managerCreditDispatchCount = creditDispatches.filter((row) => row.approval_status === 'Pending Approval').length;
  const branchKey = normalizeBranch(profile?.branch);
  const branchCreditDispatchCount = creditDispatches.filter((row) =>
    row.approval_status === 'Correction Required' && normalizeBranch(row.branch) === branchKey,
  ).length;`,
  'counter calculations',
);

const tadaNavigationBlock = `      if (isAdmin && item.to === '/') return { ...item, label: 'Approved Orders', desktopLabel: 'Approved Orders', badge: approvedOrdersCount };
      if (isManager && item.to === '/approvals/pending') return { ...item, badge: managerApprovalCount };
      if (item.to === '/ta-da' && isManager && managerTadaCount > 0) return { ...item, badge: managerTadaCount };
      if (item.to === '/ta-da' && isAccounts && accountsTadaCount > 0) return { ...item, badge: accountsTadaCount };
      if (item.to === '/ta-da' && isDeveloper && developerTadaCount > 0) return { ...item, badge: developerTadaCount };
      return item;`;

const enhancedTadaNavigationBlock = `      if (isAdmin && item.to === '/') return { ...item, label: 'Approved Orders', desktopLabel: 'Approved Orders', badge: approvedOrdersCount };
      if (isManager && item.to === '/approvals/pending') return { ...item, badge: managerApprovalCount };
      if (item.to === '/orders/delayed-vor') return { ...item, badge: delayedVorCount };
      if (isManager && item.to === '/credit-dispatch') return { ...item, badge: managerCreditDispatchCount };
      if (isBranch && item.to === '/credit-dispatch') return { ...item, badge: branchCreditDispatchCount };
      if (item.to === '/ta-da' && isManager && managerTadaCount > 0) return { ...item, badge: managerTadaCount };
      if (item.to === '/ta-da' && isAccounts && accountsTadaCount > 0) return { ...item, badge: accountsTadaCount };
      if (item.to === '/ta-da' && isDeveloper && developerTadaCount > 0) return { ...item, badge: developerTadaCount };
      return item;`;

const legacyNavigationBlock = `      if (isAdmin && item.to === '/') return { ...item, label: 'Approved Orders', desktopLabel: 'Approved Orders', badge: approvedOrdersCount };
      if (isManager && item.to === '/approvals/pending') return { ...item, badge: managerApprovalCount };
      return item;`;

const enhancedLegacyNavigationBlock = `      if (isAdmin && item.to === '/') return { ...item, label: 'Approved Orders', desktopLabel: 'Approved Orders', badge: approvedOrdersCount };
      if (isManager && item.to === '/approvals/pending') return { ...item, badge: managerApprovalCount };
      if (item.to === '/orders/delayed-vor') return { ...item, badge: delayedVorCount };
      if (isManager && item.to === '/credit-dispatch') return { ...item, badge: managerCreditDispatchCount };
      if (isBranch && item.to === '/credit-dispatch') return { ...item, badge: branchCreditDispatchCount };
      return item;`;

if (source.includes(tadaNavigationBlock) || source.includes(enhancedTadaNavigationBlock)) {
  replaceOnce(tadaNavigationBlock, enhancedTadaNavigationBlock, 'TA/DA navigation badges');
} else {
  replaceOnce(legacyNavigationBlock, enhancedLegacyNavigationBlock, 'navigation badges');
}

const tadaMemoDeps = "    [accountsTadaCount, approvedOrdersCount, developerTadaCount, isAccounts, isAdmin, isDeveloper, isManager, managerApprovalCount, managerTadaCount],";
const enhancedTadaMemoDeps = "    [accountsTadaCount, approvedOrdersCount, branchCreditDispatchCount, delayedVorCount, developerTadaCount, isAccounts, isAdmin, isBranch, isDeveloper, isManager, managerApprovalCount, managerCreditDispatchCount, managerTadaCount],";
const legacyMemoDeps = "    [approvedOrdersCount, isAdmin, isManager, managerApprovalCount],";
const enhancedLegacyMemoDeps = "    [approvedOrdersCount, branchCreditDispatchCount, delayedVorCount, isAdmin, isBranch, isManager, managerApprovalCount, managerCreditDispatchCount],";

if (source.includes(tadaMemoDeps) || source.includes(enhancedTadaMemoDeps)) {
  replaceOnce(tadaMemoDeps, enhancedTadaMemoDeps, 'TA/DA memo dependencies');
} else {
  replaceOnce(legacyMemoDeps, enhancedLegacyMemoDeps, 'memo dependencies');
}

fs.writeFileSync(filePath, source);
console.log('Sidebar actionable counters applied.');
