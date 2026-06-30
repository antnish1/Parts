import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';

export function NewOrderPage() {
  return (
    <PageCard
      eyebrow="Orders"
      title="New Order"
      description="Rebuild target for the legacy order creation flow: order type, order for, approver, machine/customer details, multiple part rows, part master lookup, quantity validation, 30-day usage, and secure order submission."
    >
      <div className="grid gap-4 lg:grid-cols-3">
        {['Order details', 'Part rows', 'Validation rules'].map((item) => (
          <div key={item} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-sm font-black text-white">{item}</p>
            <p className="mt-2 text-xs leading-5 text-pc-muted">Placeholder module. Logic will be migrated from the legacy reference after auth and data services are ready.</p>
          </div>
        ))}
      </div>
      <div className="mt-5"><StatusBadge status="PENDING APPROVAL" /></div>
    </PageCard>
  );
}
