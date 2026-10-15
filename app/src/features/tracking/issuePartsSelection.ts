import type { PendingIssuePartExportRow } from '../../services/pendingIssue.service';

/** Already-issued or insufficiently received part lines must never be bulk-selected. */
export function getEligibleIssueParts(parts: PendingIssuePartExportRow[]): PendingIssuePartExportRow[] {
  return parts.filter((part) =>
    part.item_status.trim().toUpperCase() === 'RECEIVED' &&
    part.effective_qty > 0 &&
    part.received_qty >= part.effective_qty &&
    !part.issued_at,
  );
}

/** A single checkbox toggles all currently eligible lines on or off. */
export function toggleSelectAllIssueParts(
  eligibleItemIds: string[],
  checked: boolean,
): string[] {
  return checked ? [...eligibleItemIds] : [];
}
