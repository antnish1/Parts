import { normalizeStatus } from './orderLogic';

const base = 'transition-colors hover:bg-[#182235]';

export function getStatusRowClass() {
  return base;
}

export function getStatusLeftBorderClass(status: string) {
  const normalized = normalizeStatus(status);

  if (normalized === 'PENDING APPROVAL' || normalized === 'PENDING MANAGER APPROVAL') return 'border-l-2 border-l-[#6D8196]/60';
  if (normalized === 'APPROVED') return 'border-l-2 border-l-[#82C8E5]/60';
  if (normalized === 'PROCESSED') return 'border-l-2 border-l-[#6D8196]/60';
  if (normalized === 'ISSUED') return 'border-l-2 border-l-[#82C8E5]/60';
  if (normalized === 'RECEIVED' || normalized === 'PARTIALLY RECEIVED') return 'border-l-2 border-l-[#82C8E5]/60';
  if (normalized === 'REJECTED') return 'border-l-2 border-l-[#ef6f7b]/60';

  return 'border-l-2 border-l-transparent';
}

export function getStatusRowClasses(status: string) {
  return `${getStatusRowClass()} ${getStatusLeftBorderClass(status)}`;
}
