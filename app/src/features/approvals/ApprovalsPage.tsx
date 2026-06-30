import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { getTestOrders } from '../../services/testData.service';
import { setTestOrderApproved } from '../../services/testApproval.service';

export function ApprovalsPage() {
  const { data: orders = [], refetch } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const pendingOrders = orders.filter((order) => order.status.includes('pending'));

  return (
    <PageCard eyebrow="Approvals" title="Approval Queue" description="Test queue using test_orders only.">
      <div className="space-y-3">
        {pendingOrders.map((order) => (
          <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="font-black text-white">{order.order_no}</p>
            <p className="text-sm text-pc-muted">{order.branch} - {order.status}</p>
            <Button onClick={async () => { await setTestOrderApproved(order); await refetch(); }}>Approve Test</Button>
          </div>
        ))}
        {pendingOrders.length === 0 ? <p className="text-sm text-pc-muted">No pending test orders.</p> : null}
      </div>
    </PageCard>
  );
}
