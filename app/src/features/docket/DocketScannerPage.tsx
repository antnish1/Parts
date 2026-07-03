import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageCard } from '../../components/ui/PageCard';
import { markTestDocketReceived, lookupTestDocketOrders, normalizeDocketNo, type TestDocketOrder } from '../../services/testDocket.service';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getStatusRowClasses } from '../../lib/statusRowStyles';

export function DocketScannerPage() {
  const [docketNo, setDocketNo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [scannerStatus, setScannerStatus] = useState('Idle');
  const [orders, setOrders] = useState<TestDocketOrder[]>([]);
  const [busyId, setBusyId] = useState('');

  async function lookupOrders() {
    const value = normalizeDocketNo(searchTerm || docketNo);
    setScannerStatus(value ? `Searching ${value}...` : 'Enter docket, order, invoice or machine number.');
    if (!value) return;
    try {
      const rows = await lookupTestDocketOrders(value);
      setOrders(rows);
      setScannerStatus(rows.length ? `${rows.length} matching order(s) found.` : 'No matching order found.');
    } catch (error) {
      setScannerStatus(error instanceof Error ? error.message : 'Lookup failed.');
    }
  }

  async function receiveOrder(order: TestDocketOrder) {
    const value = normalizeDocketNo(docketNo || searchTerm || order.docket_no || order.final_order_no || order.order_no);
    setBusyId(order.id);
    setScannerStatus('Updating received status...');
    try {
      await markTestDocketReceived(order, value);
      setScannerStatus(`${order.final_order_no || order.order_no} marked received.`);
      await lookupOrders();
    } catch (error) {
      setScannerStatus(error instanceof Error ? error.message : 'Receive update failed.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <PageCard eyebrow="Docket" title="Docket Scanner" description="Scan or enter docket details and mark order received.">
      <div className="grid gap-3 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Scanner Control</p>
          <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-[#6D8196] bg-[#111827] text-center text-xs text-[#c7d2df]">Camera scanner area<br />Manual lookup is active now</div>
          <div className="mt-3 flex gap-2"><button className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => setScannerStatus('Camera scanner will be connected in next step.')}>Start Scanner</button><button className="text-xs font-black text-[#ef6f7b] hover:underline" onClick={() => setScannerStatus('Scanner stopped')}>Stop Scanner</button></div>
          <p className="mt-2 text-xs text-[#c7d2df]">Status: {scannerStatus}</p>
        </div>

        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Manual Receive</p>
          <div className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
            <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={docketNo} onChange={(event) => setDocketNo(normalizeDocketNo(event.target.value))} placeholder="Docket number" />
            <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Order / invoice / machine" />
            <button className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => void lookupOrders()}>Lookup</button>
          </div>
          <div className="mt-3 overflow-hidden rounded-md border border-[#263244]">
            <table className="w-full min-w-[900px] border-collapse text-left text-xs"><thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Order</th><th className="px-2.5 py-2">Final</th><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Customer</th><th className="px-2.5 py-2">Docket</th><th className="px-2.5 py-2">Invoice</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#263244] bg-[#111827]">{orders.map((order) => (<tr key={order.id} className={getStatusRowClasses(order.status)}><td className="px-2.5 py-2 font-black text-white">{order.order_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.final_order_no ?? '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.customer_name ?? '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.docket_no ?? '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.dbms_invoice_no ?? '-'}</td><td className="px-2.5 py-2"><StatusBadge status={order.status} /></td><td className="px-2.5 py-2 text-right"><div className="flex justify-end gap-3"><Link className="font-black text-[#82C8E5] hover:underline" to={`/orders/${order.id}`}>View</Link><button className="font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={busyId === order.id || order.status === 'received'} onClick={() => void receiveOrder(order)}>{busyId === order.id ? 'Saving' : order.status === 'received' ? 'Received' : 'Receive'}</button></div></td></tr>))}</tbody></table>
            {orders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No lookup results yet.</p> : null}
          </div>
        </div>
      </div>
    </PageCard>
  );
}
