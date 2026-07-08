import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { uploadInventoryExcel } from '../../services/inventoryUploadWriter';
import { applyStatusReportRows, parseStatusReportFile, type StatusReportResult } from '../../services/statusReport.service';
import { readUploadMeta, saveUploadMeta, uploadProgress, type UploadMeta } from '../../lib/uploadMeta';

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
  const [statusMeta, setStatusMeta] = useState<UploadMeta | null>(() => readUploadMeta('partsConnectStatusUploadMeta'));

  const inventoryProgress = uploadProgress(inventoryStep);
  const statusProgress = uploadProgress(statusStep);

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

  async function handleStatusUpload(file: File | undefined) {
    if (!file) return;
    setIsStatusUploading(true);
    setStatusStep('reading');
    setStatusMessage('Reading order status file...');
    setStatusResult(null);
    try {
      const rows = await parseStatusReportFile(file);
      if (!rows.length) throw new Error('No valid status rows found. Expected columns include Order No, Material No, Billed Qty and Billing Dt.');
      setStatusStep('server');
      setStatusMessage(`Applying ${rows.length} status row(s) on server...`);
      const result = await applyStatusReportRows(rows);
      setStatusStep('refreshing');
      setStatusResult(result);
      const meta: UploadMeta = {
        at: new Date().toISOString(),
        module: 'status-report',
        file: file.name,
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
      setStatusMessage(`Order status upload complete. Billing chunks ${result.inserted}, item rows updated ${result.updated}, skipped ${result.skipped}, failed ${result.failed}.`);
    } catch (error) {
      setStatusStep('failed');
      setStatusMessage(error instanceof Error ? error.message : 'Order status upload failed.');
    } finally {
      setIsStatusUploading(false);
    }
  }

  return (
    <PageCard eyebrow="Uploads" title="Uploads" description="Central upload workspace for inventory and order status files.">
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
              <p className="mt-1 text-[11px] text-[#6D8196]">Upload DBMS/SAP order status report. XLS, XLSX, CSV, TSV and TXT are supported.</p>
            </div>
            {statusMeta ? <span className="rounded-full border border-[#d9dee7] px-2.5 py-1 text-[11px] font-black text-[#475569]">Last: {statusMeta.updatedRows ?? 0} updated • {statusMeta.failedRows} failed</span> : null}
          </div>
          <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
            <input type="file" accept=".xlsx,.xls,.csv,.tsv,.txt" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" disabled={isStatusUploading} onChange={(event) => void handleStatusUpload(event.target.files?.[0])} />
            <span className="text-xs text-[#667085]">{isStatusUploading ? `Step: ${statusStep}` : statusMessage || 'Expected: Order No, CustPO, Order Reg. Dt, Line No, Material No, Delivery No, BillNo & Image, Billed Qty, Billing Dt, Transport Name, Docket, GST Invoice No.'}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eef2f6]"><div className="h-full bg-[#1677ff] transition-all" style={{ width: `${statusProgress}%` }} /></div>
          {statusMessage ? <p className="mt-2 whitespace-pre-wrap text-xs font-semibold text-[#101827]">{statusMessage}</p> : null}
          {statusMeta ? <p className="mt-1 text-[11px] text-[#6D8196]">Last file: {statusMeta.file} • {new Date(statusMeta.at).toLocaleString('en-IN')}</p> : null}
          {statusResult ? <div className="mt-2 grid grid-cols-5 gap-2 text-xs"><p className="text-[#667085]">Total: <b className="text-[#101827]">{statusResult.total}</b></p><p className="text-[#667085]">Chunks: <b className="text-[#101827]">{statusResult.inserted}</b></p><p className="text-[#667085]">Updated: <b className="text-[#101827]">{statusResult.updated}</b></p><p className="text-[#667085]">Skipped: <b className="text-[#101827]">{statusResult.skipped}</b></p><p className="text-[#667085]">Failed: <b className="text-[#101827]">{statusResult.failed}</b></p></div> : null}
          {statusResult?.errors.length ? <div className="mt-2 max-h-24 overflow-auto rounded-md border border-[#d9dee7] bg-[#f8fafc] p-2 text-[11px] text-[#475569]">{statusResult.errors.slice(0, 20).map((item) => <p key={item}>{item}</p>)}</div> : null}
        </section>
      </div>
    </PageCard>
  );
}
