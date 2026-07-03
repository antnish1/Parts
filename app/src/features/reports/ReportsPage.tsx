import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { getTestOrders } from '../../services/testData.service';
import { downloadOrdersCsv, downloadOrdersExcel, summarizeByBranch, summarizeByStatus } from '../../services/testReport.service';
import { applyStatusReportRows, parseStatusReportFile, type StatusReportResult } from '../../services/statusReport.service';
import { readUploadMeta, saveUploadMeta, uploadProgress, type UploadMeta } from '../../lib/uploadMeta';

export function ReportsPage() {
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadResult, setUploadResult] = useState<StatusReportResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStep, setUploadStep] = useState('idle');
  const [uploadMeta, setUploadMeta] = useState<UploadMeta | null>(() => readUploadMeta('partsConnectStatusUploadMeta'));
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const branches = useMemo(() => [...new Set(orders.map((order) => order.branch))].sort(), [orders]);
  const statuses = useMemo(() => [...new Set(orders.map((order) => order.status))].sort(), [orders]);
  const filteredOrders = useMemo(() => orders.filter((order) => (branchFilter === 'all' || order.branch === branchFilter) && (statusFilter === 'all' || order.status === statusFilter)), [orders, branchFilter, statusFilter]);
  const branchRows = summarizeByBranch(filteredOrders);
  const statusRows = summarizeByStatus(filteredOrders);
  const progress = uploadProgress(uploadStep);

  async function uploadStatusReport(file: File | undefined) {
    if (!file) return;
    setIsUploading(true);
    setUploadStep('reading');
    setUploadMessage('Reading status report...');
    setUploadResult(null);
    try {
      const rows = await parseStatusReportFile(file);
      setUploadStep('server');
      setUploadMessage(`Applying ${rows.length} status row(s) on server...`);
      const result = await applyStatusReportRows(rows);
      setUploadStep('refreshing');
      setUploadResult(result);
      const meta: UploadMeta = { at: new Date().toISOString(), module: 'status-report', file: file.name, totalRows: result.total, updatedRows: result.updated, failedRows: result.failed, skippedRows: result.skipped };
      setUploadMeta(meta);
      saveUploadMeta('partsConnectStatusUploadMeta', meta);
      setUploadMessage('Refreshing orders...');
      await queryClient.invalidateQueries({ queryKey: ['test-orders'] });
      setUploadStep('complete');
      setUploadMessage(`Updated ${result.updated}, skipped ${result.skipped}, failed ${result.failed}.`);
    } catch (error) {
      setUploadStep('failed');
      setUploadMessage(error instanceof Error ? error.message : 'Status report upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <PageCard eyebrow="Reports" title="Reports" description="Filtered operational reports and DBMS status upload.">
      <div className="mb-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Status Report Upload</p>{uploadMeta ? <span className="rounded-full border border-[#263244] px-2.5 py-1 text-[11px] font-black text-[#c7d2df]">Last: {uploadMeta.updatedRows ?? 0} updated • {uploadMeta.failedRows} failed</span> : null}</div>
        <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
          <input type="file" accept=".xlsx,.xls" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" disabled={isUploading} onChange={(event) => void uploadStatusReport(event.target.files?.[0])} />
          <span className="text-xs text-[#c7d2df]">{isUploading ? `Step: ${uploadStep}` : uploadMessage || 'Expected: Final Order No, Part/Material, Billed Qty, Invoice No/Date, Docket, Transport'}</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#111827]"><div className="h-full bg-[#82C8E5] transition-all" style={{ width: `${progress}%` }} /></div>
        {uploadMessage ? <p className="mt-1 text-xs text-[#82C8E5]">{uploadMessage}</p> : null}
        {uploadMeta ? <p className="mt-1 text-[11px] text-[#6D8196]">Last file: {uploadMeta.file} • {new Date(uploadMeta.at).toLocaleString('en-IN')}</p> : null}
        {uploadResult ? <div className="mt-2 grid grid-cols-4 gap-2 text-xs"><p className="text-[#c7d2df]">Total: <b className="text-white">{uploadResult.total}</b></p><p className="text-[#c7d2df]">Updated: <b className="text-white">{uploadResult.updated}</b></p><p className="text-[#c7d2df]">Skipped: <b className="text-white">{uploadResult.skipped}</b></p><p className="text-[#c7d2df]">Failed: <b className="text-white">{uploadResult.failed}</b></p></div> : null}
        {uploadResult?.errors.length ? <div className="mt-2 max-h-24 overflow-auto rounded-md border border-[#263244] bg-[#111827] p-2 text-[11px] text-[#c7d2df]">{uploadResult.errors.slice(0, 10).map((item) => <p key={item}>{item}</p>)}</div> : null}
      </div>
      <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_1fr_auto_auto]">
        <select className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}><option value="all">All Branches</option>{branches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}</select>
        <select className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">All Status</option>{statuses.map((status) => <option key={status} value={status}>{status}</option>)}</select>
        <Button onClick={() => downloadOrdersCsv(filteredOrders)} disabled={filteredOrders.length === 0} className="rounded-md px-3 py-1.5 text-xs">CSV</Button>
        <Button onClick={() => downloadOrdersExcel(filteredOrders, 'filtered-orders')} disabled={filteredOrders.length === 0} className="rounded-md px-3 py-1.5 text-xs">Excel</Button>
      </div>
      {isLoading ? <p className="text-xs text-[#c7d2df]">Loading reports...</p> : null}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Filtered</p><p className="text-sm font-black text-white">{filteredOrders.length}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Branches</p><p className="text-sm font-black text-white">{branchRows.length}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Statuses</p><p className="text-sm font-black text-white">{statusRows.length}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Total Orders</p><p className="text-sm font-black text-white">{orders.length}</p></div>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3"><p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Branch Summary</p>{branchRows.map((row) => (<div key={row.label} className="flex justify-between border-t border-[#263244] py-1.5 text-xs"><span className="text-[#c7d2df]">{row.label}</span><span className="font-black text-white">{row.count}</span></div>))}{branchRows.length === 0 ? <p className="text-xs text-[#c7d2df]">No branch rows.</p> : null}</div>
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3"><p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Status Summary</p>{statusRows.map((row) => (<div key={row.label} className="flex justify-between border-t border-[#263244] py-1.5 text-xs"><span className="text-[#c7d2df]">{row.label}</span><span className="font-black text-white">{row.count}</span></div>))}{statusRows.length === 0 ? <p className="text-xs text-[#c7d2df]">No status rows.</p> : null}</div>
      </div>
    </PageCard>
  );
}
