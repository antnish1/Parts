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
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#020617]/80 px-3 py-5 backdrop-blur-md">
      <div className="relative w-full max-w-[760px] overflow-hidden rounded-[2rem] border border-[#ffd94a]/55 bg-[#06111f] shadow-[0_0_110px_rgba(255,217,74,0.25)]">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#ffd94a]/25 blur-3xl" />
        <div className="absolute -right-20 top-12 h-72 w-72 rounded-full bg-[#82C8E5]/20 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-24 w-full bg-gradient-to-t from-[#ffd94a]/10 to-transparent" />

        <button
          type="button"
          aria-label="Close order success popup"
          className="absolute right-4 top-4 z-20 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-black text-white/85 backdrop-blur hover:bg-white/20"
          onClick={onClose}
        >
          ×
        </button>

        <div className="relative z-10 p-5 sm:p-7">
          <div className="mx-auto max-w-[660px] rounded-[1.75rem] border border-white/12 bg-[#0b1020]/92 p-4 shadow-2xl sm:p-6">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#ffd94a]">Parts Connect Portal</p>
                <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">Order Created</h2>
              </div>
              <div className="rounded-2xl border border-[#22c55e]/35 bg-[#22c55e]/12 px-3 py-2 text-center">
                <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#86efac]">Status</p>
                <p className="text-sm font-black text-[#bbf7d0]">SUCCESS</p>
              </div>
            </div>

            <div className="my-5 rounded-[1.5rem] border border-[#ffd94a]/35 bg-gradient-to-br from-[#ffd94a] via-[#ffe68a] to-[#82C8E5] p-[1px] shadow-[0_18px_70px_rgba(255,217,74,0.22)]">
              <div className="rounded-[1.45rem] bg-[#08111f] px-4 py-5 text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#82C8E5]">Order Number</p>
                <p className="mt-2 break-words text-3xl font-black tracking-tight text-[#ffd94a] sm:text-4xl">{orderNo}</p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-3 shadow-inner shadow-white/5">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#8ea6bd]">{label}</p>
                  <p className="mt-1.5 text-sm font-black leading-5 text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-[#82C8E5]/25 bg-[#82C8E5]/10 px-4 py-3 text-center">
              <p className="text-xs font-bold leading-5 text-[#d8e3ee]">Ready to share in WhatsApp group</p>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#82C8E5]">Frontier Commercial Vehicle Pvt. Ltd.</p>
            </div>
          </div>

          <div className="mt-4 flex justify-center">
            <button type="button" className="rounded-2xl bg-[#ffd94a] px-7 py-2.5 text-sm font-black text-[#07111f] shadow-lg shadow-[#ffd94a]/25 hover:bg-[#ffe177]" onClick={onClose}>Create Next Order</button>
          </div>
        </div>
      </div>
    </div>
  );
}
