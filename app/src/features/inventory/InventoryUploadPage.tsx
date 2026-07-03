import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { getTestInventory } from '../../services/testInventory.service';
import { uploadInventoryExcel } from '../../services/inventoryUploadWriter';

export function InventoryUploadPage() {
  const [search, setSearch] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const { data: rows = [], isLoading, refetch } = useQuery({ queryKey: ['test-inventory'], queryFn: getTestInventory });
  const branchCount = new Set(rows.map((row) => row.branch_code)).size;
  const totalQty = rows.reduce((sum, row) => sum + Number(row.qty ?? 0), 0);
  const totalValue = rows.reduce((sum, row) => sum + Number(row.inv_value ?? 0), 0);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => `${row.branch_code} ${row.item_code} ${row.item_name ?? ''} ${row.item_group ?? ''}`.toLowerCase().includes(term));
  }, [rows, search]);

  async function handleUpload() {
    setUploadMessage('');
    if (!file) { setUploadMessage('Please select an Excel file.'); return; }
    if (!reportDate) { setUploadMessage('Please select report date.'); return; }
    setIsUploading(true);
    try {
      const result = await uploadInventoryExcel(file, reportDate);
      setUploadMessage(`Upload complete. Total ${result.totalRows}, valid ${result.validRows}, failed ${result.failedRows}.`);
      setFile(null);
      await refetch();
    } catch (error) {
      setUploadMessage(error instanceof Error ? error.message : 'Inventory upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <PageCard eyebrow="Inventory" title="Inventory Lookup & Upload" description="Branch and item stock review workspace.">
      <div className="mb-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Inventory Upload</p>
        <div className="grid gap-2 lg:grid-cols-[150px_1fr_auto]">
          <input type="date" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={reportDate} onChange={(event) => setReportDate(event.target.value)} />
          <input type="file" accept=".xlsx,.xls" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          <button className="text-xs font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={isUploading} onClick={() => void handleUpload()}>{isUploading ? 'Uploading' : 'Upload'}</button>
        </div>
        <p className="mt-2 text-xs text-[#c7d2df]">Selected: {file?.name || 'No file selected'} • Report date: {reportDate || 'not selected'}</p>
        {uploadMessage ? <p className="mt-1 text-xs text-[#82C8E5]">{uploadMessage}</p> : null}
        <p className="mt-1 text-[11px] text-[#6D8196]">Expected columns: Branch/Br Code, Item Code, Item Name, Item Group, UOM, DNP, Closing Balance, Closing Inv Val.</p>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Rows</p><p className="text-sm font-black text-white">{rows.length}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Branches</p><p className="text-sm font-black text-white">{branchCount}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Total Qty</p><p className="text-sm font-black text-white">{totalQty}</p></div>
        <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1.5"><p className="text-[10px] uppercase text-[#6D8196]">Inv Value</p><p className="text-sm font-black text-white">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</p></div>
      </div>

      <input className="mb-2 w-full rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Search branch, item code, item name, or group" value={search} onChange={(event) => setSearch(event.target.value)} />
      {isLoading ? <p className="text-xs text-[#c7d2df]">Loading inventory...</p> : null}
      <div className="overflow-hidden rounded-lg border border-[#263244]">
        <table className="w-full min-w-[860px] border-collapse text-left text-xs">
          <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Item Code</th><th className="px-2.5 py-2">Item Name</th><th className="px-2.5 py-2">Group</th><th className="px-2.5 py-2">UOM</th><th className="px-2.5 py-2 text-right">Qty</th><th className="px-2.5 py-2 text-right">DNP</th><th className="px-2.5 py-2 text-right">Value</th></tr></thead>
          <tbody className="divide-y divide-[#263244] bg-[#111827]">
            {filteredRows.map((row) => (<tr key={row.id} className="hover:bg-[#182235]"><td className="px-2.5 py-2 font-black text-white">{row.branch_code}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{row.item_code}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{row.item_name ?? '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{row.item_group ?? '-'}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{row.uom ?? '-'}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{row.qty}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">{row.dnp ?? '-'}</td><td className="px-2.5 py-2 text-right text-[#d8e3ee]">₹{Number(row.inv_value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td></tr>))}
          </tbody>
        </table>
        {filteredRows.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No inventory found.</p> : null}
      </div>
    </PageCard>
  );
}
