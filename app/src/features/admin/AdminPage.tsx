import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { getTestOrders } from '../../services/testData.service';
import { setTestOrderProcessed } from '../../services/testAdmin.service';

export function AdminPage() {
  const { data: orders = [], refetch } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const approvedOrders = orders.filter((order) => order.status === 'approved');

  return (
    <PageCard eyebrow="Admin" title="Admin Processing" description="Processes approved test_orders only.">
      <div className="space-y-3">
        {approvedOrders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="font-black text-white">{order.order_no}</p>
            <p className="text-sm text-pc-muted">{order.branch} - {order.status}</p>
            <Button onClick={async () => { await setTestOrderProcessed(order); await refetch(); }}>Process Test</Button>
          </div>
        ))}
        {approvedOrders.length === 0 ? <p className="text-sm text-pc-muted">No approved test orders.</p> : null}
      </div>
    </PageCard>
  );
}
