import type { ReactNode } from 'react';

export type TadaStatusTone = {
  label: string;
  shortLabel: string;
  badgeClass: string;
  surfaceClass: string;
  rowClass: string;
  accentClass: string;
};

const fallbackStatus: TadaStatusTone = {
  label: 'In Progress',
  shortLabel: 'In Progress',
  badgeClass: 'border-slate-200 bg-slate-50 text-slate-700',
  surfaceClass: 'border-slate-200 bg-slate-50',
  rowClass: 'bg-white hover:bg-slate-50',
  accentClass: 'bg-slate-500',
};

export const tadaStatusMeta: Record<string, TadaStatusTone> = {
  AWAITING_HQ_RECEIPT: {
    label: 'Awaiting HQ Receipt',
    shortLabel: 'Awaiting HQ',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    surfaceClass: 'border-amber-200 bg-amber-50/80',
    rowClass: 'bg-amber-50/35 hover:bg-amber-50/70',
    accentClass: 'bg-amber-500',
  },
  PARTIALLY_RECEIVED_HQ: {
    label: 'Partial at HQ',
    shortLabel: 'Partial HQ',
    badgeClass: 'border-orange-200 bg-orange-50 text-orange-800',
    surfaceClass: 'border-orange-200 bg-orange-50/80',
    rowClass: 'bg-orange-50/35 hover:bg-orange-50/70',
    accentClass: 'bg-orange-500',
  },
  AWAITING_ACCOUNTS_RECEIPT: {
    label: 'Awaiting Accounts Receipt',
    shortLabel: 'Awaiting Accounts',
    badgeClass: 'border-blue-200 bg-blue-50 text-blue-800',
    surfaceClass: 'border-blue-200 bg-blue-50/80',
    rowClass: 'bg-blue-50/35 hover:bg-blue-50/70',
    accentClass: 'bg-blue-600',
  },
  PARTIALLY_RECEIVED_ACCOUNTS: {
    label: 'Partial at Accounts',
    shortLabel: 'Partial Accounts',
    badgeClass: 'border-violet-200 bg-violet-50 text-violet-800',
    surfaceClass: 'border-violet-200 bg-violet-50/80',
    rowClass: 'bg-violet-50/35 hover:bg-violet-50/70',
    accentClass: 'bg-violet-600',
  },
  COMPLETED: {
    label: 'Completed',
    shortLabel: 'Completed',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    surfaceClass: 'border-emerald-200 bg-emerald-50/80',
    rowClass: 'bg-emerald-50/30 hover:bg-emerald-50/60',
    accentClass: 'bg-emerald-600',
  },
};

export const tadaLocationMeta: Record<string, { label: string; badgeClass: string }> = {
  IN_TRANSIT_TO_HQ: { label: 'To HQ', badgeClass: 'border-amber-200 bg-amber-50 text-amber-800' },
  HQ: { label: 'At HQ', badgeClass: 'border-sky-200 bg-sky-50 text-sky-800' },
  IN_TRANSIT_TO_ACCOUNTS: { label: 'To Accounts', badgeClass: 'border-blue-200 bg-blue-50 text-blue-800' },
  ACCOUNTS: { label: 'Accounts', badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  MISSING_HQ: { label: 'Missing at HQ', badgeClass: 'border-red-200 bg-red-50 text-red-800' },
  MISSING_ACCOUNTS: { label: 'Missing at Accounts', badgeClass: 'border-red-200 bg-red-50 text-red-800' },
};

export function getTadaStatusMeta(status: string) {
  return tadaStatusMeta[status] ?? { ...fallbackStatus, label: status, shortLabel: status };
}

export function TadaStatusBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  const meta = getTadaStatusMeta(status);
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black leading-4 ${meta.badgeClass}`}>{compact ? meta.shortLabel : meta.label}</span>;
}

export function TadaMiniBadge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-black leading-4 ${className}`}>{children}</span>;
}
