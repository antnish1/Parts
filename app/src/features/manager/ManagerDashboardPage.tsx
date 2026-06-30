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
    <PageCard eyebrow="Manager" title="Manager Dashboard" description="Reading summary from test_orders only. Live database tables are untouched.">
      {isLoading ? <p className="text-sm text-pc-muted">Loading dashboard...</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-pc-muted">{card.label}</p>
            <p className="mt-3 text-3xl font-black text-white">{data?.[card.key] ?? 0}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="mb-3 text-sm font-black text-white">Branch Summary</p>
          {branchRows.map((row) => (
            <div key={row.label} className="flex justify-between border-t border-slate-800 py-2 text-sm">
              <span className="text-pc-muted">{row.label}</span>
              <span className="font-black text-white">{row.count}</span>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <p className="mb-3 text-sm font-black text-white">Status Summary</p>
          {statusRows.map((row) => (
            <div key={row.label} className="flex justify-between border-t border-slate-800 py-2 text-sm">
              <span className="text-pc-muted">{row.label}</span>
              <span className="font-black text-white">{row.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <p className="mb-3 text-sm font-black text-white">Latest Test Orders</p>
        <div className="overflow-hidden rounded-xl border border-slate-800">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-slate-900 text-xs uppercase tracking-wider text-pc-muted">
              <tr>
                <th className="px-4 py-3">Order No</th>
                <th className="px-4 py-3">Branch</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {latestOrders.map((order) => (
                <tr key={order.id}>
                  <td className="px-4 py-3 font-black text-white">{order.order_no}</td>
                  <td className="px-4 py-3 text-slate-300">{order.branch}</td>
                  <td className="px-4 py-3 text-slate-300">{order.customer_name ?? '-'}</td>
                  <td className="px-4 py-3 text-slate-300">{order.order_type}</td>
                  <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {latestOrders.length === 0 ? <p className="p-4 text-sm text-pc-muted">No test orders found.</p> : null}
        </div>
      </div>
    </PageCard>
  );
}
