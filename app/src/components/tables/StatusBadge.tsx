import { clsx } from 'clsx';
import { normalizeStatus } from '../../lib/orderLogic';

type StatusBadgeProps = {
  status: string;
};

const statusStyles: Record<string, string> = {
  'PENDING APPROVAL': 'text-[#1d4ed8]',
  'PENDING MANAGER APPROVAL': 'text-[#4338ca]',
  APPROVED: 'text-[#047857]',
  PROCESSED: 'text-[#3730a3]',
  ISSUED: 'text-[#6d28d9]',
  RECEIVED: 'text-[#0f766e]',
  'PARTIALLY RECEIVED': 'text-[#0e7490]',
  'PARTIALLY DISPATCHED': 'text-[#6d28d9]',
  REJECTED: 'text-[#be123c]',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-none border-0 bg-transparent px-0 py-0 text-[10px] font-black uppercase tracking-[0.12em] shadow-none', statusStyles[normalized] ?? 'text-[#344054]')} style={{ backgroundColor: 'transparent' }}>
      {normalized || 'NA'}
    </span>
  );
}
