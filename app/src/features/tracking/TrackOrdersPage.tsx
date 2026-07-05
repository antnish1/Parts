import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getOrderList } from '../../services/orderList.service';
import { getTestTrackingMeta } from '../../services/testTrackingMeta.service';
import { getStatusRowClasses } from '../../lib/statusRowStyles';
import { useAuth } from '../../auth/useAuth';

const pageSize = 10;
type SortKey = 'created_at' | 'order_no' | 'branch' | 'order_type' | 'customer_name' | 'status' | 'qty' | 'value' | 'comments';

function formatMoney(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export function TrackOrdersPage() {
  const { profile, role } = useAuth();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['order-list-paged', profile?.id, role, profile?.branch], queryFn: getOrderList });
  const metaQuery = useQuery({ queryKey: ['test-tracking-meta', profile?.id, role, profile?.branch, orders.map((order) => order.id).join('|')], queryFn: () => getTestTrackingMeta(orders.map((order) => order.id)), enabled: orders.length > 0 });
  const metaMap = metaQuery.data ?? {};

  const counts = useMemo(() => ({
    total: orders.length,
    pending: orders.filter((order) => order.status.includes('pending')).length,
    approved: orders.filter((order) => order.status === 'approved').length,
    processed: orders.filter((order) => order.status === 'processed').length,
    issued: orders.filter((order) => order.status === 'issued').length,
    received: orders.filter((order) => order.status === 'received').length,
    rejected: orders.filter((order) => order.status === 'rejected').length,
  }), [orders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = orders.filter((order) => {
      const orderDate = order.created_at.slice(0, 10);
      const meta = metaMap[order.id];
      const matchesSearch = !term || `${order.order_no} ${order.final_order_no ?? ''} ${order.branch} ${order.customer_name ?? ''} ${order.machine_no ?? ''} ${order.order_type} ${order.status} ${order.dbms_invoice_no ?? ''}`.toLowerCase().includes(term);
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'pending' ? order.status.includes('pending') : order.status === statusFilter);
      const matchesFrom = !dateFrom || orderDate >= dateFrom;
      const matchesTo = !dateTo || orderDate <= dateTo;
      return matchesSearch && matchesStatus && matchesFrom && matchesTo && (meta?.totalQty ?? 1) >= 0;
    });

    return [...filtered].sort((a, b) => {
      const aMeta = metaMap[a.id] ?? { totalQty: 0, totalValue: 0, commentCount: 0 };
      const bMeta = metaMap[b.id] ?? { totalQty: 0, totalValue: 0, commentCount: 0 };
      const av = sortKey === 'qty' ? aMeta.totalQty : sortKey === 'value' ? aMeta.totalValue : sortKey === 'comments' ? aMeta.commentCount : String(a[sortKey] ?? '').toLowerCase();
      const bv = sortKey === 'qty' ? bMeta.totalQty : sortKey === 'value' ? bMeta.totalValue : sortKey === 'comments' ? bMeta.commentCount : String(b[sortKey] ?? '').toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, search, statusFilter, dateFrom, dateTo, sortKey, sortDir, metaMap]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);

  function updateFilter(callback: () => void) {
    callback();
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    setPage(1);
    if (sortKey === key) setSortDir((current) => current === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(key);
      setSortDir(key === 'created_at' ? 'desc' : 'asc');
    }
  }

  const SortHead = ({ label, column }: { label: string; column: SortKey }) => <button type="button" className="font-black hover:text-white" onClick={() => toggleSort(column)}>{label}{sortKey === column ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}</button>;

  return (
    <PageCard eyebrow="Tracking" title="Track Orders" description="Order tracking workspace.">
      <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-7">
        <button className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5 text-left" onClick={() => updateFilter(() => setStatusFilter('all'))}><p className="text-[10px] uppercase text-[#6D8196]">Total</p><p className="text-sm font-black text-white">{counts.total}</p></button>
        <button className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5 text-left" onClick={() => updateFilter(() => setStatusFilter('pending'))}><p className="text-[10px] uppercase text-[#6D8196]">Pending</p><p className="text-sm font-black text-white">{counts.pending}</p></button>
        <button className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5 text-left" onClick={() => updateFilter(() => setStatusFilter('approved'))}><p className="text-[10px] uppercase text-[#6D8196]">Approved</p><p className="text-sm font-black text-white">{counts.approved}</p></button>
        <button className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5 text-left" onClick={() => updateFilter(() => setStatusFilter('processed'))}><p className="text-[10px] uppercase text-[#6D8196]">Processed</p><p className="text-sm font-black text-white">{counts.processed}</p></button>
        <button className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5 text-left" onClick={() => updateFilter(() => setStatusFilter('issued'))}><p className="text-[10px] uppercase text-[#6D8196]">Issued</p><p className="text-sm font-black text-white">{counts.issued}</p></button>
        <button className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5 text-left" onClick={() => updateFilter(() => setStatusFilter('received'))}><p className="text-[10px] uppercase text-[#6D8196]">Received</p><p className="text-sm font-black text-white">{counts.received}</p></button>
        <button className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5 text-left" onClick={() => updateFilter(() => setStatusFilter('rejected'))}><p className="text-[10px] uppercase text-[#6D8196]">Rejected</p><p className="text-sm font-black text-white">{counts.rejected}</p></button>
      </div>

      <div className="mb-2 grid gap-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]">
        <input className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Search order, final no, branch, customer, machine, invoice, status" value={search} onChange={(event) => updateFilter(() => setSearch(event.target.value))} />
        <select className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={statusFilter} onChange={(event) => updateFilter(() => setStatusFilter(event.target.value))}>
          <option value="all">All Status</option><option value="pending">All Pending</option><option value="pending_approval">Pending Approval</option><option value="pending_manager_approval">Pending Manager Approval</option><option value="approved">Approved</option><option value="processed">Processed</option><option value="issued">Issued</option><option value="received">Received</option><option value="rejected">Rejected</option>
        </select>
        <input type="date" className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={dateFrom} onChange={(event) => updateFilter(() => setDateFrom(event.target.value))} />
        <input type="date" className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={dateTo} onChange={(event) => updateFilter(() => setDateTo(event.target.value))} />
      </div>

      {isLoading || metaQuery.isLoading ? <p className="text-xs text-[#c7d2df]">Loading orders...</p> : null}
      <div className="overflow-hidden rounded-lg border border-[#263244]">
        <table className="w-full min-w-[980px] border-collapse text-left text-xs">
          <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2"><SortHead label="Order No" column="order_no" /></th><th className="px-2.5 py-2"><SortHead label="Branch" column="branch" /></th><th className="px-2.5 py-2"><SortHead label="Type" column="order_type" /></th><th className="px-2.5 py-2">For</th><th className="px-2.5 py-2"><SortHead label="Customer" column="customer_name" /></th><th className="px-2.5 py-2 text-right"><SortHead label="Qty" column="qty" /></th><th className="px-2.5 py-2 text-right"><SortHead label="Value" column="value" /></th><th className="px-2.5 py-2 text-right"><SortHead label="Comments" column="comments" /></th><th className="px-2.5 py-2"><SortHead label="Status" column="status" /></th><th className="px-2.5 py-2 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-[#263244] bg-[#111827]">
            {visibleOrders.map((order) => { const meta = metaMap[order.id] ?? { totalQty: 0, totalValue: 0, commentCount: 0 }; return (<tr key={order.id} className={getStatusRowClasses(order.status)}><td className="px-2.5 py-2 font-black leading-4 text-white"><div>{order.final_order_no || order.order_no}</div>{order.final_order_no ? <div className="text-[10px] font-normal text-[#6D8196]">Temp {order.order_no}</div> : null}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.order_type}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.order_for}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.customer_name ?? '-'}</td><td className="px-2.5 py-2 text-right font-black text-white">{meta.totalQty}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{formatMoney(meta.totalValue)}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{meta.commentCount}</td><td className="px-2.5 py-2"><StatusBadge status={order.status} /></td><td className="px-2.5 py-2 text-right"><Link className="text-xs font-black text-[#82C8E5] underline-offset-4 hover:underline" to={`/orders/${order.id}`}>View</Link></td></tr>); })}
          </tbody>
        </table>
        {filteredOrders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No matching orders found.</p> : null}
      </div>

      <div className="mt-2 flex items-center justify-between text-xs text-[#c7d2df]"><span>Showing {visibleOrders.length} of {filteredOrders.length}</span><div className="flex items-center gap-2"><button className="font-black text-[#82C8E5] disabled:opacity-40" disabled={safePage <= 1} onClick={() => setPage((current) => current - 1)}>Prev</button><span>{safePage} / {totalPages}</span><button className="font-black text-[#82C8E5] disabled:opacity-40" disabled={safePage >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div></div>
    </PageCard>
  );
}
