import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { getTestInventory } from '../../services/testInventory.service';

export function InventoryUploadPage() {
  const [search, setSearch] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [fileName, setFileName] = useState('');
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['test-inventory'], queryFn: getTestInventory });
  const branchCount = new Set(rows.map((row) => row.branch_code)).size;
  const totalQty = rows.reduce((sum, row) => sum + Number(row.qty ?? 0), 0);
  const totalValue = rows.reduce((sum, row) => sum + Number(row.inv_value ?? 0), 0);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => `${row.branch_code} ${row.item_code} ${row.item_name ?? ''} ${row.item_group ?? ''}`.toLowerCase().includes(term));
  }, [rows, search]);

  return (
    <PageCard eyebrow="Inventory" title="Inventory Lookup & Upload" description="Branch and item stock review workspace.">
      <div className="mb-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Inventory Upload Preparation</p>
        <div className="grid gap-2 lg:grid-cols-[150px_1fr]">
          <input type="date" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={reportDate} onChange={(event) => setReportDate(event.target.value)} />
          <input type="file" accept=".xlsx,.xls" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')} />
        </div>
        <p className="mt-2 text-xs text-[#c7d2df]">Selected: {fileName || 'No file selected'} • Report date: {reportDate || 'not selected'}</p>
        <p className="mt-1 text-[11px] text-[#6D8196]">Expected columns: Branch/Br Code, Item Code, Item Name, Item Group, UOM, DNP, Closing Balance, Closing Inv Val. Migration 006 adds change logging and staging write policies.</p>
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
