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
    ['Order No', orderNo],
    ['Branch', branch],
    ['Order Type', orderType],
    ['Order For', orderFor === 'Customer' ? customerName || 'Customer' : 'Stock'],
    ['Approver', approverName || '-'],
    ['Total Items', String(totalItems)],
    ['Order Value', `₹${totalValue.toFixed(2)}`],
  ];

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-[#020617]/75 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[#82C8E5]/40 bg-[#0b1020] shadow-[0_0_90px_rgba(130,200,229,0.22)]">
        <div className="border-b border-[#263244] bg-[#111827] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#82C8E5]">Order Created Successfully</p>
              <h2 className="mt-1 text-2xl font-black text-white">{orderNo}</h2>
              <p className="mt-1 text-xs font-semibold text-[#c7d2df]">The order screen has been reset for a fresh entry.</p>
            </div>
            <button type="button" className="rounded-xl border border-[#263244] px-3 py-1.5 text-xs font-black text-[#82C8E5] hover:border-[#82C8E5]" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="grid gap-2 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[#263244] bg-[#111827] px-3 py-2.5">
              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#6D8196]">{label}</p>
              <p className="mt-1 text-sm font-black text-white">{value}</p>
            </div>
          ))}
        </div>
        <div className="flex justify-end border-t border-[#263244] px-5 py-3">
          <button type="button" className="rounded-xl bg-[#ffd94a] px-5 py-2 text-sm font-black text-[#0b1020] hover:bg-[#ffe177]" onClick={onClose}>Create Next Order</button>
        </div>
      </div>
    </div>
  );
}
