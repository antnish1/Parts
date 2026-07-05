type OrderPlacedSummaryProps = {
  orderNo: string;
  branch: string;
  orderType: string;
  orderFor: string;
  customerName: string;
  approverName: string;
  totalItems: number;
  totalValue: number;
  onClose: () => void;
};

export function OrderPlacedSummary({ orderNo, branch, orderType, orderFor, customerName, approverName, totalItems, totalValue, onClose }: OrderPlacedSummaryProps) {
  const rows = [
    ['Branch', branch],
    ['Order Type', orderType],
    ['Order For', orderFor === 'Customer' ? customerName || 'Customer' : 'Stock'],
    ['Approver', approverName || '-'],
    ['Total Items', String(totalItems)],
    ['Order Value', `₹${totalValue.toFixed(2)}`],
  ];

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#020617]/72 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-[540px] overflow-hidden rounded-3xl border border-[#d8e3ee] bg-white shadow-[0_28px_90px_rgba(2,6,23,0.42)]">
        <div className="border-b border-[#e5edf5] bg-[#f8fafc] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d4a600]">Parts Connect Portal</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#101827]">Order Created</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-[#86efac] bg-[#ecfdf5] px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#15803d]">Success</div>
              <button type="button" aria-label="Close order success popup" className="rounded-full border border-[#d8e3ee] bg-white px-2.5 py-1 text-sm font-black text-[#64748b] hover:bg-[#f1f5f9]" onClick={onClose}>×</button>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          <div className="rounded-2xl border border-[#ffd94a] bg-[#0b1020] px-4 py-4 text-center shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#82C8E5]">Order Number</p>
            <p className="mt-2 break-words text-2xl font-black tracking-tight text-[#ffd94a] sm:text-3xl">{orderNo}</p>
          </div>

          <div className="mt-4 overflow-hidden rounded-2xl border border-[#e5edf5]">
            {rows.map(([label, value], index) => (
              <div key={label} className={`flex items-center justify-between gap-4 bg-white px-4 py-3 ${index === 0 ? '' : 'border-t border-[#e5edf5]'}`}>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#8ea6bd]">{label}</p>
                <p className="max-w-[60%] text-right text-sm font-black leading-5 text-[#101827]">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-[#e5edf5] bg-[#f8fafc] px-4 py-3 text-center">
            <p className="text-[11px] font-bold text-[#475569]">Frontier Commercial Vehicle Pvt. Ltd.</p>
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#94a3b8]">Ready for WhatsApp sharing</p>
          </div>
        </div>

        <div className="border-t border-[#e5edf5] bg-[#f8fafc] px-5 py-3 text-center">
          <button type="button" className="rounded-xl bg-[#ffd94a] px-6 py-2 text-sm font-black text-[#101827] shadow-sm hover:bg-[#ffe177]" onClick={onClose}>Create Next Order</button>
        </div>
      </div>
    </div>
  );
}
