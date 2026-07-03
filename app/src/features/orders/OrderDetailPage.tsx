import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getTestOrderView } from '../../services/testOrderView.service';
import { getInventoryQtyByBranchParts } from '../../services/testInventoryLookup.service';
import { getBilledQty, getEffectiveQty, getEffectiveValue, getPendingQty, getOrderStatusLabel, normalizePartNo } from '../../lib/orderLogic';

function formatMoney(value: number) {
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

function coverageLabel(inventoryQty: number, pendingQty: number) {
  if (pendingQty <= 0) return 'Closed';
  if (inventoryQty >= pendingQty) return 'Available';
  if (inventoryQty > 0) return 'Partial';
  return 'No Stock';
}

export function OrderDetailPage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['test-order-view', orderId], queryFn: () => getTestOrderView(orderId), enabled: !!orderId });
  const inventoryQuery = useQuery({
    queryKey: ['test-order-inventory', data?.order.branch, data?.items.map((item) => item.part_no).join('|')],
    queryFn: () => getInventoryQtyByBranchParts(data!.order.branch, data!.items.map((item) => item.part_no)),
    enabled: !!data?.order.branch && data.items.length > 0,
  });

  if (isLoading) return <PageCard eyebrow="Orders" title="Order Detail" description="Loading order detail..."><p className="text-xs text-[#c7d2df]">Loading...</p></PageCard>;
  if (error || !data) return <PageCard eyebrow="Orders" title="Order Detail" description="Unable to load order detail."><p className="text-xs text-[#ef6f7b]">Order detail not found.</p></PageCard>;

  const { order, items, events } = data;
  const inventoryMap = inventoryQuery.data ?? {};
  const totalQty = items.reduce((sum, item) => sum + getEffectiveQty(item), 0);
  const totalBilled = items.reduce((sum, item) => sum + getBilledQty(item), 0);
  const totalPending = items.reduce((sum, item) => sum + getPendingQty(item), 0);
  const totalValue = items.reduce((sum, item) => sum + getEffectiveValue(item), 0);
  const totalInventoryCoverage = items.reduce((sum, item) => sum + Math.min(inventoryMap[normalizePartNo(item.part_no)] ?? 0, getPendingQty(item)), 0);
  const status = getOrderStatusLabel({ ...order, items });

  const summaryRows = [
    ['Order No', order.order_no],
    ['Branch', order.branch],
    ['Order Type', order.order_type],
    ['Order For', order.order_for === 'Customer' ? order.customer_name || 'Customer' : 'Stock'],
    ['Machine No', order.machine_no || '-'],
    ['Machine Type', order.warranty_status || '-'],
    ['Call ID', order.call_id || '-'],
    ['Approver', order.approver?.full_name || '-'],
  ];

  return (
    <PageCard eyebrow="Orders" title="Order Detail" description="Shared order review workspace.">
      <div className="mb-3 flex items-center justify-between gap-3">
        <button type="button" className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => navigate(-1)}>Back</button>
        <StatusBadge status={status} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {summaryRows.map(([label, value]) => (
          <div key={label} className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6D8196]">{label}</p>
            <p className="mt-1 text-xs font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-5">
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] uppercase text-[#6D8196]">Qty</p><p className="text-sm font-black text-white">{totalQty}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] uppercase text-[#6D8196]">Billed</p><p className="text-sm font-black text-white">{totalBilled}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] uppercase text-[#6D8196]">Pending</p><p className="text-sm font-black text-white">{totalPending}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] uppercase text-[#6D8196]">Inventory Cover</p><p className="text-sm font-black text-white">{totalInventoryCoverage}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] uppercase text-[#6D8196]">Value</p><p className="text-sm font-black text-white">{formatMoney(totalValue)}</p></div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-[#263244]">
        <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
          <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Part No</th><th className="px-2.5 py-2">Description</th><th className="px-2.5 py-2 text-right">Qty</th><th className="px-2.5 py-2 text-right">Billed</th><th className="px-2.5 py-2 text-right">Pending</th><th className="px-2.5 py-2 text-right">30D</th><th className="px-2.5 py-2 text-right">Inventory</th><th className="px-2.5 py-2">Cover</th><th className="px-2.5 py-2 text-right">DNP</th><th className="px-2.5 py-2 text-right">Value</th></tr></thead>
          <tbody className="divide-y divide-[#263244] bg-[#111827]">
            {items.map((item) => {
              const pendingQty = getPendingQty(item);
              const inventoryQty = inventoryMap[normalizePartNo(item.part_no)] ?? 0;
              const cover = coverageLabel(inventoryQty, pendingQty);
              return (
                <tr key={item.id} className="hover:bg-[#182235]"><td className="px-2.5 py-2 font-black text-white">{item.part_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.description || '-'}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{getEffectiveQty(item)}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{getBilledQty(item)}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{pendingQty}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{item.previous_30d_qty ?? 0}</td><td className="px-2.5 py-2 text-right font-black text-white">{inventoryQuery.isLoading ? '...' : inventoryQty}</td><td className="px-2.5 py-2"><span className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1 text-[10px] font-black uppercase text-[#82C8E5]">{cover}</span></td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{item.dnp ?? '-'}</td><td className="px-2.5 py-2 text-right font-black text-white">{formatMoney(getEffectiveValue(item))}</td></tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Action Log</p>
        <div className="space-y-2">
          {events.map((event) => (<div key={event.id} className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-2 text-xs"><p className="font-black text-white">{event.event_type}</p><p className="text-[#c7d2df]">{event.notes || '-'} • {formatDate(event.created_at)}</p></div>))}
          {events.length === 0 ? <p className="text-xs text-[#c7d2df]">No action logs yet.</p> : null}
        </div>
      </div>
    </PageCard>
  );
}
