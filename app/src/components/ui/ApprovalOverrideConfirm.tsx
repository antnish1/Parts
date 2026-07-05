import { AlertTriangle, X } from 'lucide-react';

type ApprovalOverrideConfirmProps = {
  open: boolean;
  approverName: string;
  orderNo?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ApprovalOverrideConfirm({ open, approverName, orderNo, busy = false, onCancel, onConfirm }: ApprovalOverrideConfirmProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center bg-[#020617]/62 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-[#d9dee7] bg-white shadow-[0_26px_90px_rgba(16,24,40,0.30)]">
        <div className="h-1.5 bg-[#0f4c81]" />
        <div className="relative p-5">
          <button type="button" className="absolute right-4 top-4 rounded-full border border-[#d9dee7] bg-white p-1.5 text-[#667085] transition hover:bg-[#f2f4f7] hover:text-[#101827]" onClick={onCancel} disabled={busy} aria-label="Close confirmation">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-4 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#fedf89] bg-[#fffaeb]">
              <AlertTriangle className="h-6 w-6 text-[#b54708]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f4c81]">Manager Override</p>
              <h2 className="mt-1 text-lg font-black leading-6 text-[#101827]">Approve this order directly?</h2>
              {orderNo ? <p className="mt-1 text-xs font-bold text-[#667085]">Order No: <span className="text-[#101827]">{orderNo}</span></p> : null}
            </div>
          </div>
          <div className="mt-5 rounded-2xl border border-[#e4e7ec] bg-[#f8fbff] px-4 py-3">
            <p className="text-sm font-bold leading-6 text-[#344054]">
              <span className="font-black text-[#101827]">{approverName}</span> has been selected as approver for this order. Are you sure you want to approve it directly as manager?
            </p>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-[#eef2f6] pt-4">
            <button type="button" className="rounded-xl border border-[#d9dee7] bg-white px-4 py-2 text-sm font-black text-[#344054] transition hover:bg-[#f2f4f7] disabled:opacity-50" onClick={onCancel} disabled={busy}>Cancel</button>
            <button type="button" className="rounded-xl bg-[#0f4c81] px-4 py-2 text-sm font-black text-white transition hover:bg-[#0b3b64] disabled:opacity-50" onClick={onConfirm} disabled={busy}>{busy ? 'Approving...' : 'Approve Directly'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
