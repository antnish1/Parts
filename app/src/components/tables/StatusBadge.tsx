import { clsx } from 'clsx';
import { normalizeStatus } from '../../lib/orderLogic';

type StatusBadgeProps = {
  status: string;
};

const statusStyles: Record<string, string> = {
  'PENDING APPROVAL': 'border-amber-200 bg-amber-50 text-amber-700',
  'PENDING MANAGER APPROVAL': 'border-orange-200 bg-orange-50 text-orange-700',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PROCESSED: 'border-blue-200 bg-blue-50 text-blue-700',
  DISPATCHED: 'border-violet-200 bg-violet-50 text-violet-700',
  ISSUED: 'border-slate-200 bg-slate-50 text-slate-700',
  RECEIVED: 'border-teal-200 bg-teal-50 text-teal-700',
  'PARTIALLY RECEIVED': 'border-cyan-200 bg-cyan-50 text-cyan-700',
  'PARTIALLY DISPATCHED': 'border-purple-200 bg-purple-50 text-purple-700',
  'PARTIALLY REJECTED': 'border-rose-200 bg-rose-50 text-rose-700',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-700',
};

const dotStyles: Record<string, string> = {
  'PENDING APPROVAL': 'bg-amber-500',
  'PENDING MANAGER APPROVAL': 'bg-orange-500',
  APPROVED: 'bg-emerald-500',
  PROCESSED: 'bg-blue-500',
  DISPATCHED: 'bg-violet-500',
  ISSUED: 'bg-slate-500',
  RECEIVED: 'bg-teal-500',
  'PARTIALLY RECEIVED': 'bg-cyan-500',
  'PARTIALLY DISPATCHED': 'bg-purple-500',
  'PARTIALLY REJECTED': 'bg-rose-500',
  REJECTED: 'bg-rose-500',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = normalizeStatus(status);
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] shadow-sm', statusStyles[normalized] ?? 'border-slate-200 bg-slate-50 text-slate-600')}>
      <span className={clsx('h-1.5 w-1.5 rounded-full', dotStyles[normalized] ?? 'bg-slate-400')} />
      {normalized || 'NA'}
    </span>
  );
}
