import { useState } from 'react';
import { ShieldAlert, Trash2, X } from 'lucide-react';

type Props = {
  open: boolean;
  dispatchNo: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export function TadaListDeveloperDeleteDialog({ open, dispatchNo, busy = false, onCancel, onConfirm }: Props) {
  const [reason, setReason] = useState('');
  if (!open) return null;
  const ready = reason.trim().length >= 3;

  return <div className="fixed inset-0 z-[120] grid place-items-center bg-[#07111f]/55 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
    <div className="w-full max-w-[420px] overflow-hidden rounded-2xl border border-red-200 bg-white shadow-2xl">
      <div className="flex items-start gap-3 border-b border-red-100 bg-red-50 p-4">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-100 text-red-700"><ShieldAlert className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1"><h2 className="text-sm font-black text-[#172033]">Delete TA/DA list?</h2><p className="mt-1 text-xs leading-5 text-[#526173]">{dispatchNo} will be removed from the live workflow. The permanent Developer audit snapshot will remain.</p></div>
        <button type="button" disabled={busy} onClick={onCancel} className="grid h-8 w-8 place-items-center rounded-lg border border-red-100 bg-white text-[#475569] disabled:opacity-50"><X className="h-4 w-4" /></button>
      </div>
      <div className="p-4">
        <label className="text-[10px] font-black uppercase tracking-[0.08em] text-[#64748b]">Mandatory deletion reason</label>
        <textarea autoFocus value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Why should this TA/DA list be deleted?" className="mt-1 w-full resize-none rounded-lg border border-[#cbd5e1] bg-white px-3 py-2 text-xs font-semibold text-[#172033] outline-none focus:border-red-400" />
        <p className="mt-1 text-[10px] text-[#64748b]">Developer identity, date/time, reason and deleted data snapshot are retained in the audit log.</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-[#e2e8f0] p-3">
        <button type="button" disabled={busy} onClick={onCancel} className="h-9 rounded-lg border border-[#cbd5e1] bg-white px-4 text-xs font-bold text-[#334155] disabled:opacity-50">Cancel</button>
        <button type="button" disabled={!ready || busy} onClick={() => onConfirm(reason.trim())} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-4 text-xs font-black text-white hover:bg-red-700 disabled:opacity-40"><Trash2 className="h-4 w-4" />{busy ? 'Deleting…' : 'Delete List'}</button>
      </div>
    </div>
  </div>;
}
