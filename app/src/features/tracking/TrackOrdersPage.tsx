import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
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
  const { data: items = [] } = useQuery({ queryKey: ['test-order-items', selectedOrderId], queryFn: () => getTestOrderItems(selectedOrderId), enabled: Boolean(selectedOrderId) });

  return (
    <PageCard eyebrow="Tracking" title="Track Orders" description="Test order tracking workspace.">
      <div className="mb-2 grid gap-2 lg:grid-cols-2">
        <input className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Search order, branch, customer, or machine" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All Status</option>
          <option value="pending_approval">Pending Approval</option>
          <option value="pending_manager_approval">Pending Manager Approval</option>
          <option value="approved">Approved</option>
          <option value="processed">Processed</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>
      {isLoading ? <p className="text-xs text-[#c7d2df]">Loading test orders...</p> : null}
      <div className="overflow-hidden rounded-lg border border-[#263244]">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]">
            <tr>
              <th className="px-2.5 py-2">Order No</th>
              <th className="px-2.5 py-2">Branch</th>
              <th className="px-2.5 py-2">Type</th>
              <th className="px-2.5 py-2">For</th>
              <th className="px-2.5 py-2">Customer</th>
              <th className="px-2.5 py-2">Status</th>
              <th className="px-2.5 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#263244] bg-[#111827]">
            {filteredOrders.map((order) => (
              <tr key={order.id} className="hover:bg-[#182235]">
                <td className="px-2.5 py-2 font-black leading-4 text-white">{order.order_no}</td>
                <td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td>
                <td className="px-2.5 py-2 text-[#d8e3ee]">{order.order_type}</td>
                <td className="px-2.5 py-2 text-[#d8e3ee]">{order.order_for}</td>
                <td className="px-2.5 py-2 text-[#d8e3ee]">{order.customer_name ?? '-'}</td>
                <td className="px-2.5 py-2"><StatusBadge status={order.status} /></td>
                <td className="px-2.5 py-2 text-right"><button className="text-xs font-black text-[#82C8E5] underline-offset-4 hover:underline" onClick={() => setSelectedOrderId(order.id)}>View</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredOrders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No matching test orders found.</p> : null}
      </div>
      {selectedOrder ? (
        <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-2.5">
          <p className="text-sm font-black text-white">{selectedOrder.order_no} Details</p>
          <p className="mt-0.5 text-xs text-[#c7d2df]">{selectedOrder.branch} • {selectedOrder.order_type} • {selectedOrder.customer_name ?? '-'}</p>
          <div className="mt-2 overflow-hidden rounded-md border border-[#263244]">
            <table className="w-full min-w-[600px] border-collapse text-left text-xs">
              <thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-1.5">Part No</th><th className="px-2.5 py-1.5">Description</th><th className="px-2.5 py-1.5">Qty</th><th className="px-2.5 py-1.5">DNP</th><th className="px-2.5 py-1.5">Value</th></tr></thead>
              <tbody className="divide-y divide-[#263244]">{items.map((item) => (<tr key={item.id}><td className="px-2.5 py-1.5 font-black text-white">{item.part_no}</td><td className="px-2.5 py-1.5 text-[#d8e3ee]">{item.description ?? '-'}</td><td className="px-2.5 py-1.5 text-[#d8e3ee]">{item.qty}</td><td className="px-2.5 py-1.5 text-[#d8e3ee]">{item.dnp ?? '-'}</td><td className="px-2.5 py-1.5 text-[#d8e3ee]">{item.value ?? '-'}</td></tr>))}</tbody>
            </table>
            {items.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No item rows found for this test order.</p> : null}
          </div>
        </div>
      ) : null}
    </PageCard>
  );
}
