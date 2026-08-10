import { AlertCircle, CheckCircle2, Trash2, X } from 'lucide-react';

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', busy = false, tone = 'primary', onConfirm, onCancel }: { open: boolean; title: string; message: string; confirmLabel?: string; cancelLabel?: string; busy?: boolean; tone?: 'primary' | 'success' | 'danger'; onConfirm: () => void; onCancel: () => void }) {
  if (!open) return null;
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'danger' ? Trash2 : AlertCircle;
  const iconClass = tone === 'danger' ? 'bg-red-50 text-red-700' : tone === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-[#dceeff] text-[#0f5fa8]';
  const confirmClass = tone === 'danger' ? 'bg-red-600 hover:bg-red-700' : tone === 'success' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#0f5fa8] hover:bg-[#0b4d8a]';
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-[#07111f]/55 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
    <div className="w-full max-w-[390px] overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl">
      <div className="flex items-start gap-3 border-b border-[#e2e8f0] bg-[#f8fbff] p-4">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconClass}`}><Icon className="h-5 w-5"/></div>
        <div className="min-w-0 flex-1"><h2 id="confirm-dialog-title" className="text-sm font-bold text-[#0f172a]">{title}</h2><p className="mt-1 text-xs leading-5 text-[#526173]">{message}</p></div>
        <button type="button" onClick={onCancel} disabled={busy} className="grid h-8 w-8 place-items-center rounded-lg border border-[#d7e0ea] bg-white text-[#475569] hover:bg-[#f1f5f9] disabled:opacity-50" aria-label="Close"><X className="h-4 w-4"/></button>
      </div>
      <div className="flex justify-end gap-2 p-3">
        <button type="button" onClick={onCancel} disabled={busy} className="h-9 rounded-lg border border-[#cbd5e1] bg-white px-4 text-xs font-semibold text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50">{cancelLabel}</button>
        <button type="button" onClick={onConfirm} disabled={busy} className={`h-9 rounded-lg px-5 text-xs font-semibold text-white shadow-sm disabled:opacity-60 ${confirmClass}`}>{busy ? 'Please wait…' : confirmLabel}</button>
      </div>
    </div>
  </div>;
}
