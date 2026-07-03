import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageCard } from '../../components/ui/PageCard';
import { markTestOrderReceived, searchTestOrderForDocket, type TestDocketOrder } from '../../services/testDocket.service';
import { getStatusRowClasses } from '../../lib/statusRowStyles';

export function DocketScannerPage() {
  const [docketNo, setDocketNo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [scannerStatus, setScannerStatus] = useState('Idle');
  const [orders, setOrders] = useState<TestDocketOrder[]>([]);
  const [busyId, setBusyId] = useState('');

  async function lookupOrders() {
    setScannerStatus('Searching orders...');
    try {
      const rows = await searchTestOrderForDocket(searchTerm || docketNo);
      setOrders(rows);
      setScannerStatus(rows.length ? `${rows.length} order(s) found` : 'No matching order found');
    } catch (error) {
      setScannerStatus(error instanceof Error ? error.message : 'Lookup failed');
    }
  }

  async function receiveOrder(order: TestDocketOrder) {
    setBusyId(order.id);
    setScannerStatus('Updating order...');
    try {
      await markTestOrderReceived(order.id, docketNo);
      setScannerStatus(`${order.order_no} marked received.`);
      await lookupOrders();
    } catch (error) {
      setScannerStatus(error instanceof Error ? error.message : 'Receive update failed');
    } finally {
      setBusyId('');
    }
  }

  return (
    <PageCard eyebrow="Docket" title="Docket Scanner" description="Scan or enter docket details and mark order received.">
      <div className="grid gap-3 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Scanner Control</p>
          <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-[#6D8196] bg-[#111827] text-center text-xs text-[#c7d2df]">Camera scanner area</div>
          <div className="mt-3 flex gap-2"><button className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => setScannerStatus('Scanner ready')}>Start Scanner</button><button className="text-xs font-black text-[#ef6f7b] hover:underline" onClick={() => setScannerStatus('Scanner stopped')}>Stop Scanner</button></div>
          <p className="mt-2 text-xs text-[#c7d2df]">Status: {scannerStatus}</p>
        </div>

        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Manual Receive</p>
          <div className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
            <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={docketNo} onChange={(event) => setDocketNo(event.target.value)} placeholder="Docket number" />
            <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Order / machine / customer" />
            <button className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => void lookupOrders()}>Lookup</button>
          </div>
          <div className="mt-3 overflow-hidden rounded-md border border-[#263244]">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs"><thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Order</th><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Customer</th><th className="px-2.5 py-2">Machine</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#263244] bg-[#111827]">{orders.map((order) => (<tr key={order.id} className={getStatusRowClasses(order.status)}><td className="px-2.5 py-2 font-black text-white">{order.order_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.customer_name ?? '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.machine_no ?? '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.status}</td><td className="px-2.5 py-2 text-right"><div className="flex justify-end gap-3"><Link className="font-black text-[#82C8E5] hover:underline" to={`/orders/${order.id}`}>View</Link><button className="font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={busyId === order.id} onClick={() => void receiveOrder(order)}>{busyId === order.id ? 'Saving' : 'Receive'}</button></div></td></tr>))}</tbody></table>
            {orders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No lookup results yet.</p> : null}
          </div>
        </div>
      </div>
    </PageCard>
  );
}
