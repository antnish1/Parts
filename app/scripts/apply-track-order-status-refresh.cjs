const fs = require('fs');
const path = require('path');

function patch(filePath, from, to, label) {
  let source = fs.readFileSync(filePath, 'utf8');
  if (source.includes(to)) return;
  if (!source.includes(from)) throw new Error(`${label} marker not found`);
  source = source.replace(from, to);
  fs.writeFileSync(filePath, source);
}

const trackPath = path.resolve(__dirname, '../src/features/tracking/TrackOrdersPage.tsx');
patch(
  trackPath,
  "  const { data: orders = [], isLoading } = useQuery({ queryKey: ['order-list-paged', profile?.id, role, profile?.branch], queryFn: getOrderList });",
  "  const { data: orders = [], isLoading } = useQuery({ queryKey: ['order-list-paged', profile?.id, role, profile?.branch], queryFn: getOrderList, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true });",
  'Track Orders query',
);

const correctionPath = path.resolve(__dirname, '../src/features/orders/OrderDataCorrectionPage.tsx');
patch(
  correctionPath,
  "      await queryClient.invalidateQueries({ queryKey: ['order-list-paged'] });",
  "      await queryClient.invalidateQueries({ queryKey: ['order-list-paged'] });\n      await queryClient.refetchQueries({ queryKey: ['order-list-paged'], type: 'all' });",
  'Order correction list refresh',
);

console.log('Track Orders status refresh applied.');
