import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FileCheck2, FileSpreadsheet, Search, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../auth/useAuth';
import { PageCard } from '../../components/ui/PageCard';
import { getPendingIssueOrderParts, getPendingIssueOrders, type PendingIssueOrder } from '../../services/pendingIssue.service';
import { IssueOrderPartsDialog } from './IssueOrderPartsDialog';

function money(value: number) { return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`; }
function dateLabel(value: string | null) { return value ? new Date(value).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'; }
function ageLabel(days: number) { return days === 0 ? 'Today' : `${days} Day${days === 1 ? '' : 's'}`; }
function excelDate(value: string | null) { return value ? new Date(value) : ''; }
function fileDate() { return new Date().toLocaleDateString('en-GB').replace(/\//g, '-'); }
function configureSheet(sheet: XLSX.WorkSheet, widths: number[]) {
  sheet['!cols'] = widths.map((wch) => ({ wch }));
  if (sheet['!ref']) sheet['!autofilter'] = { ref: sheet['!ref'] };
  (sheet as XLSX.WorkSheet & { '!freeze'?: unknown })['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
}
function writeWorkbook(rows: Record<string, unknown>[], sheetName: string, filename: string, widths: number[]) {
  const sheet = XLSX.utils.json_to_sheet(rows, { cellDates: true, dateNF: 'dd/mm/yyyy hh:mm' });
  configureSheet(sheet, widths);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  XLSX.writeFile(workbook, filename, { cellDates: true });
}

// UNIFIED_PENDING_ISSUE_V2: keep one dashboard/table and one selective issue dialog.
type AgeFilter = 'all' | '0-2' | '3-7' | 'over-7';
type IssueView = 'pending' | 'partially_issued';
const PAGE_SIZE = 15;

type ExportMode = 'orders' | 'parts' | null;

export function PendingIssueOrdersPage() {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [params, setParams] = useSearchParams();
  const [selected, setSelected] = useState<PendingIssueOrder | null>(null);
  const [message, setMessage] = useState('');
  const [exporting, setExporting] = useState<ExportMode>(null);

  const view: IssueView = params.get('view') === 'partially_issued' ? 'partially_issued' : 'pending';
  const search = params.get('q') ?? '';
  const age = (params.get('age') ?? 'all') as AgeFilter;
  const type = params.get('type') ?? 'all';
  const branch = params.get('branch') ?? 'all';
  const requestedPage = Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1);

  const query = useQuery({ queryKey: ['pending-issue-orders'], queryFn: getPendingIssueOrders, staleTime: 30000, refetchOnWindowFocus: true });
  const allOrders = query.data ?? [];
  const pendingOrders = useMemo(() => allOrders.filter((order) => order.issue_status === 'pending'), [allOrders]);
  const partialOrders = useMemo(() => allOrders.filter((order) => order.issue_status === 'partially_issued'), [allOrders]);
  const orders = view === 'partially_issued' ? partialOrders : pendingOrders;
  const branches = useMemo(() => [...new Set(allOrders.map((order) => order.branch))].sort(), [allOrders]);
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(requestedPage, totalPages);
  const paginated = useMemo(() => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE), [currentPage, filtered]);

  const totals = useMemo(() => {
    const calculate = (rows: PendingIssueOrder[]) => ({
      count: rows.length,
      value: rows.reduce((sum, order) => sum + order.pending_value, 0),
    });
    return {
      all: calculate(pendingOrders),
      '0-2': calculate(pendingOrders.filter((order) => order.age_days <= 2)),
      '3-7': calculate(pendingOrders.filter((order) => order.age_days >= 3 && order.age_days <= 7)),
      'over-7': calculate(pendingOrders.filter((order) => order.age_days > 7)),
      vor: calculate(pendingOrders.filter((order) => order.order_type.toLowerCase() === 'vor')),
      sop: calculate(pendingOrders.filter((order) => order.order_type.toLowerCase() === 'sop')),
      partial: calculate(partialOrders),
    };
  }, [pendingOrders, partialOrders]);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (!value || value === 'all' || (key === 'page' && value === '1')) next.delete(key);
    else next.set(key, value);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  }

  function chooseKpi(nextView: IssueView, nextAge: AgeFilter = 'all', nextType = 'all') {
    const next = new URLSearchParams(params);
    if (nextView === 'partially_issued') next.set('view', nextView); else next.delete('view');
    if (nextAge === 'all') next.delete('age'); else next.set('age', nextAge);
    if (nextType === 'all') next.delete('type'); else next.set('type', nextType);
    next.delete('page');
    setParams(next, { replace: true });
  }

  async function exportOrders() {
    if (!filtered.length) { setMessage('No matching orders to export.'); return; }
    try {
      setExporting('orders'); setMessage('');
      const rows = filtered.map((order) => ({
        'Age (Days)': order.age_days,
        'Received Date': excelDate(order.received_date),
        'Order No': order.order_no,
        'Final Order No': order.final_order_no ?? '',
        'Branch': order.branch,
        'Order Type': order.order_type,
        'Customer Name': order.customer_name ?? '',
        'Contact No': order.contact_no ?? '',
        'Machine No': order.machine_no ?? '',
        'Call ID': order.call_id ?? '',
        'Order Status': order.issue_status === 'partially_issued' ? 'Partially Issued' : 'Pending Issue',
        'Total Qty': order.total_qty,
        'Issued Qty': order.issued_qty,
        'Pending Qty': order.pending_qty,
        'Total Value': order.total_value,
        'Pending Value': order.pending_value,
      }));
      writeWorkbook(rows, 'Issue Orders', `Issue-Orders_${fileDate()}.xlsx`, [12, 20, 16, 18, 18, 12, 28, 16, 16, 16, 22, 12, 12, 12, 14, 14]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not export pending issue orders.');
    } finally { setExporting(null); }
  }

  async function exportOrdersWithParts() {
    if (!filtered.length) { setMessage('No matching orders to export.'); return; }
    try {
      setExporting('parts'); setMessage('');
      const parts = await getPendingIssueOrderParts(filtered.map((order) => order.id));
      const orderById = new Map(filtered.map((order) => [order.id, order]));
      const rows = parts.flatMap((part) => {
        const order = orderById.get(part.order_id);
        if (!order) return [];
        return [{
          'Age (Days)': order.age_days,
          'Received Date': excelDate(order.received_date),
          'Order No': order.order_no,
          'Final Order No': order.final_order_no ?? '',
          'Branch': order.branch,
          'Order Type': order.order_type,
          'Customer Name': order.customer_name ?? '',
          'Contact No': order.contact_no ?? '',
          'Machine No': order.machine_no ?? '',
          'Call ID': order.call_id ?? '',
          'Part No': part.part_no,
          'Description': part.description ?? '',
          'Original Qty': part.original_qty,
          'Edited Qty': part.edited_qty ?? '',
          'Effective Qty': part.effective_qty,
          'Original Value': part.item_value,
          'Edited Value': part.edited_value ?? '',
          'Effective Value': part.effective_value,
          'Billed Qty': part.billed_qty,
          'Received Qty': part.received_qty,
          'Item Status': part.item_status,
          'Issued Document Type': part.issued_document_type ?? '',
          'Issued Document No': part.issued_document_no ?? '',
          'Issued At': excelDate(part.issued_at),
        }];
      });
      if (!rows.length) { setMessage('No part rows were found for the matching pending issue orders.'); return; }
      writeWorkbook(rows, 'Issue - Parts', `Issue-Orders-With-Parts_${fileDate()}.xlsx`, [12, 20, 16, 18, 18, 12, 28, 16, 16, 16, 16, 34, 12, 12, 12, 14, 14, 14, 12, 12, 22, 20, 42, 20]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not export pending issue order parts.');
    } finally { setExporting(null); }
  }

  const cards: Array<{ key: string; label: string; data: { count: number; value: number }; onClick: () => void; active: boolean }> = [
    { key: 'all', label: 'Total Pending', data: totals.all, onClick: () => chooseKpi('pending'), active: view === 'pending' && age === 'all' && type === 'all' },
    { key: '0-2', label: 'Pending 0–2 Days', data: totals['0-2'], onClick: () => chooseKpi('pending', '0-2'), active: view === 'pending' && age === '0-2' && type === 'all' },
    { key: '3-7', label: 'Pending 3–7 Days', data: totals['3-7'], onClick: () => chooseKpi('pending', '3-7'), active: view === 'pending' && age === '3-7' && type === 'all' },
    { key: 'over-7', label: 'Pending Over 7 Days', data: totals['over-7'], onClick: () => chooseKpi('pending', 'over-7'), active: view === 'pending' && age === 'over-7' && type === 'all' },
    { key: 'vor', label: 'Pending VOR', data: totals.vor, onClick: () => chooseKpi('pending', 'all', 'vor'), active: view === 'pending' && age === 'all' && type === 'vor' },
    { key: 'sop', label: 'Pending SOP', data: totals.sop, onClick: () => chooseKpi('pending', 'all', 'sop'), active: view === 'pending' && age === 'all' && type === 'sop' },
    { key: 'partial', label: 'Partially Issued', data: totals.partial, onClick: () => chooseKpi('partially_issued'), active: view === 'partially_issued' },
  ];

  return (
    <PageCard eyebrow="Operations" title="Pending Issue Orders" description="">
      <div data-testid="unified-issue-kpis" className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {cards.map((card) => <button key={card.key} type="button" onClick={card.onClick} className={`relative min-h-[84px] overflow-hidden rounded-lg border p-3 text-left transition-all ${card.active ? 'border-[#0b1f3a] bg-[#0b1f3a] text-white shadow-lg ring-2 ring-[#f2c300]/40' : 'border-[#d5deea] bg-[#f8fafc] text-[#0f172a] hover:-translate-y-0.5 hover:border-[#0f5fa8]'}`}>
          <span className={`text-[10px] font-semibold uppercase tracking-wide ${card.active ? 'text-[#dce8f5]' : 'text-[#64748b]'}`}>{card.label}</span>
          <strong className={`mt-1 block text-xl ${card.active ? '!text-white' : '!text-[#0f172a]'}`}>{card.data.count}</strong>
          <span className={`absolute bottom-2 right-3 text-[10px] font-semibold ${card.active ? 'text-[#f8d94e]' : 'text-[#334155]'}`}>{money(card.data.value)}</span>
        </button>)}
      </div>

      <div className="mt-3 rounded-lg border border-[#d8e0ea] bg-[#f8fafc] p-2">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">{filtered.length} {view === 'partially_issued' ? 'partially issued' : 'pending issue'} orders</span>
          <div className="flex items-center gap-2">
            <button type="button" title="Export filtered order summary to Excel" aria-label="Export filtered order summary to Excel" disabled={Boolean(exporting) || !filtered.length} onClick={exportOrders} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-[#15803d] bg-white px-3 text-xs font-semibold text-[#166534] hover:bg-[#f0fdf4] disabled:cursor-not-allowed disabled:opacity-45"><FileSpreadsheet className="h-4 w-4" /><span className="hidden sm:inline">Orders</span></button>
            <button type="button" title="Export filtered orders with related part rows to Excel" aria-label="Export filtered orders with related part rows to Excel" disabled={Boolean(exporting) || !filtered.length} onClick={exportOrdersWithParts} className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#166534] px-3 text-xs font-semibold text-white hover:bg-[#14532d] disabled:cursor-not-allowed disabled:opacity-45"><FileSpreadsheet className="h-4 w-4" /><span className="hidden sm:inline">Orders + Parts</span></button>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_160px_170px_170px]">
          <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-[#64748b]" /><input value={search} onChange={(event) => updateParam('q', event.target.value)} className="h-9 w-full rounded-md border border-[#cbd5e1] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#0f5fa8]" placeholder="Search order, customer, mobile, machine or call ID" /></label>
          <select value={type} onChange={(event) => updateParam('type', event.target.value)} className="h-9 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"><option value="all">All Types</option><option value="vor">VOR</option><option value="sop">SOP</option></select>
          <select value={age} onChange={(event) => updateParam('age', event.target.value)} className="h-9 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"><option value="all">All Aging</option><option value="0-2">0–2 Days</option><option value="3-7">3–7 Days</option><option value="over-7">Over 7 Days</option></select>
          {!isBranch ? <select value={branch} onChange={(event) => updateParam('branch', event.target.value)} className="h-9 rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"><option value="all">All Branches</option>{branches.map((name) => <option key={name} value={name}>{name}</option>)}</select> : <div className="hidden md:block" />}
        </div>
      </div>

      {exporting ? <div className="mt-2 rounded-md border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-2 text-xs font-semibold text-[#166534]">{exporting === 'parts' ? 'Preparing Excel with related part rows…' : 'Preparing order Excel…'}</div> : null}
      {message ? <div className="mt-2 flex items-center justify-between rounded-md border border-[#b9d5ef] bg-[#eef7ff] px-3 py-2 text-xs text-[#0b4d8a]"><span>{message}</span><button type="button" onClick={() => setMessage('')}><X className="h-4 w-4" /></button></div> : null}
      {query.error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">Could not load pending issue orders.</p> : null}

      <div data-testid="unified-issue-table" className="mt-3 overflow-hidden rounded-lg border border-[#d8e0ea] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1250px] text-left text-xs">
            <thead className="bg-[#eaf0f6] text-[10px] uppercase tracking-wide text-[#334155]">
              <tr>
                <th className="px-3 py-2">Age</th><th className="px-3 py-2">Received</th>
                <th className="px-3 py-2">Order</th><th className="px-3 py-2">Branch</th>
                <th className="px-3 py-2">Type</th><th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Machine / Call</th><th className="px-3 py-2 text-right">Issued Qty</th>
                <th className="px-3 py-2 text-right">Pending Qty</th><th className="px-3 py-2 text-right">Pending Value</th>
                <th className="px-3 py-2">Status</th><th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((order) => (
                <tr key={order.id} onClick={() => navigate(`/orders/${order.id}`)}
                  className={`cursor-pointer border-t border-[#e2e8f0] transition hover:bg-[#eef7ff] ${order.age_days > 7 ? 'bg-[#fff8f4]' : ''}`}>
                  <td className="whitespace-nowrap px-3 py-2">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${order.age_days > 7 ? 'bg-red-100 text-red-700' : order.age_days >= 3 ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>{ageLabel(order.age_days)}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-[#475569]">{dateLabel(order.received_date)}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-semibold text-[#075fb8]">{order.final_order_no || order.order_no}</td>
                  <td className="whitespace-nowrap px-3 py-2">{order.branch}</td>
                  <td className="px-3 py-2 font-semibold">{order.order_type}</td>
                  <td className="px-3 py-2"><p className="max-w-40 truncate font-medium">{order.customer_name || '-'}</p><p className="text-[10px] text-[#64748b]">{order.contact_no || '-'}</p></td>
                  <td className="px-3 py-2"><p>{order.machine_no || '-'}</p><p className="text-[10px] text-[#64748b]">{order.call_id || '-'}</p></td>
                  <td className="px-3 py-2 text-right font-semibold text-[#166534]">{order.issued_qty}</td>
                  <td className="px-3 py-2 text-right font-bold text-[#92400e]">{order.pending_qty}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold">{money(order.pending_value)}</td>
                  <td className="px-3 py-2"><span className={`whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-bold ${order.issue_status === 'partially_issued' ? 'bg-amber-100 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>{order.issue_status === 'partially_issued' ? 'Partially Issued' : 'Pending Issue'}</span></td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={(event) => { event.stopPropagation(); setSelected(order); setMessage(''); }}
                      className="inline-flex h-8 items-center gap-1 rounded-md border border-[#15803d] bg-white px-3 text-[11px] font-semibold text-[#166534] hover:bg-[#f0fdf4]">
                      <FileCheck2 className="h-3.5 w-3.5" />Issue Parts
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!query.isLoading && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#d8e0ea] bg-[#f8fafc] px-3 py-2 text-xs text-[#475569]">
            <span>Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} orders</span>
            <div className="flex items-center gap-2">
              <button type="button" disabled={currentPage <= 1} onClick={() => updateParam('page', String(currentPage - 1))}
                className="h-8 rounded-md border border-[#cbd5e1] bg-white px-3 font-semibold disabled:opacity-40">Previous</button>
              <span className="min-w-[76px] text-center font-semibold">Page {currentPage} of {totalPages}</span>
              <button type="button" disabled={currentPage >= totalPages} onClick={() => updateParam('page', String(currentPage + 1))}
                className="h-8 rounded-md border border-[#cbd5e1] bg-white px-3 font-semibold disabled:opacity-40">Next</button>
            </div>
          </div>
        )}
        {!query.isLoading && filtered.length === 0 && (
          <p className="p-10 text-center text-sm text-[#64748b]">No matching {view === 'partially_issued' ? 'partially issued' : 'pending issue'} orders.</p>
        )}
      </div>

      {selected && (
        <IssueOrderPartsDialog
          orderId={selected.id}
          orderLabel={selected.final_order_no || selected.order_no}
          onClose={() => setSelected(null)}
          onIssued={async (result) => { setMessage(result); await query.refetch(); }}
        />
      )}
    </PageCard>
  );
}
