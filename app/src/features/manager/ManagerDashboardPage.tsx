import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { getLatestInventoryReportDate, getManagerInventoryLookup, getManagerInventoryTransactions } from '../../services/managerInventory.service';

function formatMoney(value: number) {
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

function escapeCsv(value: string | number | null | undefined) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, header: string[], rows: Array<Array<string | number | null | undefined>>) {
  const csv = [header.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.click();

  URL.revokeObjectURL(url);
}

export function ManagerDashboardPage() {
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryBranch, setInventoryBranch] = useState('all');
  const [inventoryDate, setInventoryDate] = useState('');

  const latestDateQuery = useQuery({
    queryKey: ['manager-inventory-latest-date'],
    queryFn: getLatestInventoryReportDate,
  });

  const effectiveInventoryDate = inventoryDate || latestDateQuery.data || '';
  const hasInventorySearch = inventorySearch.trim().length > 0;

  const inventoryQuery = useQuery({
    queryKey: ['manager-inventory', inventorySearch, inventoryBranch, effectiveInventoryDate],
    queryFn: () => getManagerInventoryLookup(inventorySearch, inventoryBranch, effectiveInventoryDate),
    enabled: hasInventorySearch,
  });

  const txnQuery = useQuery({
    queryKey: ['manager-inventory-txn', inventorySearch, inventoryBranch, effectiveInventoryDate],
    queryFn: () => getManagerInventoryTransactions(inventorySearch, inventoryBranch, effectiveInventoryDate),
    enabled: hasInventorySearch,
  });

  const inventoryRows = hasInventorySearch ? inventoryQuery.data ?? [] : [];
  const txnRows = hasInventorySearch ? txnQuery.data ?? [] : [];
  const inventoryBranches = useMemo(() => {
    const map = new Map<string, string>();
    inventoryRows.forEach((row) => {
      const key = row.branch_key || row.branch_code;
      if (!key) return;
      map.set(key, row.branch_name ? `${row.branch_name} (${row.branch_code})` : key);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [inventoryRows]);

  function exportInventory() {
    downloadCsv(
      `manager-inventory-${effectiveInventoryDate || 'latest'}.csv`,
      ['Report Date', 'Branch Key', 'Branch Code', 'Branch Name', 'Part No', 'Item Name', 'Group', 'UOM', 'Qty', 'DNP', 'Value'],
      inventoryRows.map((row) => [row.report_date, row.branch_key, row.branch_code, row.branch_name, row.item_code, row.item_name, row.item_group, row.uom, row.qty, row.dnp, row.inv_value]),
    );
  }

  function exportTransactions() {
    downloadCsv(
      `manager-inventory-transactions-${effectiveInventoryDate || 'latest'}.csv`,
      ['Report Date', 'Branch Key', 'Branch Code', 'Branch Name', 'Part No', 'Item Name', 'Group', 'Received', 'Issued', 'Closing Balance', 'Value'],
      txnRows.map((row) => [row.report_date, row.branch_key, row.branch_code, row.branch_name, row.item_code, row.item_name, row.item_group, row.received, row.issued, row.closing_balance, row.closing_value]),
    );
  }

  return (
    <PageCard eyebrow="Manager" title="Inventory" description="Search inventory position by part number.">
      <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Inventory Position • {effectiveInventoryDate || 'Latest date not found'}</p>
          <div className="flex gap-3">
            <button className="text-xs font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={!inventoryRows.length} onClick={exportInventory}>Export Inventory</button>
            <button className="text-xs font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={!txnRows.length} onClick={exportTransactions}>Export Transactions</button>
          </div>
        </div>

        <div className="mb-2 grid gap-2 lg:grid-cols-[1fr_150px_180px]">
          <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Enter part no to view inventory position" value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} />
          <input type="date" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={inventoryDate} onChange={(event) => setInventoryDate(event.target.value)} />
          <select className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={inventoryBranch} onChange={(event) => setInventoryBranch(event.target.value)}>
            <option value="all">All Branches</option>
            {inventoryBranches.map(([branchKey, label]) => <option key={branchKey} value={branchKey}>{label}</option>)}
          </select>
        </div>

        {hasInventorySearch && inventoryQuery.isLoading ? <p className="text-xs text-[#c7d2df]">Searching inventory...</p> : null}

        {hasInventorySearch ? (
          <div className="overflow-hidden rounded-md border border-[#263244]">
            <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
              <thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]">
                <tr>
                  <th className="px-2.5 py-2">Branch Key</th>
                  <th className="px-2.5 py-2">Branch Code</th>
                  <th className="px-2.5 py-2">Branch Name</th>
                  <th className="px-2.5 py-2">Part No</th>
                  <th className="px-2.5 py-2">Item Name</th>
                  <th className="px-2.5 py-2">Group</th>
                  <th className="px-2.5 py-2">UOM</th>
                  <th className="px-2.5 py-2 text-right">Qty</th>
                  <th className="px-2.5 py-2 text-right">DNP</th>
                  <th className="px-2.5 py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263244]">
                {inventoryRows.map((row) => (
                  <tr key={row.id} className="bg-[#111827]">
                    <td className="px-2.5 py-2 font-black text-white">{row.branch_key ?? '-'}</td>
                    <td className="px-2.5 py-2 text-[#d8e3ee]">{row.branch_code}</td>
                    <td className="px-2.5 py-2 text-[#d8e3ee]">{row.branch_name ?? '-'}</td>
                    <td className="px-2.5 py-2 text-[#d8e3ee]">{row.item_code}</td>
                    <td className="px-2.5 py-2 text-[#d8e3ee]">{row.item_name ?? '-'}</td>
                    <td className="px-2.5 py-2 text-[#d8e3ee]">{row.item_group ?? '-'}</td>
                    <td className="px-2.5 py-2 text-[#d8e3ee]">{row.uom ?? '-'}</td>
                    <td className="px-2.5 py-2 text-right font-black text-white">{Number(row.qty ?? 0)}</td>
                    <td className="px-2.5 py-2 text-right text-[#d8e3ee]">{Number(row.dnp ?? 0)}</td>
                    <td className="px-2.5 py-2 text-right text-[#d8e3ee]">{formatMoney(Number(row.inv_value ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {inventoryRows.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No inventory rows found for this part number.</p> : null}
          </div>
        ) : null}
      </div>

      {hasInventorySearch ? (
        <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Part Transactions • Received / Issued Movement</p>
          {txnQuery.isLoading ? <p className="text-xs text-[#c7d2df]">Loading transactions...</p> : null}
          <div className="overflow-hidden rounded-md border border-[#263244]">
            <table className="w-full min-w-[1060px] border-collapse text-left text-xs">
              <thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]">
                <tr>
                  <th className="px-2.5 py-2">Branch Key</th>
                  <th className="px-2.5 py-2">Branch Code</th>
                  <th className="px-2.5 py-2">Part No</th>
                  <th className="px-2.5 py-2">Item Name</th>
                  <th className="px-2.5 py-2 text-right">Received</th>
                  <th className="px-2.5 py-2 text-right">Issued</th>
                  <th className="px-2.5 py-2 text-right">Closing</th>
                  <th className="px-2.5 py-2 text-right">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263244]">
                {txnRows.map((row) => (
                  <tr key={row.id} className="bg-[#111827]">
                    <td className="px-2.5 py-2 font-black text-white">{row.branch_key ?? '-'}</td>
                    <td className="px-2.5 py-2 text-[#d8e3ee]">{row.branch_code}</td>
                    <td className="px-2.5 py-2 text-[#d8e3ee]">{row.item_code}</td>
                    <td className="px-2.5 py-2 text-[#d8e3ee]">{row.item_name ?? '-'}</td>
                    <td className="px-2.5 py-2 text-right text-[#d8e3ee]">{Number(row.received ?? 0)}</td>
                    <td className="px-2.5 py-2 text-right text-[#d8e3ee]">{Number(row.issued ?? 0)}</td>
                    <td className="px-2.5 py-2 text-right font-black text-white">{Number(row.closing_balance ?? 0)}</td>
                    <td className="px-2.5 py-2 text-right text-[#d8e3ee]">{formatMoney(Number(row.closing_value ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {txnRows.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No movement rows found for this part/date/branch.</p> : null}
          </div>
        </div>
      ) : null}
    </PageCard>
  );
}
