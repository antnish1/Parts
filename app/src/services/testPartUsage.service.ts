import { getInTransitQtyByBranchPart } from './inTransit.service';

/**
 * Legacy compatibility wrapper.
 * The old helper name referred to a 30-day usage window; the portal now uses
 * the live branch-wide In Transit quantity instead.
 */
export async function getTestLast30QtyByBranchPart(branch: string, partNo: string, _days = 30) {
  return getInTransitQtyByBranchPart(branch, partNo);
}
