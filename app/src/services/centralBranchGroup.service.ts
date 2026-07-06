import { normalizeBranchKey } from './branchScope.service';

const CENTRAL_KEYS = new Set(['JABALPURBHL', 'JABALPURHL', 'JABALPURPARTS', 'WARRANTY', 'JABALPUR']);

export function isCentralBranchValue(value: string | null | undefined) {
  const key = normalizeBranchKey(value);
  return CENTRAL_KEYS.has(key) || key === 'DFM003';
}

export function usesCentralBranchGroup(values: Array<string | null | undefined>) {
  return values.some(isCentralBranchValue);
}

export function withCentralOrderValues(values: string[]) {
  if (!usesCentralBranchGroup(values)) return values;
  return [...new Set([...values, 'JABALPUR_BHL', 'JABALPUR BHL', 'Jabalpur BHL', 'JABALPUR_HL', 'JABALPUR HL', 'Jabalpur HL', 'JABALPUR_PARTS', 'JABALPUR PARTS', 'Jabalpur Parts', 'WARRANTY', 'Warranty', 'JABALPUR'])];
}
