import { clsx } from 'clsx';
import { normalizeStatus } from '../../lib/orderLogic';

type StatusBadgeProps = {
  status: string;
};

const statusStyles: Record<string, string> = {
  'PENDING APPROVAL': 'text-[#82C8E5]',
  'PENDING MANAGER APPROVAL': 'text-[#82C8E5]',
  APPROVED: 'text-[#8ee6ff]',
  PROCESSED: 'text-[#b7d4ff]',
  ISSUED: 'text-[#b7d4ff]',
  RECEIVED: 'text-[#8ee6ff]',
  'PARTIALLY RECEIVED': 'text-[#8ee6ff]',
  REJECTED: 'text-[#ff9cad]',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  return (
    <span className={clsx('inline-flex items-center gap-1.5 bg-transparent px-0 py-0 text-[10px] font-black uppercase tracking-[0.12em] shadow-none', statusStyles[normalized] ?? 'text-[#c7d2df]')} style={{ backgroundColor: 'transparent' }}>
      {normalized || 'NA'}
    </span>
  );
}
