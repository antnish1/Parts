import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getTestOrders } from '../../services/testData.service';
import { forwardTestOrderToManager, resetTestOrderItemQty, setTestOrderApproved, setTestOrderManagerApproved, setTestOrderManagerRejected, setTestOrderRejected, updateTestOrderItemQty } from '../../services/testApproval.service';
import { getTestOrderView } from '../../services/testOrderView.service';
import { getEffectiveQty, getEffectiveValue } from '../../lib/orderLogic';
import { getStatusRowClasses } from '../../lib/statusRowStyles';

export function ApprovalsPage() {
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');
  const [reviewId, setReviewId] = useState('');
  const [editedQty, setEditedQty] = useState<Record<string, string>>({});
  const { data: orders = [], refetch, isLoading } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const reviewQuery = useQuery({ queryKey: ['approval-review', reviewId], queryFn: () => getTestOrderView(reviewId), enabled: !!reviewId });

  const pendingOrders = useMemo(() => orders.filter((order) => order.status.includes('pending')), [orders]);
  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return pendingOrders;
    return pendingOrders.filter((order) => `${order.order_no} ${order.branch} ${order.order_type} ${order.customer_name ?? ''} ${order.machine_no ?? ''}`.toLowerCase().includes(term));
  }, [pendingOrders, search]);

  const counts = {
    pending: orders.filter((order) => order.status === 'pending_approval').length,
    manager: orders.filter((order) => order.status === 'pending_manager_approval').length,
    approved: orders.filter((order) => order.status === 'approved').length,
    rejected: orders.filter((order) => order.status === 'rejected').length,
  };

  async function runAction(order: (typeof orders)[number], action: 'approve' | 'reject' | 'forward' | 'managerApprove' | 'managerReject') {
    setMessage('');
    setBusyId(`${order.id}-${action}`);
    try {
      if (action === 'approve') await setTestOrderApproved(order);
      if (action === 'reject') await setTestOrderRejected(order);
      if (action === 'forward') await forwardTestOrderToManager(order);
      if (action === 'managerApprove') await setTestOrderManagerApproved(order);
      if (action === 'managerReject') await setTestOrderManagerRejected(order);
      const labels = { approve: 'approved', reject: 'rejected', forward: 'forwarded to manager', managerApprove: 'manager approved', managerReject: 'manager rejected' };
      setMessage(`${order.order_no} ${labels[action]}.`);
      if (reviewId === order.id) setReviewId('');
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Approval action failed.');
    } finally {
      setBusyId('');
    }
  }

  async function saveItemQty(itemId: string) {
    const qty = Number(editedQty[itemId] ?? '');
    setMessage('');
    setBusyId(itemId);
    try {
      await updateTestOrderItemQty(itemId, qty);
      setMessage('Edited quantity saved.');
      await reviewQuery.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Quantity update failed.');
    } finally {
      setBusyId('');
    }
  }

  async function resetItemQty(itemId: string) {
    setMessage('');
    setBusyId(itemId);
    try {
      await resetTestOrderItemQty(itemId);
      setEditedQty((current) => ({ ...current, [itemId]: '' }));
      setMessage('Edited quantity reset.');
      await reviewQuery.refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Quantity reset failed.');
    } finally {
      setBusyId('');
    }
  }

  return (
    <PageCard eyebrow="Approvals" title="Approval Queue" description="Review, approve, reject, or forward pending orders to manager.">
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
        <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
          <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Order No</th><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Type</th><th className="px-2.5 py-2">Customer</th><th className="px-2.5 py-2">Machine</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2 text-right">Action</th></tr></thead>
          <tbody className="divide-y divide-[#263244] bg-[#111827]">
            {filteredOrders.map((order) => {
              const isManagerQueue = order.status === 'pending_manager_approval';
              return (
                <tr key={order.id} className={getStatusRowClasses(order.status)}><td className="px-2.5 py-2 font-black text-white">{order.order_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.order_type}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.customer_name ?? '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.machine_no ?? '-'}</td><td className="px-2.5 py-2"><StatusBadge status={order.status} /></td><td className="px-2.5 py-2 text-right"><div className="flex justify-end gap-3"><button className="font-black text-[#82C8E5] hover:underline" onClick={() => setReviewId(order.id)}>Review</button><Link className="font-black text-[#82C8E5] hover:underline" to={`/orders/${order.id}`}>View</Link>{isManagerQueue ? <button className="font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={!!busyId} onClick={() => void runAction(order, 'managerApprove')}>Manager Approve</button> : <button className="font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={!!busyId} onClick={() => void runAction(order, 'approve')}>Approve</button>}{isManagerQueue ? <button className="font-black text-[#ef6f7b] hover:underline disabled:opacity-40" disabled={!!busyId} onClick={() => void runAction(order, 'managerReject')}>Manager Reject</button> : <button className="font-black text-[#ef6f7b] hover:underline disabled:opacity-40" disabled={!!busyId} onClick={() => void runAction(order, 'reject')}>Reject</button>}{!isManagerQueue ? <button className="font-black text-[#c7d2df] hover:underline disabled:opacity-40" disabled={!!busyId} onClick={() => void runAction(order, 'forward')}>Forward Manager</button> : null}</div></td></tr>
              );
            })}
          </tbody>
        </table>
        {filteredOrders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No pending orders found.</p> : null}
      </div>

      {reviewId ? (
        <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <div className="mb-2 flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Item Review</p><button className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => setReviewId('')}>Close</button></div>
          {reviewQuery.isLoading ? <p className="text-xs text-[#c7d2df]">Loading item review...</p> : null}
          {reviewQuery.data ? <p className="mb-2 text-xs text-[#c7d2df]">{reviewQuery.data.order.order_no} • {reviewQuery.data.order.branch} • edit qty before approval</p> : null}
          <div className="overflow-hidden rounded-md border border-[#263244]"><table className="w-full min-w-[900px] border-collapse text-left text-xs"><thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Part No</th><th className="px-2.5 py-2">Description</th><th className="px-2.5 py-2 text-right">Qty</th><th className="px-2.5 py-2 text-right">Edited</th><th className="px-2.5 py-2 text-right">DNP</th><th className="px-2.5 py-2 text-right">Value</th><th className="px-2.5 py-2 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#263244]">{reviewQuery.data?.items.map((item) => (<tr key={item.id} className="bg-[#111827]"><td className="px-2.5 py-2 font-black text-white">{item.part_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.description || '-'}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{item.qty}</td><td className="px-2.5 py-2 text-right"><input className="w-20 rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1 text-right text-xs text-white outline-none focus:border-[#82C8E5]" value={editedQty[item.id] ?? String(item.edited_qty ?? getEffectiveQty(item))} onChange={(event) => setEditedQty((current) => ({ ...current, [item.id]: event.target.value }))} /></td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{item.dnp ?? 0}</td><td className="px-2.5 py-2 text-right font-black text-white">₹{getEffectiveValue(item).toFixed(2)}</td><td className="px-2.5 py-2 text-right"><div className="flex justify-end gap-3"><button className="font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={busyId === item.id} onClick={() => void saveItemQty(item.id)}>Save</button><button className="font-black text-[#ef6f7b] hover:underline disabled:opacity-40" disabled={busyId === item.id} onClick={() => void resetItemQty(item.id)}>Reset</button></div></td></tr>))}</tbody></table></div>
        </div>
      ) : null}
    </PageCard>
  );
}
