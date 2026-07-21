const fs = require('fs');
const path = require('path');
const filePath = path.resolve(__dirname, '../src/layouts/AppLayout.tsx');
let source = fs.readFileSync(filePath, 'utf8');

const serviceImport = `import { getInstallationPendingCount } from '../services/installations.service';`;
if (!source.includes(serviceImport)) {
  const marker = `import { getOrderList } from '../services/orderList.service';`;
  if (source.includes(marker)) source = source.replace(marker, `${marker}\n${serviceImport}`);
  else console.warn('Installation counter import insertion point not found.');
}

const item = `  { to: '/installations', label: 'Installations', icon: Settings, desktopLabel: 'Engine Installations', desktopGroup: 'Operations', desktopOrder: 32 },`;
if (!source.includes(item)) {
  const preferred = `  { to: '/credit-dispatch', label: 'Credit Dispatch', icon: FileSignature, desktopIcon: Truck, desktopGroup: 'Operations', desktopOrder: 30 },`;
  const fallback = `  { to: '/docket-scanner', label: 'Docket', icon: ScanLine, desktopLabel: 'Docket Scanner', desktopGroup: 'Operations', desktopOrder: 31 },`;
  if (source.includes(preferred)) source = source.replace(preferred, `${preferred}\n${item}`);
  else if (source.includes(fallback)) source = source.replace(fallback, `${fallback}\n${item}`);
  else console.warn('Installation navigation insertion point not found.');
}

const queryBlock = `  const installationCounterQuery = useQuery({
    queryKey: ['installation-pending-count'],
    queryFn: getInstallationPendingCount,
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
  });

  const installationPendingCount = installationCounterQuery.data ?? 0;
`;
if (!source.includes(`queryKey: ['installation-pending-count']`)) {
  const marker = `  const approvedOrdersCount = (adminCounterQuery.data ?? []).filter((order) => order.status === 'approved').length;`;
  if (source.includes(marker)) source = source.replace(marker, `${queryBlock}\n${marker}`);
  else console.warn('Installation counter query insertion point not found.');
}

const badgeLine = `      if (item.to === '/installations') return { ...item, badge: installationPendingCount };`;
if (!source.includes(badgeLine)) {
  const marker = `      if (isAdmin && item.to === '/') return { ...item, label: 'Approved Orders', desktopLabel: 'Approved Orders', badge: approvedOrdersCount };`;
  if (source.includes(marker)) source = source.replace(marker, `${badgeLine}\n${marker}`);
  else console.warn('Installation badge mapping insertion point not found.');
}

const oldDeps = `    [approvedOrdersCount, isAdmin, isManager, managerApprovalCount],`;
const newDeps = `    [approvedOrdersCount, installationPendingCount, isAdmin, isManager, managerApprovalCount],`;
if (source.includes(oldDeps)) source = source.replace(oldDeps, newDeps);

fs.writeFileSync(filePath, source);
console.log('Installation navigation and pending counter applied.');
