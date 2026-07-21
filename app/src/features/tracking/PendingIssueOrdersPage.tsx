import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileCheck2, Search, X } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';
import { PageCard } from '../../components/ui/PageCard';
import { issuedDocumentTypes, markOrderIssued, type IssuedDocumentType } from '../../services/orderIssue.service';
import { getPendingIssueOrders, type PendingIssueOrder } from '../../services/pendingIssue.service';

function money(value: number) { return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function dateLabel(value: string | null) { return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }
function ageLabel(days: number) { return days === 0 ? 'Today' : `${days} Day${days === 1 ? '' : 's'}`; }

type AgeFilter = 'all' | '0-2' | '3-7' | 'over-7';

export function PendingIssueOrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<PendingIssueOrder | null>(null);
  const [documentType, setDocumentType] = useState<IssuedDocumentType>('DC');
  const [documentNo, setDocumentNo] = useState('');
  const [message, setMessage] = useState('');

  const search = params.get('q') ?? '';
  const age = (params.get('age') ?? 'all') as AgeFilter;
  const type = params.get('type') ?? 'all';
  const branch = params.get('branch') ?? 'all';

  const query = useQuery({ queryKey: ['pending-issue-orders'], queryFn: getPendingIssueOrders, staleTime: 30000, refetchOnWindowFocus: true });
  const orders = query.data ?? [];
  const branches = useMemo(() => [...new Set(orders.map((order) => order.branch))].sort(), [orders]);
  const isBranch = role === 'branch';

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesSearch = !needle || [order.order_no, order.final_order_no, order.branch, order.customer_name, order.contact_no, order.machine_no, order.call_id]
        .some((value) => String(value ?? '').toLowerCase().includes(needle));
      const matchesAge = age === 'all' || (age === '0-2' && order.age_days <= 2) || (age === '3-7' && order.age_days >= 3 && order.age_days <= 7) || (age === 'over-7' && order.age_days > 7);
      const matchesType = type === 'all' || order.order_type.toLowerCase() === type;
      const matchesBranch = branch === 'all' || order.branch === branch;
      return matchesSearch && matchesAge && matchesType && matchesBranch;
    });
  }, [age, branch, orders, search, type]);

  const totals = useMemo(() => {
    const calculate = (rows: PendingIssueOrder[]) => ({ count: rows.length, value: rows.reduce((sum, order) => sum + order.total_value, 0) });
    return {
      all: calculate(orders),
      '0-2': calculate(orders.filter((order) => order.age_days <= 2)),
      '3-7': calculate(orders.filter((order) => order.age_days >= 3 && order.age_days <= 7)),
      'over-7': calculate(orders.filter((order) => order.age_days > 7)),
      vor: calculate(orders.filter((order) => order.order_type.toLowerCase() === 'vor')),
      sop: calculate(orders.filter((order) => order.order_type.toLowerCase() === 'sop')),
    };
  }, [orders]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
    setParams(next, { replace: true });
  }

  const issueMutation = useMutation({
    mutationFn: () => markOrderIssued(selected!.id, documentType, documentNo),
    onSuccess: async () => {
      setMessage(`${selected?.order_no} marked as Issued.`);
      setSelected(null); setDocumentNo('');
      await queryClient.invalidateQueries({ queryKey: ['pending-issue-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['pending-issue-nav-count'] });
      await queryClient.invalidateQueries({ queryKey: ['order-list-paged'] });
      await query.refetch();
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not mark order as issued.'),
  });

  const cards: Array<{ key: string; label: string; data: { count: number; value: number }; onClick: () => void; active: boolean }> = [
    { key: 'all', label: 'Total Pending', data: totals.all, onClick: () => { updateParam('age', 'all'); updateParam('type', 'all'); }, active: age === 'all' && type === 'all' },
    { key: '0-2', label: 'Pending 0–2 Days', data: totals['0-2'], onClick: () => updateParam('age', '0-2'), active: age === '0-2' },
    { key: '3-7', label: 'Pending 3–7 Days', data: totals['3-7'], onClick: () => updateParam('age', '3-7'), active: age === '3-7' },
    { key: 'over-7', label: 'Pending Over 7 Days', data: totals['over-7'], onClick: () => updateParam('age', 'over-7'), active: age === 'over-7' },
    { key: 'vor', label: 'VOR Orders', data: totals.vor, onClick: () => updateParam('type', 'vor'), active: type === 'vor' },
    { key: 'sop', label: 'SOP Orders', data: totals.sop, onClick: () => updateParam('type', 'sop'), active: type === 'sop' },
  ];

  return (
    <PageCard eyebrow="Operations" title="Pending Issue Orders" description="">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => <button key={card.key} type="button" onClick={card.onClick} className={`relative min-h-[84px] overflow-hidden rounded-lg border p-3 text-left transition-all ${card.active ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white shadow-lg ring-2 ring-[#f2c300]/40' : 'border-[#d5deea] bg-[#f8fafc] text-[#0f172a] hover:-translate-y-0.5 hover:border-[#0f5fa8]'}`}>
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${card.active ? 'text-[#dce8f5]' : 'text-[#64748b]'}`}>{card.label}</span>
          <strong className="mt-1 block text-xl">{card.data.count}</strong>
          <span className={`absolute bottom-2 right-3 text-[10px] font-semibold ${card.active ? 'text-[#f8d94e]' : 'text-[#334155]'}`}>{money(card.data.value)}</span>
        </button>)}
      </div>

      <div className="mt-3 grid gap-2 rounded-lg border border-[#d8e0ea] bg-[#f8fafc] p-2 md:grid-cols-[minmax(240px,1fr)_160px_170px_170px]">
        <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748b]" /><input value={search} onChange={(event) => updateParam('q', event.target.value)} className="h-9 w-full rounded-md border border-[#cbd5e1] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#0f5fa8]" placeholder="Search order, customer, mobile, machine or call ID" /></label>
        <select value={type} onChange={(event) => updateParam('type', event.target.value)} className="h-9 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"><option value="all">All Types</option><option value="vor">VOR</option><option value="sop">SOP</option></select>
        <select value={age} onChange={(event) => updateParam('age', event.target.value)} className="h-9 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"><option value="all">All Aging</option><option value="0-2">0–2 Days</option><option value="3-7">3–7 Days</option><option value="over-7">Over 7 Days</option></select>
        {!isBranch ? <select value={branch} onChange={(event) => updateParam('branch', event.target.value)} className="h-9 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"><option value="all">All Branches</option>{branches.map((name) => <option key={name} value={name}>{name}</option>)}</select> : <div className="hidden md:block" />}
      </div>

      {message ? <div className="mt-2 flex items-center justify-between rounded-md border border-[#b9d5ef] bg-[#eef7ff] px-3 py-2 text-xs text-[#0b4d8a]"><span>{message}</span><button type="button" onClick={() => setMessage('')}><X className="h-4 w-4" /></button></div> : null}
      {query.error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load pending issue orders.</p> : null}

      <div className="mt-3 overflow-hidden rounded-lg border border-[#d8e0ea] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-left text-xs">
            <thead className="bg-[#eaf0f6] text-[10px] uppercase tracking-wide text-[#334155]"><tr><th className="w-[76px] px-3 py-2">Age</th><th className="w-[126px] px-3 py-2">Received</th><th className="w-[145px] px-3 py-2">Order</th><th className="w-[115px] px-3 py-2">Branch</th><th className="w-[64px] px-3 py-2">Type</th><th className="px-3 py-2">Customer</th><th className="w-[130px] px-3 py-2">Machine / Call</th><th className="w-[72px] px-3 py-2 text-right">Qty</th><th className="w-[100px] px-3 py-2 text-right">Value</th><th className="w-[118px] px-3 py-2 text-right">Action</th></tr></thead>
            <tbody>{filtered.map((order) => <tr key={order.id} onClick={() => navigate(`/orders/${order.id}`)} className={`cursor-pointer border-t border-[#e2e8f0] transition hover:bg-[#eef7ff] ${order.age_days > 7 ? 'bg-[#fff1f2]' : ''}`}>
              <td className="px-3 py-2"><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${order.age_days > 7 ? 'bg-red-100 text-red-700' : order.age_days >= 3 ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>{ageLabel(order.age_days)}</span></td>
              <td className="truncate px-3 py-2 text-[#475569]">{dateLabel(order.received_date)}</td><td className="truncate px-3 py-2 font-semibold text-[#075fb8]">{order.final_order_no || order.order_no}</td><td className="truncate px-3 py-2">{order.branch}</td><td className="px-3 py-2"><span className="rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-2 py-0.5 text-[10px] font-semibold text-[#1d4ed8]">{order.order_type}</span></td>
              <td className="px-3 py-2"><p className="truncate font-medium">{order.customer_name || '-'}</p><p className="truncate text-[10px] text-[#64748b]">{order.contact_no || '-'}</p></td><td className="px-3 py-2"><p className="truncate">{order.machine_no || '-'}</p><p className="truncate text-[10px] text-[#64748b]">{order.call_id || '-'}</p></td><td className="px-3 py-2 text-right font-semibold">{order.total_qty}</td><td className="px-3 py-2 text-right font-semibold">{money(order.total_value)}</td>
              <td className="px-3 py-2 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); setSelected(order); setMessage(''); }} className="inline-flex h-8 items-center gap-1 rounded-md bg-[#0f5fa8] px-3 text-[11px] font-semibold text-white hover:bg-[#0b4d8a]"><FileCheck2 className="h-3.5 w-3.5" />Mark Issued</button></td>
            </tr>)}</tbody>
          </table>
        </div>
        {!query.isLoading && filtered.length === 0 ? <div className="p-10 text-center text-sm text-[#64748b]">No orders are pending to be marked as issued.</div> : null}
      </div>

      {selected ? <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0b1f3a]/70 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-md overflow-hidden rounded-xl border border-[#cbd5e1] bg-white shadow-2xl">
          <div className="bg-[#0b1f3a] px-5 py-4 text-white"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#f8d94e]">{selected.order_no}</p><h2 className="mt-1 text-lg font-bold">Mark order as issued</h2><p className="mt-1 text-xs text-[#dce8f5]">This will mark the order and every item row as Issued.</p></div>
          <div className="space-y-4 p-5"><label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Issued Document Type</span><select value={documentType} onChange={(event) => setDocumentType(event.target.value as IssuedDocumentType)} className="h-10 w-full rounded-md border border-[#cbd5e1] bg-white px-3 text-sm">{issuedDocumentTypes.map((option) => <option key={option}>{option}</option>)}</select></label><label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">Document Number</span><input autoFocus value={documentNo} onChange={(event) => setDocumentNo(event.target.value.toUpperCase())} placeholder="Enter document number" className="h-10 w-full rounded-md border border-[#cbd5e1] px-3 text-sm uppercase outline-none focus:border-[#0f5fa8]" /></label></div>
          <div className="flex justify-end gap-2 border-t border-[#d8e0ea] bg-[#f8fafc] px-5 py-3"><button type="button" className="h-9 rounded-md border border-[#cbd5e1] bg-white px-4 text-xs font-semibold" onClick={() => { setSelected(null); setDocumentNo(''); }}>Cancel</button><button type="button" disabled={!documentNo.trim() || issueMutation.isPending} onClick={() => issueMutation.mutate()} className="h-9 rounded-md bg-[#0f5fa8] px-4 text-xs font-semibold text-white disabled:opacity-40">{issueMutation.isPending ? 'Marking…' : 'Confirm & Mark Issued'}</button></div>
        </div>
      </div> : null}
    </PageCard>
  );
}
