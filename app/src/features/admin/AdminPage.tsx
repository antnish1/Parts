import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getTestOrders } from '../../services/testData.service';
import { setTestOrderProcessed } from '../../services/testAdmin.service';
import { getStatusRowClasses } from '../../lib/statusRowStyles';

export function AdminPage() {
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [busyId, setBusyId] = useState('');
  const [references, setReferences] = useState<Record<string, string>>({});
  const { data: orders = [], refetch, isLoading } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });

  const approvedOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const isApproved = order.status === 'approved';
      const matchesSearch = !term || `${order.order_no} ${order.branch} ${order.order_type} ${order.customer_name ?? ''} ${order.machine_no ?? ''}`.toLowerCase().includes(term);
      return isApproved && matchesSearch;
    });
  }, [orders, search]);

  const processedOrders = useMemo(() => orders.filter((order) => order.status === 'processed').slice(0, 10), [orders]);
  const counts = {
    approved: orders.filter((order) => order.status === 'approved').length,
    processed: orders.filter((order) => order.status === 'processed').length,
    pending: orders.filter((order) => order.status.includes('pending')).length,
    rejected: orders.filter((order) => order.status === 'rejected').length,
  };

  async function processOrder(order: (typeof orders)[number]) {
    const reference = references[order.id] ?? '';
    setMessage('');
    setBusyId(order.id);
    try {
      await setTestOrderProcessed(order, reference);
      setMessage(`${order.order_no} processed with reference ${reference.trim().toUpperCase()}.`);
      setReferences((current) => ({ ...current, [order.id]: '' }));
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Processing failed.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <PageCard eyebrow="Admin" title="Admin Processing" description="Process approved orders and capture processing reference.">
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Approved</p><p className="text-sm font-black text-white">{counts.approved}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Processed</p><p className="text-sm font-black text-white">{counts.processed}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Pending</p><p className="text-sm font-black text-white">{counts.pending}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Rejected</p><p className="text-sm font-black text-white">{counts.rejected}</p></div>
      </div>

      <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <input className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5] lg:w-96" placeholder="Search approved orders" value={search} onChange={(event) => setSearch(event.target.value)} />
        {message ? <p className="text-xs text-[#c7d2df]">{message}</p> : null}
      </div>

      {isLoading ? <p className="text-xs text-[#c7d2df]">Loading admin queue...</p> : null}
      <div className="grid gap-3 xl:grid-cols-[1.4fr_0.8fr]">
        <div className="overflow-hidden rounded-lg border border-[#263244]">
          <table className="w-full min-w-[960px] border-collapse text-left text-xs">
            <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Order No</th><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Type</th><th className="px-2.5 py-2">Customer</th><th className="px-2.5 py-2">Machine</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2">Processing Ref.</th><th className="px-2.5 py-2 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-[#263244] bg-[#111827]">
              {approvedOrders.map((order) => (<tr key={order.id} className={getStatusRowClasses(order.status)}><td className="px-2.5 py-2 font-black text-white">{order.order_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.order_type}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.customer_name ?? '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.machine_no ?? '-'}</td><td className="px-2.5 py-2"><StatusBadge status={order.status} /></td><td className="px-2.5 py-2"><input className="w-36 rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="DBMS/SAP No." value={references[order.id] ?? ''} onChange={(event) => setReferences((current) => ({ ...current, [order.id]: event.target.value }))} /></td><td className="px-2.5 py-2 text-right"><div className="flex justify-end gap-3"><Link className="font-black text-[#82C8E5] hover:underline" to={`/orders/${order.id}`}>View</Link><button className="font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={busyId === order.id} onClick={() => void processOrder(order)}>{busyId === order.id ? 'Processing' : 'Process'}</button></div></td></tr>))}
            </tbody>
          </table>
          {approvedOrders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No approved orders found.</p> : null}
        </div>

        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Recently Processed</p>
          <div className="space-y-2">
            {processedOrders.map((order) => (<div key={order.id} className={`rounded-md border border-[#263244] px-2.5 py-2 ${getStatusRowClasses(order.status)}`}><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-black text-white">{order.order_no}</p><p className="text-xs text-[#c7d2df]">{order.branch} • {order.customer_name ?? '-'}</p></div><Link className="text-xs font-black text-[#82C8E5] hover:underline" to={`/orders/${order.id}`}>View</Link></div></div>))}
            {processedOrders.length === 0 ? <p className="text-xs text-[#c7d2df]">No processed orders yet.</p> : null}
          </div>
        </div>
      </div>
    </PageCard>
  );
}
