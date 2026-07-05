type OrderTypeBadgeProps = {
  type?: string | null;
};

const typeStyles: Record<string, string> = {
  VOR: 'border-[#fecaca] bg-[#fee2e2] text-[#991b1b]',
  SOP: 'border-[#bfdbfe] bg-[#dbeafe] text-[#1d4ed8]',
  ZSPL: 'border-[#bbf7d0] bg-[#dcfce7] text-[#166534]',
  ZMAC: 'border-[#ddd6fe] bg-[#ede9fe] text-[#5b21b6]',
  LUBES: 'border-[#fde68a] bg-[#fef3c7] text-[#92400e]',
};

export function OrderTypeBadge({ type }: OrderTypeBadgeProps) {
  const normalized = (type || '').trim().toUpperCase();
  const label = normalized || 'NA';
  const style = typeStyles[normalized] ?? 'border-[#cbd5e1] bg-[#f1f5f9] text-[#334155]';

  return (
    <span className={`inline-flex min-w-[46px] items-center justify-center rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.08em] shadow-sm ${style}`}>
      {label}
    </span>
  );
}
