const fs = require('fs');
const path = require('path');
const filePath = path.resolve(__dirname, '../src/layouts/AppLayout.tsx');
let source = fs.readFileSync(filePath, 'utf8');

function replaceOnce(from, to, label) {
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`${label} marker not found`);
  source = source.replace(from, to);
}

replaceOnce(`  FilePlus2,\n  FileSignature,`, `  FilePlus2,\n  FileCheck2,\n  FileSignature,`, 'pending issue icon');
replaceOnce(`import { getOrderList } from '../services/orderList.service';`, `import { getOrderList } from '../services/orderList.service';\nimport { getPendingIssueOrders } from '../services/pendingIssue.service';`, 'pending issue service import');
replaceOnce(`  { to: '/orders/track', label: 'Track Orders', icon: PackageSearch, desktopIcon: ListOrdered, desktopGroup: 'Orders', desktopOrder: 11 },`, `  { to: '/orders/track', label: 'Track Orders', icon: PackageSearch, desktopIcon: ListOrdered, desktopGroup: 'Orders', desktopOrder: 11 },\n  { to: '/orders/pending-issue', label: 'Pending Issue', icon: FileCheck2, desktopGroup: 'Orders', desktopOrder: 12 },`, 'pending issue nav item');
source = source.replace(`  { to: '/orders/delayed-vor', label: 'Delayed VOR', icon: ClockAlert, desktopGroup: 'Orders', desktopOrder: 12 },`, `  { to: '/orders/delayed-vor', label: 'Delayed VOR', icon: ClockAlert, desktopGroup: 'Orders', desktopOrder: 13 },`);

replaceOnce(`  const branchCreditDispatchCount = creditDispatches.filter((row) =>\n    row.approval_status === 'Correction Required' && normalizeBranch(row.branch) === branchKey,\n  ).length;`, `  const branchCreditDispatchCount = creditDispatches.filter((row) =>\n    row.approval_status === 'Correction Required' && normalizeBranch(row.branch) === branchKey,\n  ).length;\n\n  const pendingIssueQuery = useQuery({\n    queryKey: ['pending-issue-nav-count', profile?.role, profile?.branch],\n    queryFn: getPendingIssueOrders,\n    enabled: ['branch', 'admin', 'manager', 'developer', 'hq'].includes(profile?.role ?? ''),\n    staleTime: 30000,\n    refetchOnWindowFocus: true,\n  });\n  const pendingIssueCount = pendingIssueQuery.data?.length ?? 0;`, 'pending issue query');
replaceOnce(`      if (item.to === '/orders/delayed-vor') return { ...item, badge: delayedVorCount };`, `      if (item.to === '/orders/delayed-vor') return { ...item, badge: delayedVorCount };\n      if (item.to === '/orders/pending-issue') return { ...item, badge: pendingIssueCount };`, 'pending issue badge');
replaceOnce(`    [approvedOrdersCount, branchCreditDispatchCount, delayedVorCount, isAdmin, isBranch, isManager, managerApprovalCount, managerCreditDispatchCount],`, `    [approvedOrdersCount, branchCreditDispatchCount, delayedVorCount, isAdmin, isBranch, isManager, managerApprovalCount, managerCreditDispatchCount, pendingIssueCount],`, 'pending issue memo deps');

fs.writeFileSync(filePath, source);
console.log('Pending Issue navigation applied.');
