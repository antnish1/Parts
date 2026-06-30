import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getTestOrders } from '../../services/testData.service';
import { getTestOrderItems } from '../../services/testOrderDetail.service';

export function TrackOrdersPage() {
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch = !term || `${order.order_no} ${order.branch} ${order.customer_name ?? ''} ${order.machine_no ?? ''}`.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);
  const selectedOrder = useMemo(() => orders.find((order) => order.id === selectedOrderId), [orders, selectedOrderId]);
  const { data: items = [] } = useQuery({
    queryKey: ['test-order-items', selectedOrderId],
    queryFn: () => getTestOrderItems(selectedOrderId),
    enabled: Boolean(selectedOrderId),
  });

  return (
    <PageCard eyebrow="Tracking" title="Track Orders" description="Reading only from test_orders and test_order_items. Live requests table is not used.">
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <input
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-pc-gold"
          placeholder="Search order, branch, customer, or machine"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-pc-gold"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All Status</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="pending_manager_approval">Pending Manager Approval</option>
          <option value="approved">Approved</option>
          <option value="processed">Processed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
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
            {filteredOrders.map((order) => (
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
        {filteredOrders.length === 0 ? <p className="p-4 text-sm text-pc-muted">No matching test orders found.</p> : null}
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
