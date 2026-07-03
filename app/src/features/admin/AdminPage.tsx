import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getOrderList } from '../../services/orderList.service';
import { setTestOrderAdminRejected, setTestOrderProcessed } from '../../services/testAdmin.service';
import { getTestOrderView } from '../../services/testOrderView.service';
import { dispatchSelectedTestItems } from '../../services/testDispatch.service';
import { getEffectiveQty, getPendingQty } from '../../lib/orderLogic';
import { getStatusRowClasses } from '../../lib/statusRowStyles';

export function AdminPage() {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [references, setReferences] = useState<Record<string, string>>({});
  const [invoiceNos, setInvoiceNos] = useState<Record<string, string>>({});
  const [invoiceDates, setInvoiceDates] = useState<Record<string, string>>({});
  const [docketNos, setDocketNos] = useState<Record<string, string>>({});
  const [transports, setTransports] = useState<Record<string, string>>({});
  const [dispatchOrderId, setDispatchOrderId] = useState('');
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const { data: orders = [], refetch, isLoading } = useQuery({ queryKey: ['order-list-paged'], queryFn: getOrderList });
  const dispatchQuery = useQuery({ queryKey: ['admin-dispatch-order', dispatchOrderId], queryFn: () => getTestOrderView(dispatchOrderId), enabled: !!dispatchOrderId });

  const term = search.trim().toLowerCase();
  const matches = (order: (typeof orders)[number]) => !term || `${order.order_no} ${order.final_order_no ?? ''} ${order.processing_reference ?? ''} ${order.branch} ${order.order_type} ${order.customer_name ?? ''} ${order.machine_no ?? ''}`.toLowerCase().includes(term);
  const approvedOrders = useMemo(() => orders.filter((order) => order.status === 'approved' && matches(order)), [orders, search]);
  const processedOrders = useMemo(() => orders.filter((order) => ['processed', 'partially_dispatched'].includes(order.status) && matches(order)), [orders, search]);
  const dispatchedOrders = useMemo(() => orders.filter((order) => ['issued', 'partially_dispatched'].includes(order.status) && matches(order)).slice(0, 10), [orders, search]);
  const counts = {
    approved: orders.filter((order) => order.status === 'approved').length,
    processed: orders.filter((order) => order.status === 'processed').length,
    dispatched: orders.filter((order) => ['issued', 'partially_dispatched'].includes(order.status)).length,
    rejected: orders.filter((order) => order.status === 'rejected').length,
  };

  async function processOrder(order: (typeof orders)[number]) {
    const reference = references[order.id] ?? '';
    setMessage('');
    setBusyId(order.id);
    try {
      await setTestOrderProcessed(order, reference);
      setMessage(`${order.order_no} processed as ${reference.trim().toUpperCase()}.`);
      setReferences((current) => ({ ...current, [order.id]: '' }));
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Processing failed.');
    } finally {
      setBusyId('');
    }
  }

  async function rejectOrder(order: (typeof orders)[number]) {
    setMessage('');
    setBusyId(order.id);
    try {
      await setTestOrderAdminRejected(order, 'Rejected from admin processing queue.');
      setMessage(`${order.order_no} rejected.`);
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Reject failed.');
    } finally {
      setBusyId('');
    }
  }

  function openDispatch(orderId: string) {
    setDispatchOrderId(orderId);
    setSelectedItems({});
    setMessage('Select item rows to dispatch.');
  }

  function toggleItem(itemId: string, checked: boolean) {
    setSelectedItems((current) => ({ ...current, [itemId]: checked }));
  }

  async function dispatchOrder(order: (typeof orders)[number]) {
    const itemIds = Object.entries(selectedItems).filter(([, checked]) => checked).map(([id]) => id);
    setMessage('');
    setBusyId(order.id);
    try {
      const result = await dispatchSelectedTestItems(order, itemIds, invoiceNos[order.id] ?? '', invoiceDates[order.id] ?? '', docketNos[order.id] ?? '', transports[order.id] ?? '');
      setMessage(`${order.final_order_no || order.order_no}: ${result?.itemCount ?? itemIds.length} item row(s) dispatched.`);
      setInvoiceNos((current) => ({ ...current, [order.id]: '' }));
      setInvoiceDates((current) => ({ ...current, [order.id]: '' }));
      setDocketNos((current) => ({ ...current, [order.id]: '' }));
      setTransports((current) => ({ ...current, [order.id]: '' }));
      setSelectedItems({});
      setDispatchOrderId('');
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Dispatch failed.');
    } finally {
      setBusyId('');
    }
  }

  const dispatchOrderData = dispatchQuery.data?.order;
  const activeOrder = orders.find((order) => order.id === dispatchOrderId);
  const dispatchableItems = (dispatchQuery.data?.items ?? []).filter((item) => item.row_status !== 'received' && item.row_status !== 'issued');

  return (
    <PageCard eyebrow="Admin" title="Admin Processing" description="Process approved orders, reject exceptions, and dispatch selected item rows.">
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Approved</p><p className="text-sm font-black text-white">{counts.approved}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Processed</p><p className="text-sm font-black text-white">{counts.processed}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Dispatched</p><p className="text-sm font-black text-white">{counts.dispatched}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Rejected</p><p className="text-sm font-black text-white">{counts.rejected}</p></div>
      </div>

      <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <input className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5] lg:w-96" placeholder="Search admin orders" value={search} onChange={(event) => setSearch(event.target.value)} />
        {message ? <p className="text-xs text-[#c7d2df]">{message}</p> : null}
      </div>

      {isLoading ? <p className="text-xs text-[#c7d2df]">Loading admin queue...</p> : null}
      <div className="grid gap-3 xl:grid-cols-[1.25fr_1fr]">
        <div className="overflow-hidden rounded-lg border border-[#263244]">
          <table className="w-full min-w-[1040px] border-collapse text-left text-xs">
            <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Order No</th><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Type</th><th className="px-2.5 py-2">Customer</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2">Final No.</th><th className="px-2.5 py-2 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-[#263244] bg-[#111827]">
              {approvedOrders.map((order) => (<tr key={order.id} className={getStatusRowClasses(order.status)}><td className="px-2.5 py-2 font-black text-white">{order.order_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.order_type}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.customer_name ?? '-'}</td><td className="px-2.5 py-2"><StatusBadge status={order.status} /></td><td className="px-2.5 py-2"><input className="w-36 rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="DBMS/SAP No." value={references[order.id] ?? ''} onChange={(event) => setReferences((current) => ({ ...current, [order.id]: event.target.value }))} /></td><td className="px-2.5 py-2 text-right"><div className="flex justify-end gap-3"><Link className="font-black text-[#82C8E5] hover:underline" to={`/orders/${order.id}`}>View</Link><button className="font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={busyId === order.id} onClick={() => void processOrder(order)}>{busyId === order.id ? 'Processing' : 'Process'}</button><button className="font-black text-[#ef6f7b] hover:underline disabled:opacity-40" disabled={busyId === order.id} onClick={() => void rejectOrder(order)}>Reject</button></div></td></tr>))}
            </tbody>
          </table>
          {approvedOrders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No approved orders found.</p> : null}
        </div>

        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Processed / Ready To Dispatch</p>
          <div className="space-y-2">
            {processedOrders.map((order) => (<div key={order.id} className={`rounded-md border border-[#263244] px-2.5 py-2 ${getStatusRowClasses(order.status)}`}><div className="flex items-start justify-between gap-2"><div><p className="text-xs font-black text-white">{order.final_order_no || order.processing_reference || order.order_no}</p><p className="text-xs text-[#c7d2df]">{order.branch} • {order.customer_name ?? '-'} • {order.order_for}</p><p className="text-[10px] uppercase tracking-[0.12em] text-[#6D8196]">Processed {order.processed_date ?? '-'} • {order.status}</p></div><div className="flex gap-3"><Link className="text-xs font-black text-[#82C8E5] hover:underline" to={`/orders/${order.id}`}>View</Link><button className="text-xs font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={order.order_for !== 'Customer'} onClick={() => openDispatch(order.id)}>Select Items</button></div></div></div>))}
            {processedOrders.length === 0 ? <p className="text-xs text-[#c7d2df]">No processed orders ready to dispatch.</p> : null}
          </div>
        </div>
      </div>

      {dispatchOrderId ? (
        <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Selected Item Dispatch {dispatchOrderData ? `• ${dispatchOrderData.final_order_no || dispatchOrderData.order_no}` : ''}</p><button className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => setDispatchOrderId('')}>Close</button></div>
          <div className="mb-2 grid grid-cols-2 gap-2 lg:grid-cols-4"><input className="rounded-md border border-[#263244] bg-[#111827] px-2 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Invoice No." value={invoiceNos[dispatchOrderId] ?? ''} onChange={(event) => setInvoiceNos((current) => ({ ...current, [dispatchOrderId]: event.target.value }))} /><input type="date" className="rounded-md border border-[#263244] bg-[#111827] px-2 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={invoiceDates[dispatchOrderId] ?? ''} onChange={(event) => setInvoiceDates((current) => ({ ...current, [dispatchOrderId]: event.target.value }))} /><input className="rounded-md border border-[#263244] bg-[#111827] px-2 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Docket No." value={docketNos[dispatchOrderId] ?? ''} onChange={(event) => setDocketNos((current) => ({ ...current, [dispatchOrderId]: event.target.value }))} /><input className="rounded-md border border-[#263244] bg-[#111827] px-2 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Transport" value={transports[dispatchOrderId] ?? ''} onChange={(event) => setTransports((current) => ({ ...current, [dispatchOrderId]: event.target.value }))} /></div>
          {dispatchQuery.isLoading ? <p className="text-xs text-[#c7d2df]">Loading item rows...</p> : null}
          <div className="overflow-hidden rounded-md border border-[#263244]"><table className="w-full min-w-[900px] border-collapse text-left text-xs"><thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Select</th><th className="px-2.5 py-2">Part No</th><th className="px-2.5 py-2">Description</th><th className="px-2.5 py-2 text-right">Qty</th><th className="px-2.5 py-2 text-right">Pending</th><th className="px-2.5 py-2">Status</th></tr></thead><tbody className="divide-y divide-[#263244]">{dispatchableItems.map((item) => (<tr key={item.id} className="bg-[#111827]"><td className="px-2.5 py-2"><input type="checkbox" checked={!!selectedItems[item.id]} onChange={(event) => toggleItem(item.id, event.target.checked)} /></td><td className="px-2.5 py-2 font-black text-white">{item.part_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.description || '-'}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{getEffectiveQty(item)}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{getPendingQty(item)}</td><td className="px-2.5 py-2"><StatusBadge status={item.row_status || 'processed'} /></td></tr>))}</tbody></table>{dispatchableItems.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No dispatchable item rows found.</p> : null}</div>
          <div className="mt-2 text-right"><button className="text-xs font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={!activeOrder || busyId === dispatchOrderId || Object.values(selectedItems).every((value) => !value)} onClick={() => activeOrder && void dispatchOrder(activeOrder)}>{busyId === dispatchOrderId ? 'Saving' : 'Dispatch Selected Items'}</button></div>
        </div>
      ) : null}

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Recently Dispatched</p>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {dispatchedOrders.map((order) => (<div key={order.id} className={`rounded-md border border-[#263244] px-2.5 py-2 ${getStatusRowClasses(order.status)}`}><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-black text-white">{order.final_order_no || order.order_no}</p><p className="text-xs text-[#c7d2df]">{order.status}</p></div><Link className="text-xs font-black text-[#82C8E5] hover:underline" to={`/orders/${order.id}`}>View</Link></div></div>))}
          {dispatchedOrders.length === 0 ? <p className="text-xs text-[#c7d2df]">No dispatched orders yet.</p> : null}
        </div>
      </div>
    </PageCard>
  );
}
