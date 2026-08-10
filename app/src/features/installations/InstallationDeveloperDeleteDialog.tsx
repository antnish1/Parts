import { Trash2, X } from 'lucide-react';
import type { InstallationEntry } from '../../services/installations.service';

export function InstallationDeveloperDeleteDialog({ entry, reason, busy, onReasonChange, onCancel, onConfirm }: {
  entry: InstallationEntry | null;
  reason: string;
  busy: boolean;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!entry) return null;
  const ready = reason.trim().length >= 3;
  return <div className="fixed inset-0 z-[110] grid place-items-center bg-[#07111f]/60 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
    <div className="w-full max-w-[430px] overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
      <div className="flex items-start gap-3 border-b border-red-100 bg-red-50 p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-red-700"><Trash2 className="h-5 w-5"/></div>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-black text-[#172033]">Delete Engine & Breaker Entry</h2><p className="mt-1 text-xs leading-5 text-[#64748b]">{entry.entry_no} • {entry.invoice_no}. This is available only to Developer users and is permanently audited.</p></div>
        <button type="button" disabled={busy} onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-lg border border-red-100 bg-white text-[#475569]"><X className="h-4 w-4"/></button>
      </div>
      <div className="p-4">
        <label className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">Mandatory deletion reason</label>
        <textarea autoFocus value={reason} onChange={(event) => onReasonChange(event.target.value)} rows={3} placeholder="Explain why this entry must be deleted…" className="mt-1.5 w-full resize-none rounded-lg border border-[#cbd5e1] px-3 py-2 text-xs font-semibold outline-none focus:border-red-400" />
        <p className="mt-2 text-[10px] leading-4 text-[#64748b]">The database record and linked item/document metadata will be removed from the live workflow. A permanent snapshot is retained in the developer override audit log; stored files are cleaned up after deletion.</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-[#e2e8f0] p-3">
        <button type="button" disabled={busy} onClick={onCancel} className="h-9 rounded-lg border border-[#cbd5e1] bg-white px-4 text-xs font-semibold text-[#334155]">Cancel</button>
        <button type="button" disabled={!ready || busy} onClick={onConfirm} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-black text-white hover:bg-red-700 disabled:opacity-40"><Trash2 className="h-3.5 w-3.5"/>{busy ? 'Deleting…' : 'Delete Entry'}</button>
      </div>
    </div>
  </div>;
}
