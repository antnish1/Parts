import { normalizeStatus } from './orderLogic';

export function getStatusRowClass(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === 'PENDING APPROVAL') return 'transition-colors bg-blue-50/70 hover:bg-blue-100/80';
  if (normalized === 'PENDING MANAGER APPROVAL') return 'transition-colors bg-indigo-50/70 hover:bg-indigo-100/80';
  if (normalized === 'APPROVED') return 'transition-colors bg-emerald-50/70 hover:bg-emerald-100/80';
  if (normalized === 'PROCESSED') return 'transition-colors bg-violet-50/70 hover:bg-violet-100/80';
  if (normalized === 'DISPATCHED' || normalized === 'PARTIALLY DISPATCHED') return 'transition-colors bg-purple-50/70 hover:bg-purple-100/80';
  if (normalized === 'ISSUED') return 'transition-colors bg-amber-50/70 hover:bg-amber-100/80';
  if (normalized === 'RECEIVED' || normalized === 'PARTIALLY RECEIVED') return 'transition-colors bg-cyan-50/70 hover:bg-cyan-100/80';
  if (normalized === 'REJECTED' || normalized === 'PARTIALLY REJECTED') return 'transition-colors bg-rose-50/70 hover:bg-rose-100/80';

  return 'transition-colors bg-white hover:bg-slate-50';
}

export function getStatusLeftBorderClass(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === 'PENDING APPROVAL') return 'border-l-2 border-l-[#1d4ed8]/55';
  if (normalized === 'PENDING MANAGER APPROVAL') return 'border-l-2 border-l-[#4338ca]/55';
  if (normalized === 'APPROVED') return 'border-l-2 border-l-[#047857]/55';
  if (normalized === 'PROCESSED') return 'border-l-2 border-l-[#3730a3]/55';
  if (normalized === 'DISPATCHED' || normalized === 'PARTIALLY DISPATCHED') return 'border-l-2 border-l-[#6d28d9]/55';
  if (normalized === 'ISSUED') return 'border-l-2 border-l-[#b45309]/55';
  if (normalized === 'RECEIVED' || normalized === 'PARTIALLY RECEIVED') return 'border-l-2 border-l-[#0f766e]/55';
  if (normalized === 'REJECTED' || normalized === 'PARTIALLY REJECTED') return 'border-l-2 border-l-[#be123c]/55';

  return 'border-l-2 border-l-transparent';
}

export function getStatusRowClasses(status: string) {
  return `${getStatusRowClass(status)} ${getStatusLeftBorderClass(status)}`;
}
