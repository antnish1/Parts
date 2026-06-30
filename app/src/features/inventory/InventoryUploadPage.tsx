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
    <PageCard eyebrow="Inventory" title="Inventory Lookup" description="Reads only from test_inventory_current. Live inventory_current is not used.">
      <input
        className="mb-4 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-pc-gold"
        placeholder="Search branch, item code, or item name"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      {isLoading ? <p className="text-sm text-pc-muted">Loading test inventory...</p> : null}
      <div className="overflow-hidden rounded-2xl border border-slate-800">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead className="bg-slate-950 text-xs uppercase tracking-wider text-pc-muted">
            <tr>
              <th className="px-4 py-3">Branch</th>
              <th className="px-4 py-3">Item Code</th>
              <th className="px-4 py-3">Item Name</th>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">DNP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 bg-slate-900/60">
            {filteredRows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/60">
                <td className="px-4 py-3 font-black text-white">{row.branch_code}</td>
                <td className="px-4 py-3 text-slate-300">{row.item_code}</td>
                <td className="px-4 py-3 text-slate-300">{row.item_name ?? '-'}</td>
                <td className="px-4 py-3 text-slate-300">{row.item_group ?? '-'}</td>
                <td className="px-4 py-3 text-slate-300">{row.qty}</td>
                <td className="px-4 py-3 text-slate-300">{row.dnp ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRows.length === 0 ? <p className="p-4 text-sm text-pc-muted">No test inventory found.</p> : null}
      </div>
    </PageCard>
  );
}
