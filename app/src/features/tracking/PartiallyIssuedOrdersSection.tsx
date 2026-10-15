import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileCheck2, Search, X } from 'lucide-react';
import {
  getPendingIssueOrderParts,
  type PendingIssueOrder,
} from '../../services/pendingIssue.service';
import {
  issuedDocumentTypes,
  markOrderItemsIssued,
  type IssuedDocumentType,
} from '../../services/orderIssue.service';

type AgeFilter = 'all' | '0-2' | '3-7' | 'over-7';
type TypeFilter = 'all' | 'vor' | 'sop';

function currency(amount: number) {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function ageMatches(age: AgeFilter, days: number) {
  return age === 'all' || (age === '0-2' && days <= 2) || (age === '3-7' && days >= 3 && days <= 7) || (age === 'over-7' && days > 7);
}

const CARD_FILTERS: Array<{ label: string; age: AgeFilter; type: TypeFilter }> = [
  { label: 'Total Partially Issued', age: 'all', type: 'all' },
  { label: 'Partially Issued 0–2 Days', age: '0-2', type: 'all' },
  { label: 'Partially Issued 3–7 Days', age: '3-7', type: 'all' },
  { label: 'Partially Issued Over 7 Days', age: 'over-7', type: 'all' },
  { label: 'Partially Issued VOR', age: 'all', type: 'vor' },
  { label: 'Partially Issued SOP', age: 'all', type: 'sop' },
];

const PAGE_SIZE = 15;

export function PartiallyIssuedOrdersSection({ orders }: { orders: PendingIssueOrder[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [age, setAge] = useState<AgeFilter>('all');
  const [type, setType] = useState<TypeFilter>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<PendingIssueOrder | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<IssuedDocumentType>('DC');
  const [documentNo, setDocumentNo] = useState('');
  const [message, setMessage] = useState('');

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => ageMatches(age, order.age_days) && (type === 'all' || order.order_type.toLowerCase() === type) &&
      (!term || [order.order_no, order.final_order_no, order.branch, order.customer_name, order.machine_no, order.call_id]
        .some((value) => String(value ?? '').toLowerCase().includes(term))));
  }, [age, type, search, orders]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const details = useQuery({
    queryKey: ['partial-issue-parts', selected?.id],
    queryFn: () => getPendingIssueOrderParts(selected ? [selected.id] : []),
    enabled: !!selected,
    staleTime: 0,
  });
  const pendingItems = (details.data ?? []).filter((item) => item.item_status !== 'ISSUED');
  const previouslyIssued = (details.data ?? []).filter((item) => item.item_status === 'ISSUED');

  const issueMutation = useMutation({
    mutationFn: () => markOrderItemsIssued(selected!.id, selectedItems, documentType, documentNo),
    onSuccess: async () => {
      setMessage(`Issued ${selectedItems.length} selected part line(s) for ${selected?.final_order_no || selected?.order_no}.`);
      setSelected(null);
      setSelectedItems([]);
      setDocumentNo('');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pending-issue-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-issue-nav-count'] }),
        queryClient.invalidateQueries({ queryKey: ['order-list-paged'] }),
        queryClient.invalidateQueries({ queryKey: ['tracking-meta'] }),
        queryClient.invalidateQueries({ queryKey: ['partial-issue-parts'] }),
      ]);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not issue selected parts.'),
  });

  function selectCard(nextAge: AgeFilter, nextType: TypeFilter) {
    setAge(nextAge);
    setType(nextType);
    setPage(1);
  }

  function openIssue(order: PendingIssueOrder) {
    setMessage('');
    setSelected(order);
    setSelectedItems([]);
    setDocumentType('DC');
    setDocumentNo('');
  }

  return (
    <section aria-label="Partially issued orders" className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-wide text-[#0f172a]">Partially Issued</h2>
          <p className="text-[11px] text-[#64748b]">Issued and still-pending quantities are tracked separately. Age is measured from parts receipt.</p>
        </div>
        <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">{orders.length} open orders</span>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        {CARD_FILTERS.map((card) => {
          const rows = orders.filter((order) => ageMatches(card.age, order.age_days) && (card.type === 'all' || order.order_type.toLowerCase() === card.type));
          const issuedQty = rows.reduce((sum, order) => sum + order.issued_qty, 0);
          const pendingQty = rows.reduce((sum, order) => sum + order.pending_qty, 0);
          const value = rows.reduce((sum, order) => sum + order.pending_value, 0);
          const active = age === card.age && type === card.type;
          return (
            <button key={card.label} type="button" onClick={() => selectCard(card.age, card.type)}
              className={`relative min-h-[92px] rounded-lg border p-3 text-left transition-transform hover:-translate-y-0.5 active:scale-[0.98] ${active ? 'border-[#b45309] bg-[#92400e] text-white shadow-md' : 'border-[#e7d7bb] bg-[#fffaf0] text-[#0f172a] hover:border-[#b45309]'}`}>
              <span className={`text-[10px] font-semibold uppercase leading-tight ${active ? 'text-[#ffedc5]' : 'text-[#7c5421]'}`}>{card.label}</span>
              <strong className="mt-1 block text-xl">{rows.length}</strong>
              <span className={`mt-1 block text-[10px] font-semibold ${active ? 'text-[#fff5d9]' : 'text-[#8a4a09]'}`}>Issued {issuedQty} · Pending {pendingQty}</span>
              <span className={`mt-1 block text-[10px] ${active ? 'text-[#fff5d9]' : 'text-[#7c5421]'}`}>{currency(value)} pending</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-lg border border-[#e5d7c1] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e9dfd1] bg-[#fffbf4] p-3">
          <span className="text-[11px] font-semibold uppercase text-[#7c5421]">{filtered.length} matching partially issued orders</span>
          <label className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748b]" />
            <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search order, branch, customer" className="h-9 w-full rounded-md border border-[#cbd5e1] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#b45309]" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-left text-xs">
            <thead className="bg-[#fff6e7] text-[10px] uppercase text-[#7c5421]"><tr>
              <th className="px-3 py-2">Age</th><th className="px-3 py-2">Order</th><th className="px-3 py-2">Branch</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Customer</th>
              <th className="px-3 py-2 text-right">Issued Qty</th><th className="px-3 py-2 text-right">Pending Qty</th><th className="px-3 py-2 text-right">Pending Value</th><th className="px-3 py-2 text-right">Action</th>
            </tr></thead>
            <tbody>
              {visible.map((order) => <tr key={order.id} className="cursor-pointer border-t border-[#e9dfd1] hover:bg-[#fffbf4]" onClick={() => navigate(`/orders/${order.id}`)}>
                <td className="px-3 py-2 font-semibold">{order.age_days} days</td>
                <td className="px-3 py-2 font-semibold text-[#075fb8]">{order.final_order_no || order.order_no}</td>
                <td className="px-3 py-2">{order.branch}</td>
                <td className="px-3 py-2">{order.order_type}</td>
                <td className="px-3 py-2">{order.customer_name || '—'}</td>
                <td className="px-3 py-2 text-right font-semibold text-[#166534]">{order.issued_qty}</td>
                <td className="px-3 py-2 text-right font-bold text-[#b45309]">{order.pending_qty}</td>
                <td className="px-3 py-2 text-right">{currency(order.pending_value)}</td>
                <td className="px-3 py-2 text-right"><button type="button" onClick={(event) => { event.stopPropagation(); openIssue(order); }}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-[#b45309] bg-white px-2 text-[11px] font-semibold text-[#92400e] hover:bg-amber-50">
                  <FileCheck2 className="h-3.5 w-3.5" /> Issue Parts
                </button></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="p-4 text-center text-xs text-[#64748b]">No partially issued orders match your filters.</p>}
        {filtered.length > 0 && <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e9dfd1] p-2 text-xs">
          <span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div className="flex items-center gap-2">
            <button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="rounded border px-3 py-1 disabled:opacity-30">Previous</button>
            <span>{currentPage} / {totalPages}</span>
            <button disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} className="rounded border px-3 py-1 disabled:opacity-30">Next</button>
          </div>
        </div>}
      </div>

      {message && <div role="status" className="flex items-center justify-between rounded-md bg-[#eef7ff] p-2 text-xs text-[#075fb8]">
        {message}<button aria-label="Dismiss message" onClick={() => setMessage('')}><X className="h-4 w-4" /></button>
      </div>}

      {selected && <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0b1f3a]/70 p-4" role="dialog" aria-modal="true" aria-label="Issue selected parts">
        <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border bg-white shadow-2xl">
          <div className="bg-[#0b1f3a] px-4 py-3 text-white"><p className="text-[10px] uppercase text-amber-200">{selected.final_order_no || selected.order_no}</p>
            <h3 className="text-base font-bold">Issue remaining parts</h3><p className="text-xs text-slate-200">Only selected received parts will be marked Issued.</p>
          </div>
          <div className="space-y-3 overflow-y-auto p-4">
            {details.isLoading && <p className="text-xs">Loading parts…</p>}
            {details.error && <p className="text-xs text-red-700">Unable to load parts. Please retry before issuing.</p>}
            {!!previouslyIssued.length && <p className="text-xs text-[#166534]">{previouslyIssued.length} part lines already issued. They cannot be issued again.</p>}
            {pendingItems.map((item) => <label key={item.item_id} className="flex items-start gap-2 rounded-lg border border-[#d8e0ea] p-2">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-[#166534]" checked={selectedItems.includes(item.item_id)}
                disabled={issueMutation.isPending}
                onChange={(event) => setSelectedItems((prev) => event.target.checked ? [...prev, item.item_id] : prev.filter((id) => id !== item.item_id))} />
              <span className="min-w-0 flex-1 text-xs"><strong>{item.part_no}</strong> · {item.description ?? 'Part'}
                <span className="mt-0.5 block text-[#64748b]">Qty {item.effective_qty} · Received {item.received_qty} · {item.item_status}</span></span>
            </label>)}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="block text-xs font-semibold">Document Type
                <select value={documentType} onChange={(event) => setDocumentType(event.target.value as IssuedDocumentType)}
                  className="mt-1 h-9 w-full rounded-md border border-[#cbd5e1] px-2">
                  {issuedDocumentTypes.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="block text-xs font-semibold">Document Number
                <input value={documentNo} onChange={(event) => setDocumentNo(event.target.value.toUpperCase())}
                  placeholder="DC / Invoice reference" className="mt-1 h-9 w-full rounded-md border border-[#cbd5e1] px-2 uppercase" />
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t bg-[#f8fafc] p-3">
            <button className="rounded-md border px-4 py-2 text-xs" disabled={issueMutation.isPending}
              onClick={() => { setSelected(null); setSelectedItems([]); }}>Cancel</button>
            <button className="rounded-md bg-[#166534] px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
              disabled={!selectedItems.length || !documentNo.trim() || details.isLoading || !!details.error || issueMutation.isPending}
              onClick={() => issueMutation.mutate()}>
              {issueMutation.isPending ? 'Issuing…' : `Issue ${selectedItems.length} selected part(s)`}
            </button>
          </div>
        </div>
      </div>}
    </section>
  );
}
