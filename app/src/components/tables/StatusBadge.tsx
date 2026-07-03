import { clsx } from 'clsx';
import { normalizeStatus } from '../../lib/orderLogic';

type StatusBadgeProps = {
  status: string;
};

const statusStyles: Record<string, string> = {
  'PENDING APPROVAL': 'border-[#6D8196]/45 bg-[#263244] text-[#dbeafe] before:bg-[#82C8E5]',
  'PENDING MANAGER APPROVAL': 'border-[#6D8196]/45 bg-[#263244] text-[#dbeafe] before:bg-[#82C8E5]',
  APPROVED: 'border-[#82C8E5]/45 bg-[#123a4a] text-[#d7f5ff] before:bg-[#82C8E5]',
  PROCESSED: 'border-[#0047AB]/45 bg-[#132f63] text-[#dbeafe] before:bg-[#0047AB]',
  ISSUED: 'border-[#0047AB]/45 bg-[#132f63] text-[#dbeafe] before:bg-[#0047AB]',
  RECEIVED: 'border-[#82C8E5]/45 bg-[#123a4a] text-[#d7f5ff] before:bg-[#82C8E5]',
  'PARTIALLY RECEIVED': 'border-[#82C8E5]/45 bg-[#123a4a] text-[#d7f5ff] before:bg-[#82C8E5]',
  REJECTED: 'border-[#ef6f7b]/45 bg-[#3b1f2a] text-[#ffe4e8] before:bg-[#ef6f7b]',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  return (
    <span className={clsx('inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] font-black uppercase tracking-[0.08em] before:h-2 before:w-2 before:rounded-sm', statusStyles[normalized] ?? 'border-[#6D8196]/45 bg-[#263244] text-[#dbeafe] before:bg-[#6D8196]')}>
      {normalized || 'NA'}
    </span>
  );
}
