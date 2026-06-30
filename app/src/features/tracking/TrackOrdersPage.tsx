import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getTestOrders } from '../../services/testData.service';
import { getTestOrderItems } from '../../services/testOrderDetail.service';

export function TrackOrdersPage() {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId), [orders, selectedOrderId]);
  const { data: items = [] } = useQuery({
    queryKey: ['test-order-items', selectedOrderId],
    queryFn: () => getTestOrderItems(selectedOrderId),
    enabled: Boolean(selectedOrderId),
  });

  return (
    <PageCard eyebrow="Tracking" title="Track Orders" description="Reading only from test_orders and test_order_items. Live requests table is not used.">
      {isLoading ? <p className="text-sm text-pc-muted">Loading test orders...</p> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase tracking-wider text-pc-muted">
            <tr>
              <th className="px-4 py-3">Order No</th>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">For</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
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
                <td className="px-4 py-3"><Button onClick={() => setSelectedOrderId(order.id)}>View</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 ? <p className="p-4 text-sm text-pc-muted">No test orders found. Run the safe seed file first.</p> : null}
      </div>
      {selectedOrder ? (
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="text-lg font-black text-white">{selectedOrder.order_no} Details</p>
          <p className="mt-1 text-sm text-pc-muted">{selectedOrder.branch} • {selectedOrder.order_type} • {selectedOrder.customer_name ?? '-'}</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="bg-slate-900 text-xs uppercase tracking-wider text-pc-muted">
                <tr>
                  <th className="px-4 py-3">Part No</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">DNP</th>
                  <th className="px-4 py-3">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-black text-white">{item.part_no}</td>
                    <td className="px-4 py-3 text-slate-300">{item.description ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-300">{item.qty}</td>
                    <td className="px-4 py-3 text-slate-300">{item.dnp ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-300">{item.value ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 ? <p className="p-4 text-sm text-pc-muted">No item rows found for this test order.</p> : null}
          </div>
        </div>
      ) : null}
    </PageCard>
  );
}
