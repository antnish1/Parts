import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getTestOrders } from '../../services/testData.service';

export function TrackOrdersPage() {
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['test-orders'],
    queryFn: getTestOrders,
  });

  return (
    <PageCard eyebrow="Tracking" title="Track Orders" description="Reading only from test_orders. Live requests table is not used.">
      {isLoading ? (
        <p className="text-sm text-pc-muted">Loading test orders...</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-slate-950 text-xs uppercase tracking-wider text-pc-muted">
              <tr>
                <th className="px-4 py-3">Order No</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">For</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/60">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-800/60">
                  <td className="px-4 py-3 font-black text-white">{order.order_no}</td>
                  <td className="px-4 py-3 text-slate-300">{order.branch}</td>
                  <td className="px-4 py-3 text-slate-300">{order.order_type}</td>
                  <td className="px-4 py-3 text-slate-300">{order.order_for}</td>
                  <td className="px-4 py-3 text-slate-300">{order.customer_name ?? '-'}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 ? <p className="p-4 text-sm text-pc-muted">No test orders found. Run the safe seed file first.</p> : null}
        </div>
      )}
    </PageCard>
  );
}
