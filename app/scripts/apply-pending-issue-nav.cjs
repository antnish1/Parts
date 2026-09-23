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

const stagedBranchCounter = `  const branchCreditDispatchCount = creditDispatches.filter((row) =>
    ['Correction Requested by Accounts', 'Correction Requested by Manager'].includes(row.approval_status) && normalizeBranch(row.branch) === branchKey,
  ).length;`;

const legacyBranchCounter = `  const branchCreditDispatchCount = creditDispatches.filter((row) =>
    row.approval_status === 'Correction Required' && normalizeBranch(row.branch) === branchKey,
  ).length;`;

const pendingIssueBlock = `

  const pendingIssueQuery = useQuery({
    queryKey: ['pending-issue-nav-count', profile?.role, profile?.branch],
    queryFn: getPendingIssueOrders,
    enabled: ['branch', 'admin', 'manager', 'developer', 'hq'].includes(profile?.role ?? ''),
    staleTime: 30000,
    refetchOnWindowFocus: true,
  });
  const pendingIssueCount = pendingIssueQuery.data?.length ?? 0;`;

if (!source.includes("queryKey: ['pending-issue-nav-count'")) {
  if (source.includes(stagedBranchCounter)) source = source.replace(stagedBranchCounter, stagedBranchCounter + pendingIssueBlock);
  else if (source.includes(legacyBranchCounter)) source = source.replace(legacyBranchCounter, legacyBranchCounter + pendingIssueBlock);
  else throw new Error('pending issue query marker not found');
}

replaceOnce(`      if (item.to === '/orders/delayed-vor') return { ...item, badge: delayedVorCount };`, `      if (item.to === '/orders/delayed-vor') return { ...item, badge: delayedVorCount };\n      if (item.to === '/orders/pending-issue') return { ...item, badge: pendingIssueCount };`, 'pending issue badge');

const stagedTadaDeps = `    [accountsCreditDispatchCount, accountsTadaCount, approvedOrdersCount, branchCreditDispatchCount, delayedVorCount, developerCreditDispatchCount, developerTadaCount, isAccounts, isAdmin, isBranch, isDeveloper, isManager, managerApprovalCount, managerCreditDispatchCount, managerTadaCount],`;
const stagedTadaDepsWithPending = `    [accountsCreditDispatchCount, accountsTadaCount, approvedOrdersCount, branchCreditDispatchCount, delayedVorCount, developerCreditDispatchCount, developerTadaCount, isAccounts, isAdmin, isBranch, isDeveloper, isManager, managerApprovalCount, managerCreditDispatchCount, managerTadaCount, pendingIssueCount],`;
const oldTadaDeps = `    [accountsTadaCount, approvedOrdersCount, branchCreditDispatchCount, delayedVorCount, developerTadaCount, isAccounts, isAdmin, isBranch, isDeveloper, isManager, managerApprovalCount, managerCreditDispatchCount, managerTadaCount],`;
const oldTadaDepsWithPending = `    [accountsTadaCount, approvedOrdersCount, branchCreditDispatchCount, delayedVorCount, developerTadaCount, isAccounts, isAdmin, isBranch, isDeveloper, isManager, managerApprovalCount, managerCreditDispatchCount, managerTadaCount, pendingIssueCount],`;

if (source.includes(stagedTadaDeps) || source.includes(stagedTadaDepsWithPending)) {
  replaceOnce(stagedTadaDeps, stagedTadaDepsWithPending, 'pending issue staged TA/DA memo deps');
} else if (source.includes(oldTadaDeps) || source.includes(oldTadaDepsWithPending)) {
  replaceOnce(oldTadaDeps, oldTadaDepsWithPending, 'pending issue TA/DA memo deps');
}

fs.writeFileSync(filePath, source);
console.log('Pending Issue navigation applied.');
