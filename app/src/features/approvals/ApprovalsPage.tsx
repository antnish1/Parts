import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getTestOrders } from '../../services/testData.service';
import { setTestOrderApproved, setTestOrderRejected } from '../../services/testApproval.service';
import { getStatusRowClasses } from '../../lib/statusRowStyles';

export function ApprovalsPage() {
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const { data: orders = [], refetch, isLoading } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });

  const pendingOrders = useMemo(() => orders.filter((order) => order.status.includes('pending')), [orders]);
  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pendingOrders;
    return pendingOrders.filter((order) => `${order.order_no} ${order.branch} ${order.order_type} ${order.customer_name ?? ''} ${order.machine_no ?? ''}`.toLowerCase().includes(term));
  }, [pendingOrders, search]);

  const counts = {
    pending: pendingOrders.length,
    manager: orders.filter((order) => order.status === 'pending_manager_approval').length,
    approved: orders.filter((order) => order.status === 'approved').length,
    rejected: orders.filter((order) => order.status === 'rejected').length,
  };

  async function runAction(order: (typeof orders)[number], action: 'approve' | 'reject') {
    setMessage('');
    setBusyId(order.id);
    try {
      if (action === 'approve') await setTestOrderApproved(order);
      else await setTestOrderRejected(order);
      setMessage(`${order.order_no} ${action === 'approve' ? 'approved' : 'rejected'}.`);
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Approval action failed.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <PageCard eyebrow="Approvals" title="Approval Queue" description="Review and approve pending orders.">
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Pending</p><p className="text-sm font-black text-white">{counts.pending}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Manager</p><p className="text-sm font-black text-white">{counts.manager}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Approved</p><p className="text-sm font-black text-white">{counts.approved}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Rejected</p><p className="text-sm font-black text-white">{counts.rejected}</p></div>
      </div>

      <div className="mb-2 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <input className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5] lg:w-96" placeholder="Search order, branch, customer, machine" value={search} onChange={(event) => setSearch(event.target.value)} />
        {message ? <p className="text-xs text-[#c7d2df]">{message}</p> : null}
      </div>

      {isLoading ? <p className="text-xs text-[#c7d2df]">Loading approvals...</p> : null}
      <div className="overflow-hidden rounded-lg border border-[#263244]">
        <table className="w-full min-w-[840px] border-collapse text-left text-xs">
          <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Order No</th><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Type</th><th className="px-2.5 py-2">Customer</th><th className="px-2.5 py-2">Machine</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-[#263244] bg-[#111827]">
            {filteredOrders.map((order) => (
              <tr key={order.id} className={getStatusRowClasses(order.status)}><td className="px-2.5 py-2 font-black text-white">{order.order_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.order_type}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.customer_name ?? '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.machine_no ?? '-'}</td><td className="px-2.5 py-2"><StatusBadge status={order.status} /></td><td className="px-2.5 py-2 text-right"><div className="flex justify-end gap-3"><Link className="font-black text-[#82C8E5] hover:underline" to={`/orders/${order.id}`}>View</Link><button className="font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={busyId === order.id} onClick={() => void runAction(order, 'approve')}>Approve</button><button className="font-black text-[#ef6f7b] hover:underline disabled:opacity-40" disabled={busyId === order.id} onClick={() => void runAction(order, 'reject')}>Reject</button></div></td></tr>
            ))}
          </tbody>
        </table>
        {filteredOrders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No pending orders found.</p> : null}
      </div>
    </PageCard>
  );
}
