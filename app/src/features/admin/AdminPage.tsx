import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getOrderList } from '../../services/orderList.service';
import { getTestTrackingMeta } from '../../services/testTrackingMeta.service';
import { getStatusRowClasses } from '../../lib/statusRowStyles';

const pageSize = 10;

type SortKey = 'created_at' | 'order_type' | 'order_for' | 'branch' | 'order_no' | 'status' | 'qty' | 'value';

function formatMoney(value: number) {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['order-list-paged'], queryFn: getOrderList });
  const metaQuery = useQuery({
    queryKey: ['admin-order-register-meta', orders.map((order) => order.id).join('|')],
    queryFn: () => getTestTrackingMeta(orders.map((order) => order.id)),
    enabled: orders.length > 0,
  });
  const metaMap = metaQuery.data ?? {};

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const approved = orders.filter((order) => order.status === 'approved');
    const filtered = approved.filter((order) => !term || `${order.order_no} ${order.final_order_no ?? ''} ${order.branch} ${order.order_type} ${order.order_for} ${order.customer_name ?? ''} ${order.machine_no ?? ''} ${order.status}`.toLowerCase().includes(term));
    return [...filtered].sort((a, b) => {
      const aMeta = metaMap[a.id] ?? { totalQty: 0, totalValue: 0, commentCount: 0 };
      const bMeta = metaMap[b.id] ?? { totalQty: 0, totalValue: 0, commentCount: 0 };
      const getValue = (order: typeof a, meta: typeof aMeta): string | number => {
        if (sortKey === 'qty') return meta.totalQty;
        if (sortKey === 'value') return meta.totalValue;
        if (sortKey === 'created_at') return order.created_at ?? '';
        if (sortKey === 'order_type') return order.order_type ?? '';
        if (sortKey === 'order_for') return order.order_for ?? '';
        if (sortKey === 'branch') return order.branch ?? '';
        if (sortKey === 'order_no') return order.final_order_no || order.order_no || '';
        return order.status ?? '';
      };
      const av = getValue(a, aMeta);
      const bv = getValue(b, bMeta);
      const left = typeof av === 'number' ? av : av.toLowerCase();
      const right = typeof bv === 'number' ? bv : bv.toLowerCase();
      if (left < right) return sortDir === 'asc' ? -1 : 1;
      if (left > right) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [orders, search, sortKey, sortDir, metaMap]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleOrders = filteredOrders.slice((safePage - 1) * pageSize, safePage * pageSize);

  function updateSearch(value: string) {
    setSearch(value);
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

  const SortHead = ({ label, column, align = 'left' }: { label: string; column: SortKey; align?: 'left' | 'right' }) => (
    <button type="button" className={`font-black hover:text-[#0f4c81] ${align === 'right' ? 'w-full text-right' : ''}`} onClick={() => toggleSort(column)}>
      {label}{sortKey === column ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ' ▼'}
    </button>
  );

  return (
    <PageCard eyebrow="Admin" title="Order Register" description="Approved orders ready for admin processing.">
      <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <input className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5] lg:w-96" placeholder="Search order, branch, customer, machine" value={search} onChange={(event) => updateSearch(event.target.value)} />
        <p className="rounded-full border border-[#6b5b15] px-3 py-1 text-xs font-black text-white">Page {safePage} / {totalPages}</p>
      </div>

      {isLoading || metaQuery.isLoading ? <p className="mb-2 text-xs text-[#c7d2df]">Loading approved orders...</p> : null}

      <div className="overflow-hidden rounded-lg border border-[#263244]">
        <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
          <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]">
            <tr>
              <th className="px-2.5 py-2"><SortHead label="Date" column="created_at" /></th>
              <th className="px-2.5 py-2"><SortHead label="Order Type" column="order_type" /></th>
              <th className="px-2.5 py-2"><SortHead label="Order For" column="order_for" /></th>
              <th className="px-2.5 py-2"><SortHead label="Branch" column="branch" /></th>
              <th className="px-2.5 py-2 text-right"><SortHead label="Qty" column="qty" align="right" /></th>
              <th className="px-2.5 py-2 text-right"><SortHead label="Value" column="value" align="right" /></th>
              <th className="px-2.5 py-2"><SortHead label="Order No" column="order_no" /></th>
              <th className="px-2.5 py-2"><SortHead label="Status" column="status" /></th>
              <th className="px-2.5 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#263244] bg-[#111827]">
            {visibleOrders.map((order) => {
              const meta = metaMap[order.id] ?? { totalQty: 0, totalValue: 0, commentCount: 0 };
              return (
                <tr key={order.id} className={getStatusRowClasses(order.status)}>
                  <td className="px-2.5 py-2 text-[#d8e3ee]">{formatDate(order.created_at)}</td>
                  <td className="px-2.5 py-2"><span className="rounded-full bg-[#dbeafe] px-2.5 py-1 font-black text-[#0f4c81]">{order.order_type}</span></td>
                  <td className="px-2.5 py-2 text-white">{order.order_for === 'Customer' ? order.customer_name || 'Customer' : 'Stock'}</td>
                  <td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td>
                  <td className="px-2.5 py-2 text-right font-black text-white">{meta.totalQty}</td>
                  <td className="px-2.5 py-2 text-right font-black text-white">{formatMoney(meta.totalValue)}</td>
                  <td className="px-2.5 py-2 font-black text-white">{order.final_order_no || order.order_no}</td>
                  <td className="px-2.5 py-2"><StatusBadge status={order.status} /></td>
                  <td className="px-2.5 py-2 text-right"><Link className="text-xs font-black text-[#0f4c81] underline-offset-4 hover:underline" to={`/orders/${order.id}`}>Open</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredOrders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No approved orders pending for admin processing.</p> : null}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-[#c7d2df]">
        <span>Showing <b>{visibleOrders.length}</b> of <b>{filteredOrders.length}</b> orders</span>
        <div className="flex items-center gap-2">
          <button className="rounded-md border border-[#263244] px-4 py-2 font-black text-[#82C8E5] disabled:opacity-40" disabled={safePage <= 1} onClick={() => setPage((current) => current - 1)}>⬅ Prev</button>
          <span className="rounded-full border border-[#6b5b15] px-3 py-2 font-black text-white">Page {safePage} / {totalPages}</span>
          <button className="rounded-md border border-[#263244] px-4 py-2 font-black text-[#82C8E5] disabled:opacity-40" disabled={safePage >= totalPages} onClick={() => setPage((current) => current + 1)}>Next ➡</button>
        </div>
      </div>
    </PageCard>
  );
}
