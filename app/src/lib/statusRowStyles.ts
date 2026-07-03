import { normalizeStatus } from './orderLogic';

const base = 'transition-colors';

export function getStatusRowClass(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === 'PENDING APPROVAL' || normalized === 'PENDING MANAGER APPROVAL') {
    return `${base} bg-amber-500/5 hover:bg-amber-500/10`;
  }

  if (normalized === 'APPROVED') {
    return `${base} bg-sky-500/5 hover:bg-sky-500/10`;
  }

  if (normalized === 'PROCESSED') {
    return `${base} bg-indigo-500/5 hover:bg-indigo-500/10`;
  }

  if (normalized === 'ISSUED') {
    return `${base} bg-cyan-500/5 hover:bg-cyan-500/10`;
  }

  if (normalized === 'RECEIVED' || normalized === 'PARTIALLY RECEIVED') {
    return `${base} bg-emerald-500/5 hover:bg-emerald-500/10`;
  }

  if (normalized === 'REJECTED') {
    return `${base} bg-rose-500/5 hover:bg-rose-500/10`;
  }

  return `${base} hover:bg-[#182235]`;
}

export function getStatusLeftBorderClass(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === 'PENDING APPROVAL' || normalized === 'PENDING MANAGER APPROVAL') return 'border-l-2 border-l-amber-400/60';
  if (normalized === 'APPROVED') return 'border-l-2 border-l-sky-400/60';
  if (normalized === 'PROCESSED') return 'border-l-2 border-l-indigo-400/60';
  if (normalized === 'ISSUED') return 'border-l-2 border-l-cyan-400/60';
  if (normalized === 'RECEIVED' || normalized === 'PARTIALLY RECEIVED') return 'border-l-2 border-l-emerald-400/60';
  if (normalized === 'REJECTED') return 'border-l-2 border-l-rose-400/60';

  return 'border-l-2 border-l-transparent';
}

export function getStatusRowClasses(status: string) {
  return `${getStatusRowClass(status)} ${getStatusLeftBorderClass(status)}`;
}
