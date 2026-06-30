import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { getTestOrders } from '../../services/testData.service';
import { setTestOrderProcessed } from '../../services/testAdmin.service';

export function AdminPage() {
  const [search, setSearch] = useState('');
  const { data: orders = [], refetch } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const approvedOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const isApproved = order.status === 'approved';
      const matchesSearch = !term || `${order.order_no} ${order.branch} ${order.customer_name ?? ''} ${order.machine_no ?? ''}`.toLowerCase().includes(term);
      return isApproved && matchesSearch;
    });
  }, [orders, search]);
  const processedOrders = orders.filter((order) => order.status === 'processed').slice(0, 5);

  return (
    <PageCard eyebrow="Admin" title="Admin Processing" description="Processes approved test_orders only.">
      <input
        className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-pc-gold"
        placeholder="Search approved orders by order, branch, customer, or machine"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <p className="text-sm font-black text-white">Approved Orders</p>
          {approvedOrders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="font-black text-white">{order.order_no}</p>
              <p className="text-sm text-pc-muted">{order.branch} - {order.customer_name ?? '-'} - {order.status}</p>
              <div className="mt-3">
                <Button onClick={async () => { await setTestOrderProcessed(order); await refetch(); }}>Process Test</Button>
              </div>
            </div>
          ))}
          {approvedOrders.length === 0 ? <p className="text-sm text-pc-muted">No approved test orders.</p> : null}
        </div>
        <div className="space-y-3">
          <p className="text-sm font-black text-white">Recently Processed</p>
          {processedOrders.map((order) => (
            <div key={order.id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <p className="font-black text-white">{order.order_no}</p>
              <p className="text-sm text-pc-muted">{order.branch} - {order.customer_name ?? '-'} - processed</p>
            </div>
          ))}
          {processedOrders.length === 0 ? <p className="text-sm text-pc-muted">No processed test orders yet.</p> : null}
        </div>
      </div>
    </PageCard>
  );
}
