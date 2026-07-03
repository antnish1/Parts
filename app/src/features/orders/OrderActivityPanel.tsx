import { useState } from 'react';
import type { TestOrderEvent } from '../../services/testOrderView.service';

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

export function OrderActivityPanel({ events }: { events: TestOrderEvent[] }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Order Activity</p>
        <button type="button" className="no-print text-xs font-black text-[#82C8E5] hover:underline" onClick={() => setVisible((current) => !current)}>
          {visible ? 'Hide Activity' : `Show Activity (${events.length})`}
        </button>
      </div>
      {visible ? (
        <div className="space-y-2">
          {events.map((event) => (
            <div key={event.id} className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-2 text-xs">
              <p className="font-black text-white">{event.event_type}</p>
              <p className="text-[#c7d2df]">{event.notes || '-'} • {formatDate(event.created_at)}</p>
            </div>
          ))}
          {events.length === 0 ? <p className="text-xs text-[#c7d2df]">No activity yet.</p> : null}
        </div>
      ) : (
        <p className="text-xs text-[#c7d2df]">Activity is collapsed so user comments remain easy to read.</p>
      )}
    </div>
  );
}
