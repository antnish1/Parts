import { clsx } from 'clsx';
import { normalizeStatus } from '../../lib/orderLogic';

type StatusBadgeProps = {
  status: string;
};

const statusStyles: Record<string, string> = {
  'PENDING APPROVAL': 'text-[#82C8E5] before:bg-[#82C8E5]',
  'PENDING MANAGER APPROVAL': 'text-[#82C8E5] before:bg-[#82C8E5]',
  APPROVED: 'text-[#8ee6ff] before:bg-[#8ee6ff]',
  PROCESSED: 'text-[#b7d4ff] before:bg-[#b7d4ff]',
  ISSUED: 'text-[#b7d4ff] before:bg-[#b7d4ff]',
  RECEIVED: 'text-[#8ee6ff] before:bg-[#8ee6ff]',
  'PARTIALLY RECEIVED': 'text-[#8ee6ff] before:bg-[#8ee6ff]',
  REJECTED: 'text-[#ff9cad] before:bg-[#ff9cad]',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  return (
    <span className={clsx('inline-flex items-center gap-1.5 bg-transparent px-0 py-0 text-[10px] font-black uppercase tracking-[0.12em] shadow-none before:h-1.5 before:w-1.5 before:rounded-full', statusStyles[normalized] ?? 'text-[#c7d2df] before:bg-[#6D8196]')} style={{ backgroundColor: 'transparent' }}>
      {normalized || 'NA'}
    </span>
  );
}
