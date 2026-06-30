import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { getTestInventory } from '../../services/testInventory.service';

export function InventoryUploadPage() {
  const [search, setSearch] = useState('');
  const { data: rows = [], isLoading } = useQuery({ queryKey: ['test-inventory'], queryFn: getTestInventory });

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => `${row.branch_code} ${row.item_code} ${row.item_name ?? ''}`.toLowerCase().includes(term));
  }, [rows, search]);

  return (
    <PageCard eyebrow="Inventory" title="Inventory Lookup" description="Branch and item stock review workspace.">
      <input
        className="mb-2 w-full rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]"
        placeholder="Search branch, item code, or item name"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {isLoading ? <p className="text-xs text-[#c7d2df]">Loading inventory...</p> : null}
      <div className="overflow-hidden rounded-lg border border-[#263244]">
        <table className="w-full min-w-[720px] border-collapse text-left text-xs">
          <thead className="bg-[#0b1020] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]">
            <tr>
              <th className="px-2.5 py-2">Branch</th>
              <th className="px-2.5 py-2">Item Code</th>
              <th className="px-2.5 py-2">Item Name</th>
              <th className="px-2.5 py-2">Group</th>
              <th className="px-2.5 py-2">Qty</th>
              <th className="px-2.5 py-2">DNP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#263244] bg-[#111827]">
            {filteredRows.map((row) => (
              <tr key={row.id} className="hover:bg-[#182235]">
                <td className="px-2.5 py-2 font-black text-white">{row.branch_code}</td>
                <td className="px-2.5 py-2 text-[#d8e3ee]">{row.item_code}</td>
                <td className="px-2.5 py-2 text-[#d8e3ee]">{row.item_name ?? '-'}</td>
                <td className="px-2.5 py-2 text-[#d8e3ee]">{row.item_group ?? '-'}</td>
                <td className="px-2.5 py-2 text-[#d8e3ee]">{row.qty}</td>
                <td className="px-2.5 py-2 text-[#d8e3ee]">{row.dnp ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No inventory found.</p> : null}
      </div>
    </PageCard>
  );
}
