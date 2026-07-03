import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getTestOrders } from '../../services/testData.service';
import { getStatusRowClasses } from '../../lib/statusRowStyles';

const pageSize = 10;

export function TrackOrdersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });

  const counts = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((order) => order.status.includes('pending')).length,
    approved: orders.filter((order) => order.status === 'approved').length,
    processed: orders.filter((order) => order.status === 'processed').length,
    rejected: orders.filter((order) => order.status === 'rejected').length,
  }), [orders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const orderDate = order.created_at.slice(0, 10);
      const matchesSearch = !term || `${order.order_no} ${order.branch} ${order.customer_name ?? ''} ${order.machine_no ?? ''} ${order.order_type} ${order.status}`.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesFrom = !dateFrom || orderDate >= dateFrom;
      const matchesTo = !dateTo || orderDate <= dateTo;
      return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    });
  }, [orders, search, statusFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);

  function updateFilter(callback: () => void) {
    callback();
    setPage(1);
  }

  return (
    <PageCard eyebrow="Tracking" title="Track Orders" description="Order tracking workspace.">
      <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-5">
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Total</p><p className="text-sm font-black text-white">{counts.total}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Pending</p><p className="text-sm font-black text-white">{counts.pending}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Approved</p><p className="text-sm font-black text-white">{counts.approved}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Processed</p><p className="text-sm font-black text-white">{counts.processed}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Rejected</p><p className="text-sm font-black text-white">{counts.rejected}</p></div>
      </div>

      <div className="mb-2 grid gap-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
        <input className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Search order, branch, customer, machine, status" value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} />
        <select className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={statusFilter} onChange={(event) => updateFilter(() => setStatusFilter(event.target.value))}>
          <option value="all">All Status</option><option value="pending_approval">Pending Approval</option><option value="pending_manager_approval">Pending Manager Approval</option><option value="approved">Approved</option><option value="processed">Processed</option><option value="rejected">Rejected</option>
        </select>
        <input type="date" className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={dateFrom} onChange={(event) => updateFilter(() => setDateFrom(event.target.value))} />
        <input type="date" className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={dateTo} onChange={(event) => updateFilter(() => setDateTo(event.target.value))} />
      </div>

      {isLoading ? <p className="text-xs text-[#c7d2df]">Loading orders...</p> : null}
      <div className="overflow-hidden rounded-lg border border-[#263244]">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Order No</th><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Type</th><th className="px-2.5 py-2">For</th><th className="px-2.5 py-2">Customer</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-[#263244] bg-[#111827]">
            {visibleOrders.map((order) => (<tr key={order.id} className={getStatusRowClasses(order.status)}><td className="px-2.5 py-2 font-black leading-4 text-white">{order.order_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.order_type}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.order_for}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.customer_name ?? '-'}</td><td className="px-2.5 py-2"><StatusBadge status={order.status} /></td><td className="px-2.5 py-2 text-right"><Link className="text-xs font-black text-[#82C8E5] underline-offset-4 hover:underline" to={`/orders/${order.id}`}>View</Link></td></tr>))}
          </tbody>
        </table>
        {filteredOrders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No matching orders found.</p> : null}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-[#c7d2df]"><span>Showing {visibleOrders.length} of {filteredOrders.length}</span><div className="flex items-center gap-2"><button className="font-black text-[#82C8E5] disabled:opacity-40" disabled={safePage <= 1} onClick={() => setPage((current) => current - 1)}>Prev</button><span>{safePage} / {totalPages}</span><button className="font-black text-[#82C8E5] disabled:opacity-40" disabled={safePage >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
    </PageCard>
  );
}
