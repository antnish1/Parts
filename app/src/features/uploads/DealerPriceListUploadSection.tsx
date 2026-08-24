import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import {
  parsePartPriceExcel,
  type ParsedPartPriceFile,
  type ParsedPartPriceRow,
  type PartPriceValidationIssue,
} from '../../services/partPriceExcelParser';
import {
  discardPartPriceUpload,
  getRecentPartPriceUploads,
  previewPartPriceUpload,
  publishPartPriceUpload,
  stagePartPriceFile,
  type PartPricePreview,
  type PartPricePreviewRow,
} from '../../services/partPriceUpload.service';

function monthInputToDate(value: string) {
  return value ? `${value}-01` : '';
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
  return `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function PreviewTable({ title, rows, mode }: { title: string; rows: PartPricePreviewRow[]; mode: 'changed' | 'simple' }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-[#d9dee7] bg-white">
      <p className="border-b border-[#edf1f6] bg-[#f8fafc] px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] text-[#475569]">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-[11px]">
          <thead className="bg-[#f3f6fb] text-left uppercase tracking-[0.06em] text-[#667085]">
            <tr><th className="px-2 py-2">Part No</th><th className="px-2 py-2">Description</th>{mode === 'changed' ? <><th className="px-2 py-2 text-right">Old DNP</th><th className="px-2 py-2 text-right">New DNP</th><th className="px-2 py-2 text-right">Old MRP</th><th className="px-2 py-2 text-right">New MRP</th></> : <th className="px-2 py-2 text-right">DNP</th>}</tr>
          </thead>
          <tbody>
            {rows.slice(0, 20).map((row, index) => (
              <tr key={`${row.partNo}-${index}`} className="border-t border-[#edf1f6] text-[#101827]">
                <td className="px-2 py-2 font-black">{row.partNo}</td><td className="px-2 py-2">{row.description || '-'}</td>
                {mode === 'changed' ? <><td className="px-2 py-2 text-right">{money(row.oldDnp)}</td><td className="px-2 py-2 text-right font-black">{money(row.newDnp)}</td><td className="px-2 py-2 text-right">{money(row.oldMrp)}</td><td className="px-2 py-2 text-right font-black">{money(row.newMrp)}</td></> : <td className="px-2 py-2 text-right">{money(row.newDnp)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 20 ? <p className="border-t border-[#edf1f6] px-3 py-2 text-[11px] text-[#667085]">Showing first 20 sample rows.</p> : null}
    </div>
  );
}

function DuplicateRowCard({ row, selected, onSelect }: { row: ParsedPartPriceRow; selected: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} className={`w-full rounded-lg border p-3 text-left transition ${selected ? 'border-[#1677ff] bg-[#eef6ff] ring-1 ring-[#1677ff]' : 'border-[#d9dee7] bg-white hover:border-[#94a3b8]'}`}>
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-[11px] font-black text-[#101827]">Source row {row.source_row}</p><p className="mt-1 text-xs text-[#475569]">{row.description || 'No description'}</p></div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${selected ? 'bg-[#1677ff] text-white' : 'bg-[#eef2f6] text-[#475569]'}`}>{selected ? 'Selected' : 'Use this row'}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] sm:grid-cols-4">
        <p><span className="text-[#667085]">DNP</span><br/><b>{money(row.dnp)}</b></p>
        <p><span className="text-[#667085]">RTL</span><br/><b>{money(row.rtl)}</b></p>
        <p><span className="text-[#667085]">MRP</span><br/><b>{money(row.mrp)}</b></p>
        <p><span className="text-[#667085]">GST</span><br/><b>{row.gst ?? '-'}</b></p>
        <p><span className="text-[#667085]">HSN</span><br/><b>{row.hsn || '-'}</b></p>
        <p><span className="text-[#667085]">Cat 1</span><br/><b>{row.cat1 || '-'}</b></p>
        <p><span className="text-[#667085]">Cat 2</span><br/><b>{row.cat2 || '-'}</b></p>
      </div>
    </button>
  );
}

export function DealerPriceListUploadSection() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const canManage = profile?.role === 'admin' || profile?.role === 'developer';
  const [month, setMonth] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState('');
  const [step, setStep] = useState<'idle' | 'reading' | 'duplicate-review' | 'staging' | 'preview' | 'publishing' | 'complete' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [preview, setPreview] = useState<PartPricePreview | null>(null);
  const [issues, setIssues] = useState<PartPriceValidationIssue[]>([]);
  const [parsedFile, setParsedFile] = useState<ParsedPartPriceFile | null>(null);
  const [duplicateSelections, setDuplicateSelections] = useState<Record<string, number>>({});
  const [confirmPublish, setConfirmPublish] = useState(false);

  const historyQuery = useQuery({ queryKey: ['part-master-upload-history'], queryFn: getRecentPartPriceUploads, enabled: canManage });
  const currentPublished = useMemo(() => historyQuery.data?.find((row) => row.status === 'published') ?? null, [historyQuery.data]);
  const inputLocked = step === 'reading' || step === 'duplicate-review' || step === 'staging' || step === 'publishing' || Boolean(preview);
  const duplicateResolutionComplete = Boolean(parsedFile?.duplicateGroups.length) && parsedFile!.duplicateGroups.every((group) => duplicateSelections[group.partNo] !== undefined);

  if (!canManage) return null;

  async function resetPreview(discard = true) {
    if (discard && preview?.uploadId) {
      try { await discardPartPriceUpload(preview.uploadId); } catch { /* stale staged sessions can be cleaned later */ }
    }
    setPreview(null);
    setParsedFile(null);
    setDuplicateSelections({});
    setIssues([]);
    setProgress(0);
    setMessage('');
    setStep('idle');
    setConfirmPublish(false);
  }

  async function stageAndPreview(parsed: ParsedPartPriceFile) {
    if (!file) return;
    setStep('staging');
    setMessage(`Validated ${parsed.validRows.length.toLocaleString('en-IN')} unique parts. Staging them safely for comparison...`);
    const uploadId = await stagePartPriceFile(parsed, file.name, monthInputToDate(month), (done, total) => {
      setProgress(total ? Math.round((done / total) * 100) : 0);
    });
    const nextPreview = await previewPartPriceUpload(uploadId);
    setPreview(nextPreview);
    setStep('preview');
    setProgress(100);
    setMessage(nextPreview.publishBlocked ? 'Preview ready, but publishing is blocked by a safety check. Review the warning below.' : 'Preview ready. No live Parts Master rows have been changed.');
  }

  async function handlePreview() {
    if (!file) { setMessage('Please select the Dealer Price List Excel file.'); return; }
    if (!month) { setMessage('Please select the price list month.'); return; }

    await resetPreview(true);
    setStep('reading');
    setMessage('Reading and validating the price list locally. The live Parts Master is not being changed.');
    try {
      const parsed = await parsePartPriceExcel(file);
      setIssues(parsed.issues.filter((issue) => !issue.message.startsWith('Duplicate normalized part number.')));
      if (!parsed.validRows.length && !parsed.duplicateGroups.length) throw new Error('No valid price-list rows were found.');
      if (parsed.invalidRows > 0) {
        setStep('failed');
        setMessage(`Validation stopped the upload: ${parsed.invalidRows} invalid row(s). Fix the file before staging.`);
        return;
      }
      if (parsed.duplicateGroups.length > 0) {
        setParsedFile(parsed);
        setDuplicateSelections({});
        setStep('duplicate-review');
        setMessage(`${parsed.duplicateGroups.length} duplicate part-number conflict(s) need a row selection before staging. Nothing has been written to the live Parts Master.`);
        return;
      }
      await stageAndPreview(parsed);
    } catch (error) {
      setStep('failed');
      setMessage(error instanceof Error ? error.message : 'Price list preview failed.');
    }
  }

  async function handleResolvedDuplicates() {
    if (!parsedFile || !duplicateResolutionComplete) return;
    try {
      const selectedRows = parsedFile.duplicateGroups.map((group) => {
        const sourceRow = duplicateSelections[group.partNo];
        const row = group.rows.find((item) => item.source_row === sourceRow);
        if (!row) throw new Error(`Select one source row for ${group.partNo}.`);
        return row;
      });
      const resolved: ParsedPartPriceFile = {
        ...parsedFile,
        validRows: [...parsedFile.validRows, ...selectedRows].sort((a, b) => a.source_row - b.source_row),
        duplicateRows: 0,
        duplicateGroups: [],
        issues: parsedFile.issues.filter((issue) => !issue.message.startsWith('Duplicate normalized part number.')),
      };
      setParsedFile(resolved);
      setIssues(resolved.issues);
      await stageAndPreview(resolved);
    } catch (error) {
      setStep('failed');
      setMessage(error instanceof Error ? error.message : 'Unable to resolve duplicate part numbers.');
    }
  }

  async function handlePublish() {
    if (!preview?.uploadId || preview.publishBlocked) return;
    setConfirmPublish(false);
    setStep('publishing');
    setMessage('Publishing the validated snapshot in one server transaction. Existing lookups remain readable during the update.');
    try {
      const result = await publishPartPriceUpload(preview.uploadId);
      setStep('complete');
      setMessage(`Price list published successfully. Active parts: ${Number(result.activeParts ?? preview.stagedParts).toLocaleString('en-IN')}.`);
      await queryClient.invalidateQueries({ queryKey: ['part-master-upload-history'] });
      await queryClient.invalidateQueries({ queryKey: ['part-location'] });
    } catch (error) {
      setStep('failed');
      setMessage(error instanceof Error ? error.message : 'Price list publication failed. The previous Parts Master remains active.');
    }
  }

  return (
    <section className="rounded-xl border border-[#263244] bg-[#0b1020] p-3 xl:col-span-2">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-xs font-black uppercase tracking-[0.12em] text-[#0f4c81]">Dealer Price List</p><p className="mt-1 text-[11px] text-[#6D8196]">Admin/Developer only. Validate → resolve conflicts → stage → compare → publish. The active Parts Master is untouched until Publish.</p></div>
        {currentPublished ? <span className="rounded-full border border-[#d9dee7] px-2.5 py-1 text-[11px] font-black text-[#475569]">Last published: {currentPublished.priceListMonth} • {currentPublished.validRows.toLocaleString('en-IN')} parts</span> : null}
      </div>

      <div className="grid gap-2 md:grid-cols-[160px_1fr_auto]">
        <input type="month" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-2 text-xs text-white outline-none focus:border-[#82C8E5]" value={month} onChange={(event) => setMonth(event.target.value)} disabled={inputLocked} />
        <input type="file" accept=".xlsx,.xls" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-2 text-xs text-white outline-none focus:border-[#82C8E5]" onChange={(event) => setFile(event.target.files?.[0] ?? null)} disabled={inputLocked} />
        <button className="rounded-md bg-[#1677ff] px-4 py-2 text-xs font-black text-white hover:bg-[#0f5ed7] disabled:opacity-40" disabled={!file || !month || inputLocked} onClick={() => void handlePreview()}>{step === 'reading' || step === 'staging' ? 'Preparing...' : 'Preview Price List'}</button>
      </div>

      <p className="mt-2 text-[11px] text-[#6D8196]">Expected columns: Material, Description, DNP, RTL, MRP, HSN, GST, Cat 1, Cat 2.</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef2f6]"><div className="h-full bg-[#1677ff] transition-all" style={{ width: `${progress}%` }} /></div>
      {message ? <p className={`mt-2 whitespace-pre-wrap text-xs font-semibold ${step === 'failed' ? 'text-[#b42318]' : 'text-[#d8e3ee]'}`}>{message}</p> : null}

      {issues.length ? <div className="mt-3 rounded-lg border border-[#f4b4ae] bg-[#fff7f6] p-3"><p className="text-xs font-black text-[#b42318]">Validation issues ({issues.length})</p><div className="mt-2 max-h-36 overflow-auto text-[11px] text-[#7a271a]">{issues.slice(0, 100).map((issue) => <p key={`${issue.row}-${issue.partNo}`}>Row {issue.row} • {issue.partNo || 'No part'} • {issue.message}</p>)}</div></div> : null}

      {step === 'duplicate-review' && parsedFile?.duplicateGroups.length ? <div className="mt-4 space-y-3 rounded-xl border border-[#f0c36a] bg-[#fff8e8] p-3">
        <div><p className="text-sm font-black text-[#7a4d00]">Resolve duplicate part numbers</p><p className="mt-1 text-[11px] text-[#7a4d00]">Whitespace differences are normalized, so these rows represent the same logical part number. Select exactly one source row for each part. No option is selected automatically.</p></div>
        {parsedFile.duplicateGroups.map((group) => <div key={group.partNo} className="rounded-lg border border-[#e7c979] bg-[#fffdf7] p-3"><div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-black text-[#101827]">{group.partNo}</p><span className="text-[10px] font-black text-[#7a4d00]">{group.rows.length} source rows</span></div><div className="grid gap-2 lg:grid-cols-2">{group.rows.map((row) => <DuplicateRowCard key={row.source_row} row={row} selected={duplicateSelections[group.partNo] === row.source_row} onSelect={() => setDuplicateSelections((current) => ({ ...current, [group.partNo]: row.source_row }))} />)}</div></div>)}
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><button className="rounded-md border border-[#94a3b8] px-4 py-2 text-xs font-black text-[#475569]" onClick={() => void resetPreview(false)}>Cancel</button><button className="rounded-md bg-[#1677ff] px-4 py-2 text-xs font-black text-white disabled:opacity-40" disabled={!duplicateResolutionComplete} onClick={() => void handleResolvedDuplicates()}>Continue to Preview</button></div>
      </div> : null}

      {preview ? <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">{[['Current', preview.currentParts], ['Staged', preview.stagedParts], ['New', preview.newParts], ['Changed', preview.changedParts], ['Unchanged', preview.unchangedParts], ['Removed', preview.removedParts]].map(([label, value]) => <div key={String(label)} className="rounded-lg border border-[#263244] bg-[#111827] px-3 py-2"><p className="text-[10px] uppercase tracking-[0.08em] text-[#6D8196]">{label}</p><p className="mt-1 text-base font-black text-white">{Number(value).toLocaleString('en-IN')}</p></div>)}</div>
        {preview.warnings.length ? <div className="rounded-lg border border-[#f0c36a] bg-[#fff8e8] p-3 text-xs font-semibold text-[#7a4d00]">{preview.warnings.map((warning) => <p key={warning}>{warning}</p>)}</div> : null}
        <PreviewTable title="Changed-price sample" rows={preview.changedSample} mode="changed" />
        <PreviewTable title="New-part sample" rows={preview.newSample} mode="simple" />
        <PreviewTable title="Parts missing from the new snapshot" rows={preview.removedSample} mode="simple" />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><button className="rounded-md border border-[#94a3b8] px-4 py-2 text-xs font-black text-[#c7d2df] disabled:opacity-40" disabled={step === 'publishing'} onClick={() => void resetPreview(true)}>Discard Preview</button><button className="rounded-md bg-[#16a34a] px-4 py-2 text-xs font-black text-white disabled:opacity-40" disabled={preview.publishBlocked || step === 'publishing' || step === 'complete'} onClick={() => setConfirmPublish(true)}>Publish Price List</button></div>
      </div> : null}

      {confirmPublish && preview ? <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"><div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl"><p className="text-base font-black text-[#101827]">Publish {month || 'selected'} Dealer Price List?</p><p className="mt-2 text-sm text-[#475569]">This will make the staged list the active Parts Master used by part lookup. The previous published snapshot is retained in history and the publication runs inside one server transaction.</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><p>Active after publish: <b>{preview.stagedParts.toLocaleString('en-IN')}</b></p><p>Changed: <b>{preview.changedParts.toLocaleString('en-IN')}</b></p><p>New: <b>{preview.newParts.toLocaleString('en-IN')}</b></p><p>Removed: <b>{preview.removedParts.toLocaleString('en-IN')}</b></p></div><div className="mt-5 flex justify-end gap-2"><button className="rounded-md border border-[#d9dee7] px-4 py-2 text-xs font-black text-[#475569]" onClick={() => setConfirmPublish(false)}>Cancel</button><button className="rounded-md bg-[#16a34a] px-4 py-2 text-xs font-black text-white" onClick={() => void handlePublish()}>Publish Price List</button></div></div></div> : null}

      {historyQuery.data?.length ? <div className="mt-4 border-t border-[#263244] pt-3"><p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#6D8196]">Recent price-list uploads</p><div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{historyQuery.data.map((row) => <div key={row.id} className="rounded-lg border border-[#263244] bg-[#111827] px-3 py-2 text-[11px] text-[#c7d2df]"><p className="font-black text-white">{row.priceListMonth} • {row.status}</p><p className="truncate">{row.filename}</p><p>{row.validRows.toLocaleString('en-IN')} rows • {row.publishedAt ? new Date(row.publishedAt).toLocaleString('en-IN') : 'Not published'}</p></div>)}</div></div> : null}
    </section>
  );
}
