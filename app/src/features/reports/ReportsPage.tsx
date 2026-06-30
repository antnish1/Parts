import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { getTestOrders } from '../../services/testData.service';
import { downloadOrdersCsv, summarizeByBranch, summarizeByStatus } from '../../services/testReport.service';

export function ReportsPage() {
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const branchRows = summarizeByBranch(orders);
  const statusRows = summarizeByStatus(orders);

  return (
    <PageCard eyebrow="Reports" title="Reports" description="Reports from test_orders only. Live tables are not used.">
      <div className="mb-4 flex justify-end">
        <Button onClick={() => downloadOrdersCsv(orders)} disabled={orders.length === 0}>Download Test CSV</Button>
      </div>
      {isLoading ? <p className="text-sm text-pc-muted">Loading test reports...</p> : null}
      <div className="grid gap-4 lg:grid-cols-2">
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
    </PageCard>
  );
}
