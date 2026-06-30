import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { getDashboardSummary } from '../../services/testData.service';

const cards = [
  { key: 'totalOrders', label: 'Total Orders' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'processed', label: 'Processed' },
  { key: 'rejected', label: 'Rejected' },
] as const;

export function ManagerDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['test-dashboard-summary'],
    queryFn: getDashboardSummary,
  });

  return (
    <PageCard eyebrow="Manager" title="Manager Dashboard" description="Reading summary from test_orders only. Live database tables are untouched.">
      {isLoading ? (
        <p className="text-sm text-pc-muted">Loading dashboard...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {cards.map((card) => (
            <div key={card.key} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="text-xs font-black uppercase tracking-widest text-pc-muted">{card.label}</p>
              <p className="mt-3 text-3xl font-black text-white">{data?.[card.key] ?? 0}</p>
            </div>
          ))}
        </div>
      )}
    </PageCard>
  );
}
