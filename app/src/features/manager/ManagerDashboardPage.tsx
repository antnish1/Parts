import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getDashboardSummary, getTestOrders } from '../../services/testData.service';
import { summarizeByBranch, summarizeByStatus } from '../../services/testReport.service';

const cards = [
  { key: 'totalOrders', label: 'Total Orders' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'processed', label: 'Processed' },
  { key: 'rejected', label: 'Rejected' },
] as const;

export function ManagerDashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['test-dashboard-summary'], queryFn: getDashboardSummary });
  const { data: orders = [] } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const branchRows = summarizeByBranch(orders);
  const statusRows = summarizeByStatus(orders);
  const latestOrders = orders.slice(0, 8);

  return (
    <PageCard eyebrow="Manager" title="Manager Dashboard" description="Operational order summary workspace.">
      {isLoading ? <p className="text-xs text-[#c7d2df]">Loading dashboard...</p> : null}
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.key} className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6D8196]">{card.label}</p>
            <p className="mt-1 text-lg font-black text-white">{data?.[card.key] ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Branch Summary</p>
          {branchRows.map((row) => (
            <div key={row.label} className="flex justify-between border-t border-[#263244] py-1.5 text-xs">
              <span className="text-[#c7d2df]">{row.label}</span>
              <span className="font-black text-white">{row.count}</span>
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Status Summary</p>
          {statusRows.map((row) => (
            <div key={row.label} className="flex justify-between border-t border-[#263244] py-1.5 text-xs">
              <span className="text-[#c7d2df]">{row.label}</span>
              <span className="font-black text-white">{row.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Latest Orders</p>
        <div className="overflow-hidden rounded-md border border-[#263244]">
          <table className="w-full min-w-[720px] border-collapse text-left text-xs">
            <thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]">
              <tr>
                <th className="px-2.5 py-2">Order No</th>
                <th className="px-2.5 py-2">Branch</th>
                <th className="px-2.5 py-2">Customer</th>
                <th className="px-2.5 py-2">Type</th>
                <th className="px-2.5 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263244]">
              {latestOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-2.5 py-2 font-black text-white">{order.order_no}</td>
                  <td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td>
                  <td className="px-2.5 py-2 text-[#d8e3ee]">{order.customer_name ?? '-'}</td>
                  <td className="px-2.5 py-2 text-[#d8e3ee]">{order.order_type}</td>
                  <td className="px-2.5 py-2"><StatusBadge status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {latestOrders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No orders found.</p> : null}
        </div>
      </div>
    </PageCard>
  );
}
