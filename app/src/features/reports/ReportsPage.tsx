import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { getTestOrders } from '../../services/testData.service';
import { downloadOrdersCsv, summarizeByBranch, summarizeByStatus } from '../../services/testReport.service';

export function ReportsPage() {
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const branches = useMemo(() => [...new Set(orders.map((order) => order.branch))].sort(), [orders]);
  const statuses = useMemo(() => [...new Set(orders.map((order) => order.status))].sort(), [orders]);
  const filteredOrders = useMemo(() => orders.filter((order) => (branchFilter === 'all' || order.branch === branchFilter) && (statusFilter === 'all' || order.status === statusFilter)), [orders, branchFilter, statusFilter]);
  const branchRows = summarizeByBranch(filteredOrders);
  const statusRows = summarizeByStatus(filteredOrders);

  return (
    <PageCard eyebrow="Reports" title="Reports" description="Filtered operational reports from staging order data.">
      <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
        <select className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option value="all">All Branches</option>{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select>
        <select className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All Status</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        <Button onClick={() => downloadOrdersCsv(filteredOrders)} disabled={filteredOrders.length === 0} className="rounded-md px-3 py-1.5 text-xs">Download CSV</Button>
      </div>
      {isLoading ? <p className="text-xs text-[#c7d2df]">Loading reports...</p> : null}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Filtered</p><p className="text-sm font-black text-white">{filteredOrders.length}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Branches</p><p className="text-sm font-black text-white">{branchRows.length}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Statuses</p><p className="text-sm font-black text-white">{statusRows.length}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Total Orders</p><p className="text-sm font-black text-white">{orders.length}</p></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3"><p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Branch Summary</p>{branchRows.map((row) => (<div key={row.label} className="flex justify-between border-t border-[#263244] py-1.5 text-xs"><span className="text-[#c7d2df]">{row.label}</span><span className="font-black text-white">{row.count}</span></div>))}{branchRows.length === 0 ? <p className="text-xs text-[#c7d2df]">No branch rows.</p> : null}</div>
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3"><p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Status Summary</p>{statusRows.map((row) => (<div key={row.label} className="flex justify-between border-t border-[#263244] py-1.5 text-xs"><span className="text-[#c7d2df]">{row.label}</span><span className="font-black text-white">{row.count}</span></div>))}{statusRows.length === 0 ? <p className="text-xs text-[#c7d2df]">No status rows.</p> : null}</div>
      </div>
    </PageCard>
  );
}
