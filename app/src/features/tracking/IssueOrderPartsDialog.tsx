import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { getPendingIssueOrderParts } from '../../services/pendingIssue.service';
import {
  issuedDocumentTypes,
  markOrderItemsIssued,
  type IssuedDocumentType,
} from '../../services/orderIssue.service';
import { getEligibleIssueParts, toggleSelectAllIssueParts } from './issuePartsSelection';

type IssueOrderPartsDialogProps = {
  orderId: string;
  orderLabel: string;
  onClose: () => void;
  onIssued: (message: string) => void | Promise<void>;
};

export function IssueOrderPartsDialog({
  orderId, orderLabel, onClose, onIssued,
}: IssueOrderPartsDialogProps) {
  const queryClient = useQueryClient();
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [documentType, setDocumentType] = useState<IssuedDocumentType>('DC');
  const [documentNo, setDocumentNo] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const partsQuery = useQuery({
    queryKey: ['issue-order-parts', orderId],
    queryFn: () => getPendingIssueOrderParts([orderId]),
    enabled: Boolean(orderId),
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const parts = partsQuery.data ?? [];
  const eligibleParts = useMemo(() => getEligibleIssueParts(parts), [parts]);
  const eligibleIds = useMemo(() => eligibleParts.map((part) => part.item_id), [eligibleParts]);
  const previouslyIssued = parts.filter((part) => part.item_status.toUpperCase() === 'ISSUED').length;
  const otherNotReady = parts.length - previouslyIssued - eligibleParts.length;
  const validSelectedIds = selectedItemIds.filter((id) => eligibleIds.includes(id));
  const allSelected = eligibleIds.length > 0 && validSelectedIds.length === eligibleIds.length;
  const selectedQty = eligibleParts.reduce(
    (total, part) => total + (validSelectedIds.includes(part.item_id) ? part.effective_qty : 0), 0,
  );

  const issueMutation = useMutation({
    mutationFn: () => markOrderItemsIssued(orderId, validSelectedIds, documentType, documentNo),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['pending-issue-orders'] }),
        queryClient.invalidateQueries({ queryKey: ['pending-issue-nav-count'] }),
        queryClient.invalidateQueries({ queryKey: ['order-list-paged'] }),
        queryClient.invalidateQueries({ queryKey: ['tracking-meta'] }),
        queryClient.invalidateQueries({ queryKey: ['test-order-view'] }),
        queryClient.invalidateQueries({ queryKey: ['issue-order-parts', orderId] }),
      ]);
      const status = (result as { status?: string } | null)?.status === 'issued'
        ? 'Issued' : 'Partially Issued';
      await onIssued(`${orderLabel}: ${validSelectedIds.length} part line(s), ${selectedQty} unit(s) issued. Order status: ${status}.`);
      onClose();
    },
    onError: (error) => setErrorMessage(
      error instanceof Error ? error.message : 'Could not issue selected parts. Please retry.',
    ),
  });

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[#0b1f3a]/70 p-3 sm:p-4"
      role="dialog" aria-modal="true" aria-labelledby="issue-parts-dialog-title">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#cbd5e1] bg-white shadow-2xl">
        <div className="pc-issue-parts-header flex items-start justify-between gap-3 bg-[#0b1f3a] px-4 py-3">
          <div className="min-w-0">
            <p className="pc-issue-parts-header-order text-[10px] font-semibold uppercase tracking-[0.14em] !text-[#ffe47a]">{orderLabel}</p>
            <h2 id="issue-parts-dialog-title" className="pc-issue-parts-header-title mt-1 text-base font-bold !text-white">Issue selected parts</h2>
            <p className="pc-issue-parts-header-subtitle mt-1 text-xs !text-[#dce8f5]">Only checked, fully received parts will be marked Issued.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} disabled={issueMutation.isPending}
            className="pc-issue-parts-header-close rounded-md p-1 text-white hover:bg-white/10 disabled:opacity-40"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 space-y-3 overflow-y-auto p-4">
          {partsQuery.isLoading ? <p className="text-xs text-[#64748b]">Loading order parts…</p> : null}
          {partsQuery.error ? <p role="alert" className="text-xs font-semibold text-red-700">
            Unable to load order parts. Close and retry.
          </p> : null}
          {!partsQuery.isLoading && !partsQuery.error && previouslyIssued > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-[#166534]"><CheckCircle2 className="h-4 w-4" />
              {previouslyIssued} part line(s) already issued and excluded from selection.
            </p>
          ) : null}
          {!partsQuery.isLoading && otherNotReady > 0 ? (
            <p className="flex items-center gap-1.5 text-xs text-amber-700"><AlertCircle className="h-4 w-4" />
              {otherNotReady} part line(s) not yet fully received or not eligible for issue.
            </p>
          ) : null}

          {!partsQuery.isLoading && !partsQuery.error && (
            <div className="space-y-2">
              <label className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-[#b6d2c4] bg-[#f0fdf4] px-3 py-2.5">
                <span className="flex items-center gap-2 text-xs font-bold text-[#166534]">
                  <input type="checkbox" aria-label="Select or deselect all eligible parts"
                    className="h-4 w-4 accent-[#166534]" checked={allSelected}
                    disabled={eligibleIds.length === 0 || issueMutation.isPending}
                    onChange={(event) => setSelectedItemIds(
                      toggleSelectAllIssueParts(eligibleIds, event.target.checked),
                    )} />
                  Select All / Deselect All
                </span>
                <span className="shrink-0 text-[11px] font-semibold text-[#166534]">
                  {validSelectedIds.length} / {eligibleIds.length}
                </span>
              </label>
              {eligibleParts.map((part) => (
                <label key={part.item_id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#d8e0ea] bg-white p-2.5 hover:bg-[#f8fbff]">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#166534]"
                    checked={validSelectedIds.includes(part.item_id)}
                    disabled={issueMutation.isPending}
                    onChange={(event) => setSelectedItemIds((current) => event.target.checked
                      ? [...current, part.item_id]
                      : current.filter((id) => id !== part.item_id))} />
                  <span className="min-w-0 flex-1 text-xs text-[#0f172a]">
                    <strong>{part.part_no}</strong> · {part.description ?? 'Part'}
                    <span className="mt-0.5 block text-[11px] text-[#64748b]">
                      Qty {part.effective_qty} · Received {part.received_qty} · {part.item_status}
                    </span>
                  </span>
                </label>
              ))}
              {eligibleParts.length === 0 && (
                <p className="rounded-lg bg-[#f8fafc] p-3 text-center text-xs text-[#64748b]">
                  No fully received, unissued parts are available.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[#334155]">Document Type
              <select className="mt-1 h-10 w-full rounded-md border border-[#cbd5e1] bg-white px-2 text-sm"
                value={documentType} disabled={issueMutation.isPending}
                onChange={(event) => setDocumentType(event.target.value as IssuedDocumentType)}>
                {issuedDocumentTypes.map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#334155]">Document Number
              <input className="mt-1 h-10 w-full rounded-md border border-[#cbd5e1] px-2 text-sm uppercase"
                placeholder="DC / INVOICE REFERENCE" value={documentNo} maxLength={180}
                disabled={issueMutation.isPending}
                onChange={(event) => setDocumentNo(event.target.value.toUpperCase())} />
            </label>
          </div>
          {errorMessage && <p role="alert" className="rounded-md bg-red-50 p-2 text-xs text-red-700">{errorMessage}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-[#d8e0ea] bg-[#f8fafc] px-3 py-3">
          <span className="text-[11px] font-semibold text-[#475569]">
            {validSelectedIds.length} part line(s) · {selectedQty} unit(s) selected
          </span>
          <div className="flex shrink-0 gap-2">
            <button type="button" className="rounded-md border border-[#cbd5e1] px-3 py-2 text-xs font-semibold"
              disabled={issueMutation.isPending} onClick={onClose}>Cancel</button>
            <button type="button" className="rounded-md bg-[#166534] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
              disabled={validSelectedIds.length === 0 || !documentNo.trim() || !!partsQuery.error || partsQuery.isLoading || issueMutation.isPending}
              onClick={() => { setErrorMessage(''); issueMutation.mutate(); }}>
              {issueMutation.isPending ? 'Issuing…' : `Issue ${validSelectedIds.length} part(s)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
