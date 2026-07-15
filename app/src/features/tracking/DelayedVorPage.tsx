import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClockAlert } from 'lucide-react';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getOrderList } from '../../services/orderList.service';

type Bucket = '3-7' | '7+';

const delayedEligibleStatuses = new Set([
  'processed',
  'partial_dispatched',
  'partially_dispatched',
  'partial_received',
  'partially_received',
]);

function elapsedDays(value: string | null | undefined) {
  if (!value) return 0;
  return Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000);
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DelayedVorPage() {
  const navigate = useNavigate();
  const [bucket, setBucket] = useState<Bucket>('3-7');
  const [search, setSearch] = useState('');
  const { data: orders = [], isLoading, error } = useQuery({ queryKey: ['delayed-vor-orders'], queryFn: getOrderList, refetchInterval: 30_000 });

  const delayedOrders = useMemo(() => orders
    .filter((order) => String(order.order_type ?? '').trim().toUpperCase() === 'VOR')
    .filter((order) => delayedEligibleStatuses.has(String(order.status ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')))
    .map((order) => ({ order, days: elapsedDays(order.processed_date) }))
    .filter(({ days }) => days > 3), [orders]);

  const counts = {
    threeToSeven: delayedOrders.filter(({ days }) => days >= 4 && days <= 7).length,
    overSeven: delayedOrders.filter(({ days }) => days > 7).length,
  };

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return delayedOrders
      .filter(({ days }) => bucket === '3-7' ? days >= 4 && days <= 7 : days > 7)
      .filter(({ order }) => !term || `${order.order_no} ${order.final_order_no ?? ''} ${order.branch} ${order.customer_name ?? ''} ${order.machine_no ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => b.days - a.days);
  }, [bucket, delayedOrders, search]);

  return (
    <PageCard eyebrow="VOR Monitoring" title="Delayed VOR" description="Processed or partially fulfilled VOR orders pending beyond the allowed timeline.">
      <div className="mb-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => setBucket('3-7')} className={`rounded-xl border p-3 text-left ${bucket === '3-7' ? 'border-[#82C8E5] bg-[#e6f4ff]' : 'border-[#d9dee7] bg-white'}`}><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">Pending 3–7 Days</p><p className="mt-1 text-xl font-black text-[#0f172a]">{counts.threeToSeven}</p></button>
        <button type="button" onClick={() => setBucket('7+')} className={`rounded-xl border p-3 text-left ${bucket === '7+' ? 'border-[#ef6f7b] bg-[#fff1f3]' : 'border-[#d9dee7] bg-white'}`}><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">Pending Over 7 Days</p><p className="mt-1 text-xl font-black text-[#b42318]">{counts.overSeven}</p></button>
      </div>
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#d9dee7] bg-white px-3 py-2"><ClockAlert className="h-4 w-4 text-[#0f4c81]" /><input className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#0f172a] outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, branch, customer or machine" /></div>
      {isLoading ? <p className="text-xs text-[#667085]">Loading delayed VOR orders...</p> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">Could not load delayed VOR orders.</p> : null}
      <div className="overflow-x-auto rounded-lg border border-[#d9dee7] bg-white">
        <table className="w-full min-w-[960px] border-collapse text-left text-xs">
          <thead className="bg-[#f3f6fb] text-[10px] uppercase tracking-[0.12em] text-[#344054]"><tr><th className="px-3 py-2">Age</th><th className="px-3 py-2">Processed At</th><th className="px-3 py-2">Order No</th><th className="px-3 py-2">Branch</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Machine</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody className="divide-y divide-[#e4e7ec]">
            {visibleOrders.map(({ order, days }) => <tr key={order.id} className="cursor-pointer bg-white transition hover:bg-[#f8fbff]" onClick={() => navigate(`/orders/${order.id}`)} title="Click to open order detail"><td className={`px-3 py-2 font-black ${days > 7 ? 'text-[#b42318]' : 'text-[#0f4c81]'}`}>{days} days</td><td className="px-3 py-2 text-[#475569]">{formatDate(order.processed_date)}</td><td className="px-3 py-2 font-black text-[#0f172a]">{order.final_order_no || order.order_no}</td><td className="px-3 py-2 text-[#475569]">{order.branch}</td><td className="px-3 py-2 text-[#0f172a]">{order.customer_name || '-'}</td><td className="px-3 py-2 text-[#475569]">{order.machine_no || '-'}</td><td className="px-3 py-2"><StatusBadge status={order.status} /></td></tr>)}
          </tbody>
        </table>
        {!isLoading && visibleOrders.length === 0 ? <p className="p-4 text-center text-xs font-semibold text-[#667085]">No VOR orders in this aging category.</p> : null}
      </div>
    </PageCard>
  );
}
