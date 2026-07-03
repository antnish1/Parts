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
    <div className="mt-3 rounded-lg border border-[#82C8E5]/40 bg-[#0b1020] p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Order Placed</p>
        <button type="button" className="text-xs font-black text-[#82C8E5] hover:underline" onClick={onClose}>Close</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6D8196]">{label}</p>
            <p className="mt-1 text-xs font-black text-white">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
