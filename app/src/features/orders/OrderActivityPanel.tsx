import type { TestOrderEvent } from '../../services/testOrderView.service';

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function OrderActivityPanel({ events }: { events: TestOrderEvent[] }) {
  return (
    <div className="rounded-lg border border-[#d9dee7] bg-[#f8fbff] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#0f4c81]">Order Activity ({events.length})</p>
      </div>
      <div className="space-y-2">
        {events.map((event) => (
          <div key={event.id} className="rounded-md border border-[#d9dee7] bg-white px-2.5 py-2 text-xs">
            <p className="font-black text-[#0f172a]">{event.event_type}</p>
            <p className="text-[#667085]">{event.notes || '-'} • {formatDate(event.created_at)}</p>
          </div>
        ))}
        {events.length === 0 ? <p className="text-xs text-[#667085]">No activity yet.</p> : null}
      </div>
    </div>
  );
}
