import { clsx } from 'clsx';

type StatusBadgeProps = {
  status: string;
};

const statusStyles: Record<string, string> = {
  'PENDING APPROVAL': 'border-blue-400/40 bg-blue-500/15 text-blue-100',
  APPROVED: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100',
  PROCESSED: 'border-amber-400/40 bg-amber-500/15 text-amber-100',
  REJECTED: 'border-red-400/40 bg-red-500/15 text-red-100',
  RECEIVED: 'border-green-400/40 bg-green-500/15 text-green-100'
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const normalized = status.trim().toUpperCase();
  return (
    <span className={clsx('inline-flex rounded-full border px-2.5 py-1 text-xs font-extrabold tracking-wide', statusStyles[normalized] ?? 'border-slate-500/40 bg-slate-500/15 text-slate-100')}>
      {normalized || 'NA'}
    </span>
  );
}
