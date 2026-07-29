import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClockAlert } from 'lucide-react';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getDelayedVorEligibleOrderIds } from '../../services/delayedVor.service';
import { getOrderList } from '../../services/orderList.service';

type Bucket = 'today' | '1-2' | '3-5' | '5+';

function elapsedDays(value: string | null | undefined) {
  if (!value) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000));
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function matchesBucket(days: number, bucket: Bucket) {
  if (bucket === 'today') return days === 0;
  if (bucket === '1-2') return days >= 1 && days <= 2;
  if (bucket === '3-5') return days >= 3 && days <= 5;
  return days > 5;
}

function ageLabel(days: number) {
  if (days === 0) return 'Today';
  return `${days} day${days === 1 ? '' : 's'}`;
}

export function DelayedVorPage() {
  const navigate = useNavigate();
  const [bucket, setBucket] = useState<Bucket>('today');
  const [search, setSearch] = useState('');
  const { data: orders = [], isLoading: ordersLoading, error: ordersError } = useQuery({ queryKey: ['delayed-vor-orders'], queryFn: getOrderList, refetchInterval: 30_000 });
  const { data: eligibleOrderIds = [], isLoading: itemsLoading, error: itemsError } = useQuery({ queryKey: ['delayed-vor-item-status-orders'], queryFn: getDelayedVorEligibleOrderIds, refetchInterval: 30_000 });

  const eligibleOrderIdSet = useMemo(() => new Set(eligibleOrderIds), [eligibleOrderIds]);
  const delayedOrders = useMemo(() => orders
    .filter((order) => String(order.order_type ?? '').trim().toUpperCase() === 'VOR')
    .filter((order) => eligibleOrderIdSet.has(String(order.id)))
    .map((order) => ({ order, days: elapsedDays(order.processed_date) })), [eligibleOrderIdSet, orders]);

  const counts = {
    today: delayedOrders.filter(({ days }) => days === 0).length,
    oneToTwo: delayedOrders.filter(({ days }) => days >= 1 && days <= 2).length,
    threeToFive: delayedOrders.filter(({ days }) => days >= 3 && days <= 5).length,
    overFive: delayedOrders.filter(({ days }) => days > 5).length,
  };

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return delayedOrders
      .filter(({ days }) => matchesBucket(days, bucket))
      .filter(({ order }) => !term || `${order.order_no} ${order.final_order_no ?? ''} ${order.branch} ${order.customer_name ?? ''} ${order.machine_no ?? ''}`.toLowerCase().includes(term))
      .sort((a, b) => b.days - a.days);
  }, [bucket, delayedOrders, search]);

  const isLoading = ordersLoading || itemsLoading;
  const error = ordersError || itemsError;

  const cards: Array<{ key: Bucket; label: string; count: number; activeClass: string; countClass: string }> = [
    { key: 'today', label: 'Today', count: counts.today, activeClass: 'border-[#82C8E5] bg-[#e6f4ff]', countClass: 'text-[#0f4c81]' },
    { key: '1-2', label: 'Pending 1–2 Days', count: counts.oneToTwo, activeClass: 'border-[#93c5fd] bg-[#eff6ff]', countClass: 'text-[#1d4ed8]' },
    { key: '3-5', label: 'Pending 3–5 Days', count: counts.threeToFive, activeClass: 'border-[#f0c36a] bg-[#fff8e7]', countClass: 'text-[#9a6700]' },
    { key: '5+', label: 'Pending More Than 5 Days', count: counts.overFive, activeClass: 'border-[#ef6f7b] bg-[#fff1f3]', countClass: 'text-[#b42318]' },
  ];

  return (
    <PageCard eyebrow="VOR Monitoring" title="Delayed VOR" description="VOR orders where at least one item row is Processed or Partially Dispatched, grouped by processing age.">
      <div className="mb-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            onClick={() => setBucket(card.key)}
            className={`rounded-xl border p-3 text-left ${bucket === card.key ? card.activeClass : 'border-[#d9dee7] bg-white'}`}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#667085]">{card.label}</p>
            <p className={`mt-1 text-xl font-black ${card.countClass}`}>{card.count}</p>
          </button>
        ))}
      </div>
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-[#d9dee7] bg-white px-3 py-2"><ClockAlert className="h-4 w-4 text-[#0f4c81]" /><input className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#0f172a] outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search order, branch, customer or machine" /></div>
      {isLoading ? <p className="text-xs text-[#667085]">Loading delayed VOR orders...</p> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">Could not load delayed VOR orders.</p> : null}
      <div className="overflow-x-auto rounded-lg border border-[#d9dee7] bg-white">
        <table className="w-full min-w-[960px] border-collapse text-left text-xs">
          <thead className="bg-[#f3f6fb] text-[10px] uppercase tracking-[0.12em] text-[#344054]"><tr><th className="px-3 py-2">Age</th><th className="px-3 py-2">Processed At</th><th className="px-3 py-2">Order No</th><th className="px-3 py-2">Branch</th><th className="px-3 py-2">Customer</th><th className="px-3 py-2">Machine</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody className="divide-y divide-[#e4e7ec]">
            {visibleOrders.map(({ order, days }) => <tr key={order.id} className="cursor-pointer bg-white transition hover:bg-[#f8fbff]" onClick={() => navigate(`/orders/${order.id}`)} title="Click to open order detail"><td className={`px-3 py-2 font-black ${days > 5 ? 'text-[#b42318]' : days >= 3 ? 'text-[#9a6700]' : 'text-[#0f4c81]'}`}>{ageLabel(days)}</td><td className="px-3 py-2 text-[#475569]">{formatDate(order.processed_date)}</td><td className="px-3 py-2 font-black text-[#0f172a]">{order.final_order_no || order.order_no}</td><td className="px-3 py-2 text-[#475569]">{order.branch}</td><td className="px-3 py-2 text-[#0f172a]">{order.customer_name || '-'}</td><td className="px-3 py-2 text-[#475569]">{order.machine_no || '-'}</td><td className="px-3 py-2"><StatusBadge status={order.status} /></td></tr>)}
          </tbody>
        </table>
        {!isLoading && visibleOrders.length === 0 ? <p className="p-4 text-center text-xs font-semibold text-[#667085]">No VOR orders in this aging category.</p> : null}
      </div>
    </PageCard>
  );
}
