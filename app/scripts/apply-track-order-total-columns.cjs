const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'tracking', 'TrackOrdersPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');

content = content.replace("import { getTestTrackingMeta } from '../../services/testTrackingMeta.service';\n", '');

content = content.replace(
  "  const { data: orders = [], isLoading } = useQuery({ queryKey: ['order-list-paged', profile?.id, role, profile?.branch], queryFn: getOrderList });\n  const orderIdsKey = useMemo(() => orders.map((order) => order.id).join('|'), [orders]);\n  const metaQuery = useQuery({ queryKey: ['tracking-meta', profile?.id, role, profile?.branch, orderIdsKey], queryFn: () => getTestTrackingMeta(orders.map((order) => order.id)), enabled: orders.length > 0 });\n  const metaMap = metaQuery.data ?? {};",
  "  const { data: orders = [], isLoading } = useQuery({ queryKey: ['order-list-paged', profile?.id, role, profile?.branch], queryFn: getOrderList });\n  const metaMap = useMemo(() => orders.reduce<Record<string, { totalQty: number; totalValue: number; commentCount: number }>>((acc, order) => {\n    acc[order.id] = {\n      totalQty: Number(order.total_qty ?? 0),\n      totalValue: Number(order.total_value ?? 0),\n      commentCount: Number(order.comment_count ?? 0),\n    };\n    return acc;\n  }, {}), [orders]);"
);

fs.writeFileSync(filePath, content, 'utf8');

const inventoryPatch = path.join(__dirname, 'apply-central-branch-inventory-patch.cjs');
if (fs.existsSync(inventoryPatch)) require(inventoryPatch);
