import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { uploadInventoryExcel } from '../../services/inventoryUploadWriter';
import { applyStatusReportRows, downloadStatusReportResultExcel, parseStatusReportFile, previewStatusReportRows, type StatusReportResult, type StatusReportRow } from '../../services/statusReport.service';
import { readUploadMeta, saveUploadMeta, uploadProgress, type UploadMeta } from '../../lib/uploadMeta';
import { DealerPriceListUploadSection } from './DealerPriceListUploadSection';

export function UploadsPage() {
  const queryClient = useQueryClient();
  const [inventoryReportDate, setInventoryReportDate] = useState('');
  const [inventoryFile, setInventoryFile] = useState<File | null>(null);
  const [inventoryMessage, setInventoryMessage] = useState('');
  const [inventoryStep, setInventoryStep] = useState('idle');
  const [isInventoryUploading, setIsInventoryUploading] = useState(false);
  const [inventoryMeta, setInventoryMeta] = useState<UploadMeta | null>(() => readUploadMeta('partsConnectInventoryUploadMeta'));

  const [statusMessage, setStatusMessage] = useState('');
  const [statusResult, setStatusResult] = useState<StatusReportResult | null>(null);
  const [statusStep, setStatusStep] = useState('idle');
  const [isStatusUploading, setIsStatusUploading] = useState(false);
  const [statusRows, setStatusRows] = useState<StatusReportRow[]>([]);
  const [statusParsedCount, setStatusParsedCount] = useState(0);
  const [statusFileName, setStatusFileName] = useState('');
  const [statusMeta, setStatusMeta] = useState<UploadMeta | null>(() => readUploadMeta('partsConnectStatusUploadMeta'));

  const inventoryProgress = uploadProgress(inventoryStep);
  const statusProgress = statusStep === 'preview' ? 100 : uploadProgress(statusStep);

  async function handleInventoryUpload() {
    setInventoryMessage('');
    if (!inventoryFile) { setInventoryMessage('Please select an inventory Excel file.'); return; }
    if (!inventoryReportDate) { setInventoryMessage('Please select inventory report date.'); return; }

    setIsInventoryUploading(true);
    setInventoryStep('reading');
    try {
      setInventoryMessage('Reading and validating inventory file...');
      await new Promise((resolve) => setTimeout(resolve, 80));
      setInventoryStep('server');
      setInventoryMessage('Sending validated inventory rows to server...');
      const result = await uploadInventoryExcel(inventoryFile, inventoryReportDate);
      setInventoryStep('refreshing');
      setInventoryMessage('Refreshing inventory data...');
      const meta: UploadMeta = {
        at: new Date().toISOString(),
        module: 'inventory',
        file: inventoryFile.name,
        reportDate: inventoryReportDate,
        totalRows: result.totalRows,
        validRows: result.validRows,
        failedRows: result.failedRows,
        updatedRows: result.changedRows ?? 0,
        batchId: result.batchId ?? '',
      };
      setInventoryMeta(meta);
      saveUploadMeta('partsConnectInventoryUploadMeta', meta);
      setInventoryFile(null);
      await queryClient.invalidateQueries({ queryKey: ['test-inventory'] });
      setInventoryStep('complete');
      setInventoryMessage(`Inventory upload complete. Total ${result.totalRows}, valid ${result.validRows}, failed ${result.failedRows}, staged ${result.stagedRows ?? 0}, changed ${result.changedRows ?? 0}${result.batchId ? `, batch ${result.batchId}` : ''}.`);
    } catch (error) {
      setInventoryStep('failed');
      setInventoryMessage(error instanceof Error ? error.message : 'Inventory upload failed.');
    } finally {
      setIsInventoryUploading(false);
    }
  }

  async function handleStatusPreview(file: File | undefined) {
    if (!file) return;
    setIsStatusUploading(true);
    setStatusStep('reading');
    setStatusMessage('Reading order status Excel file...');
    setStatusResult(null);
    setStatusRows([]);
    setStatusParsedCount(0);
    setStatusFileName(file.name);
    try {
      const rows = await parseStatusReportFile(file);
      setStatusParsedCount(rows.length);
      if (!rows.length) throw new Error('No valid status rows found. Expected columns include Order No, Material No, Billed Qty and Billing Dt.');
      setStatusRows(rows);
      setStatusStep('server');
      setStatusMessage(`Previewing ${rows.length} status row(s) using Order No + Part No matching...`);
      const preview = await previewStatusReportRows(rows);
      setStatusResult(preview);
      setStatusStep('preview');
      setStatusMessage(`Preview ready. Matched ${preview.updated}, skipped ${preview.skipped}, failed ${preview.failed}. No database rows were changed.`);
    } catch (error) {
      setStatusStep('failed');
      setStatusMessage(error instanceof Error ? error.message : 'Order status preview failed.');
    } finally {
      setIsStatusUploading(false);
    }
  }

  async function handleStatusApply() {
    if (!statusRows.length) { setStatusMessage('Please select and preview a status report first.'); return; }
    setIsStatusUploading(true);
    setStatusStep('server');
    setStatusMessage(`Applying ${statusRows.length} previewed status row(s) on server...`);
    try {
      const result = await applyStatusReportRows(statusRows);
      setStatusStep('refreshing');
      setStatusResult(result);
      let reportNote = '';
      try {
        downloadStatusReportResultExcel(result, statusRows, statusFileName || 'status-report.xlsx');
        reportNote = ' Excel report downloaded.';
      } catch (reportError) {
        reportNote = ` Excel report generation failed: ${reportError instanceof Error ? reportError.message : 'unknown error'}.`;
      }
      const meta: UploadMeta = {
        at: new Date().toISOString(),
        module: 'status-report',
        file: statusFileName || 'status-report.xlsx',
        totalRows: result.total,
        updatedRows: result.updated,
        failedRows: result.failed,
        skippedRows: result.skipped,
      };
      setStatusMeta(meta);
      saveUploadMeta('partsConnectStatusUploadMeta', meta);
      setStatusMessage('Refreshing orders...');
      await queryClient.invalidateQueries({ queryKey: ['order-list-paged'] });
      await queryClient.invalidateQueries({ queryKey: ['test-order-view'] });
      setStatusStep('complete');
      setStatusMessage(`Order status upload complete. Billing chunks ${result.inserted}, item rows updated ${result.updated}, skipped ${result.skipped}, failed ${result.failed}.${reportNote}`);
    } catch (error) {
      setStatusStep('failed');
      setStatusMessage(error instanceof Error ? error.message : 'Order status upload failed.');
    } finally {
      setIsStatusUploading(false);
    }
  }

  function handleDownloadStatusReport() {
    if (!statusResult) return;
    try {
      downloadStatusReportResultExcel(statusResult, statusRows, statusFileName || 'status-report.xlsx');
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Excel report generation failed.');
    }
  }

  function clearStatusPreview() {
    setStatusRows([]);
    setStatusParsedCount(0);
    setStatusResult(null);
    setStatusFileName('');
    setStatusStep('idle');
    setStatusMessage('');
  }

  const previewRows = statusResult?.previewRows ?? [];
  const canApplyStatus = statusRows.length > 0 && !!statusResult?.previewRows && (statusResult?.updated ?? 0) > 0 && !isStatusUploading;
  const canDownloadStatusReport = !!statusResult?.reportRows?.length && !isStatusUploading;

  return (
    <PageCard eyebrow="Uploads" title="Uploads" description="Central upload workspace for inventory, order status, and controlled master-data files.">
      <div className="grid gap-3 xl:grid-cols-2">
        <section className="rounded-xl border border-[#263244] bg-[#0b1020] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#0f4c81]">Inventory Upload</p>
              <p className="mt-1 text-[11px] text-[#6D8196]">Upload inventory Excel with report date.</p>
            </div>
            {inventoryMeta ? <span className="rounded-full border border-[#d9dee7] px-2.5 py-1 text-[11px] font-black text-[#475569]">Last: {inventoryMeta.reportDate} • {inventoryMeta.validRows ?? 0} valid</span> : null}
          </div>
          <div className="grid gap-2 lg:grid-cols-[150px_1fr_auto]">
            <input type="date" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={inventoryReportDate} onChange={(event) => setInventoryReportDate(event.target.value)} disabled={isInventoryUploading} />
            <input type="file" accept=".xlsx,.xls" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" onChange={(event) => setInventoryFile(event.target.files?.[0] ?? null)} disabled={isInventoryUploading} />
            <button className="rounded-md bg-[#1677ff] px-3 py-1.5 text-xs font-black text-white hover:bg-[#0f5ed7] disabled:opacity-40" disabled={isInventoryUploading} onClick={() => void handleInventoryUpload()}>{isInventoryUploading ? 'Uploading' : 'Upload'}</button>
          </div>
          <p className="mt-2 text-xs text-[#667085]">Selected: {inventoryFile?.name || 'No file selected'} • Report date: {inventoryReportDate || 'not selected'} • Step: {inventoryStep}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef2f6]"><div className="h-full bg-[#1677ff] transition-all" style={{ width: `${inventoryProgress}%` }} /></div>
          {inventoryMessage ? <p className="mt-2 whitespace-pre-wrap text-xs font-semibold text-[#101827]">{inventoryMessage}</p> : null}
          {inventoryMeta ? <p className="mt-1 text-[11px] text-[#6D8196]">Last file: {inventoryMeta.file} • Changed: {inventoryMeta.updatedRows ?? 0} • Batch: {inventoryMeta.batchId || '-'}</p> : null}
          <p className="mt-2 text-[11px] text-[#6D8196]">Expected columns: Branch/Br Code, Item Code, Item Name, Item Group, UOM, DNP, Closing Balance, Closing Inv Val.</p>
        </section>

        <section className="rounded-xl border border-[#263244] bg-[#0b1020] p-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em] text-[#0f4c81]">Order Status Upload</p>
              <p className="mt-1 text-[11px] text-[#6D8196]">Step 1 previews Order No + Part No matches. Step 2 applies only after review.</p>
            </div>
            {statusMeta ? <span className="rounded-full border border-[#d9dee7] px-2.5 py-1 text-[11px] font-black text-[#475569]">Last: {statusMeta.updatedRows ?? 0} updated • {statusMeta.failedRows} failed</span> : null}
          </div>
          <div className="grid gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
            <input type="file" accept=".xlsx,.xls" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" disabled={isStatusUploading} onChange={(event) => void handleStatusPreview(event.target.files?.[0])} />
            <button className="rounded-md border border-[#1677ff] px-3 py-1.5 text-xs font-black text-[#1677ff] disabled:opacity-40" disabled={!canApplyStatus} onClick={() => void handleStatusApply()}>Apply Previewed Rows</button>
            <button className="rounded-md border border-[#16a34a] px-3 py-1.5 text-xs font-black text-[#16a34a] disabled:opacity-40" disabled={!canDownloadStatusReport} onClick={handleDownloadStatusReport}>Download Report</button>
            <button className="rounded-md border border-[#d9dee7] px-3 py-1.5 text-xs font-black text-[#475569] disabled:opacity-40" disabled={isStatusUploading || (!statusRows.length && !statusResult && !statusFileName)} onClick={clearStatusPreview}>Clear</button>
          </div>
          <p className="mt-2 text-xs text-[#667085]">{isStatusUploading ? `Step: ${statusStep}` : statusMessage || 'Expected: Order No, Material No, Billed Qty, Billing Dt, Bill No, Docket, Transport, Delivery No'}</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef2f6]"><div className="h-full bg-[#1677ff] transition-all" style={{ width: `${statusProgress}%` }} /></div>
          {statusFileName ? <p className="mt-2 text-[11px] text-[#6D8196]">Selected: {statusFileName} • Parsed rows: {statusParsedCount} • Ready rows: {statusRows.length}</p> : null}
          {statusMessage ? <p className="mt-2 whitespace-pre-wrap text-xs font-semibold text-[#101827]">{statusMessage}</p> : null}
          {statusMeta ? <p className="mt-1 text-[11px] text-[#6D8196]">Last file: {statusMeta.file} • {new Date(statusMeta.at).toLocaleString('en-IN')}</p> : null}
          {statusResult ? <div className="mt-2 grid grid-cols-5 gap-2 text-xs"><p className="text-[#667085]">Total: <b className="text-[#101827]">{statusResult.total}</b></p><p className="text-[#667085]">Chunks: <b className="text-[#101827]">{statusResult.inserted}</b></p><p className="text-[#667085]">Matched: <b className="text-[#101827]">{statusResult.updated}</b></p><p className="text-[#667085]">Skipped: <b className="text-[#101827]">{statusResult.skipped}</b></p><p className="text-[#667085]">Failed: <b className="text-[#101827]">{statusResult.failed}</b></p></div> : null}
          {previewRows.length ? <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-[#d9dee7] bg-[#ffffff] text-[11px]"><table className="w-full min-w-[760px] border-collapse"><thead className="bg-[#f3f6fb] text-left uppercase tracking-[0.08em] text-[#667085]"><tr><th className="px-2 py-2">Result</th><th className="px-2 py-2">Order No</th><th className="px-2 py-2">Part No</th><th className="px-2 py-2">Billed</th><th className="px-2 py-2">Current</th><th className="px-2 py-2">Reason</th></tr></thead><tbody>{previewRows.slice(0, 50).map((row, index) => <tr key={`${row.orderNo}-${row.partNo}-${index}`} className="border-t border-[#edf1f6]"><td className="px-2 py-2 font-black text-[#101827]">{row.status}</td><td className="px-2 py-2">{row.orderNo}</td><td className="px-2 py-2 font-black">{row.partNo}</td><td className="px-2 py-2">{row.billedQty ?? '-'}</td><td className="px-2 py-2">{row.currentRowStatus ?? '-'} {row.currentBilledQty !== undefined ? `• billed ${row.currentBilledQty}` : ''}</td><td className="px-2 py-2">{row.warning || row.reason}</td></tr>)}</tbody></table>{previewRows.length > 50 ? <p className="border-t border-[#edf1f6] p-2 text-[#667085]">Showing first 50 preview rows out of {previewRows.length}.</p> : null}</div> : null}
          {statusResult?.errors.length ? <div className="mt-2 max-h-24 overflow-auto rounded-md border border-[#d9dee7] bg-[#f8fafc] p-2 text-[11px] text-[#475569]">{statusResult.errors.slice(0, 10).map((item) => <p key={item}>{item}</p>)}</div> : null}
        </section>

        <DealerPriceListUploadSection />
      </div>
    </PageCard>
  );
}
