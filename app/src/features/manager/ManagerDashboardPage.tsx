import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { getOrderList } from '../../services/orderList.service';
import { getTestTrackingMeta } from '../../services/testTrackingMeta.service';
import { getLatestInventoryReportDate, getManagerInventoryLookup, getManagerInventoryTransactions } from '../../services/managerInventory.service';

const cards = [
  { key: 'totalOrders', label: 'Total Orders', status: 'all' },
  { key: 'pending', label: 'Pending', status: 'pending' },
  { key: 'approved', label: 'Approved', status: 'approved' },
  { key: 'processed', label: 'Processed', status: 'processed' },
  { key: 'issued', label: 'Issued', status: 'issued' },
  { key: 'received', label: 'Received', status: 'received' },
  { key: 'rejected', label: 'Rejected', status: 'rejected' },
] as const;

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
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryBranch, setInventoryBranch] = useState('all');
  const [inventoryDate, setInventoryDate] = useState('');

  const { data: orders = [], isLoading } = useQuery({ queryKey: ['order-list-paged'], queryFn: getOrderList });
  const latestDateQuery = useQuery({ queryKey: ['manager-inventory-latest-date'], queryFn: getLatestInventoryReportDate });
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

  const metaQuery = useQuery({
    queryKey: ['manager-tracking-meta', orders.map((order) => order.id).join('|')],
    queryFn: () => getTestTrackingMeta(orders.map((order) => order.id)),
    enabled: orders.length > 0,
  });

  const metaMap = metaQuery.data ?? {};
  const orderBranches = useMemo(() => [...new Set(orders.map((order) => order.branch))].sort(), [orders]);
  const statuses = useMemo(() => [...new Set(orders.map((order) => order.status))].sort(), [orders]);
  const inventoryRows = hasInventorySearch ? inventoryQuery.data ?? [] : [];
  const txnRows = hasInventorySearch ? txnQuery.data ?? [] : [];
  const inventoryBranches = useMemo(() => [...new Set(inventoryRows.map((row) => row.branch_code))].sort(), [inventoryRows]);

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const orderDate = order.created_at.slice(0, 10);
    return (branchFilter === 'all' || order.branch === branchFilter) && (statusFilter === 'all' || (statusFilter === 'pending' ? order.status.includes('pending') : order.status === statusFilter)) && (!dateFrom || orderDate >= dateFrom) && (!dateTo || orderDate <= dateTo);
  }), [orders, branchFilter, statusFilter, dateFrom, dateTo]);

  const data = {
    totalOrders: filteredOrders.length,
    pending: filteredOrders.filter((order) => order.status.includes('pending')).length,
    approved: filteredOrders.filter((order) => order.status === 'approved').length,
    processed: filteredOrders.filter((order) => order.status === 'processed').length,
    issued: filteredOrders.filter((order) => order.status === 'issued').length,
    received: filteredOrders.filter((order) => order.status === 'received').length,
    rejected: filteredOrders.filter((order) => order.status === 'rejected').length,
  };

  function exportOrders() {
    downloadCsv(
      `manager-orders-${new Date().toISOString().slice(0, 10)}.csv`,
      ['Order No', 'Final No', 'Branch', 'Customer', 'Machine', 'Type', 'For', 'Status', 'Qty', 'Value', 'Comments', 'Created'],
      filteredOrders.map((order) => {
        const meta = metaMap[order.id] ?? { totalQty: 0, totalValue: 0, commentCount: 0 };
        return [order.order_no, order.final_order_no ?? '', order.branch, order.customer_name ?? '', order.machine_no ?? '', order.order_type, order.order_for, order.status, meta.totalQty, meta.totalValue, meta.commentCount, order.created_at.slice(0, 10)];
      }),
    );
  }

  function exportInventory() {
    downloadCsv(
      `manager-inventory-${effectiveInventoryDate || 'latest'}.csv`,
      ['Report Date', 'Branch Code', 'Branch Name', 'Part No', 'Item Name', 'Group', 'UOM', 'Qty', 'DNP', 'Value'],
      inventoryRows.map((row) => [row.report_date, row.branch_code, row.branch_name, row.item_code, row.item_name, row.item_group, row.uom, row.qty, row.dnp, row.inv_value]),
    );
  }

  function exportTransactions() {
    downloadCsv(
      `manager-inventory-transactions-${effectiveInventoryDate || 'latest'}.csv`,
      ['Report Date', 'Branch Code', 'Branch Name', 'Part No', 'Item Name', 'Group', 'Received', 'Issued', 'Closing Balance', 'Value'],
      txnRows.map((row) => [row.report_date, row.branch_code, row.branch_name, row.item_code, row.item_name, row.item_group, row.received, row.issued, row.closing_balance, row.closing_value]),
    );
  }

  return (
    <PageCard eyebrow="Manager" title="Manager Dashboard" description="Operational order and inventory summary workspace.">
      {isLoading || metaQuery.isLoading ? <p className="text-xs text-[#c7d2df]">Loading dashboard...</p> : null}

      <div className="mb-3 grid gap-2 lg:grid-cols-[1fr_1fr_140px_140px_auto]">
        <select className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)}>
          <option value="all">All Branches</option>
          {orderBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
        </select>
        <select className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">All Status</option>
          <option value="pending">All Pending</option>
          {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <input type="date" className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        <input type="date" className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        <button className="text-xs font-black text-[#82C8E5] hover:underline" onClick={exportOrders}>Export Orders</button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-7">
        {cards.map((card) => (
          <button key={card.key} className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2 text-left hover:border-[#82C8E5]/70" onClick={() => setStatusFilter(card.status)}>
            <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6D8196]">{card.label}</p>
            <p className="mt-1 text-lg font-black text-white">{data[card.key]}</p>
          </button>
        ))}
      </div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Inventory Position • {effectiveInventoryDate || 'Latest date not found'}</p>
          <div className="flex gap-3">
            <button className="text-xs font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={!inventoryRows.length} onClick={exportInventory}>Export Inventory</button>
            <button className="text-xs font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={!txnRows.length} onClick={exportTransactions}>Export Transactions</button>
          </div>
        </div>

        <div className="mb-2 grid gap-2 lg:grid-cols-[1fr_150px_160px]">
          <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Enter part no to view inventory position" value={inventorySearch} onChange={(event) => setInventorySearch(event.target.value)} />
          <input type="date" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={inventoryDate} onChange={(event) => setInventoryDate(event.target.value)} />
          <select className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={inventoryBranch} onChange={(event) => setInventoryBranch(event.target.value)}>
            <option value="all">All Branch Codes</option>
            {inventoryBranches.map((branch) => <option key={branch} value={branch}>{branch}</option>)}
          </select>
        </div>

        {hasInventorySearch && inventoryQuery.isLoading ? <p className="text-xs text-[#c7d2df]">Searching inventory...</p> : null}

        {hasInventorySearch ? (
          <div className="overflow-hidden rounded-md border border-[#263244]">
            <table className="w-full min-w-[1040px] border-collapse text-left text-xs">
              <thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]">
                <tr>
                  <th className="px-2.5 py-2">Branch</th>
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
                    <td className="px-2.5 py-2 font-black text-white">{row.branch_code}</td>
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
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]">
                <tr>
                  <th className="px-2.5 py-2">Branch</th>
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
                    <td className="px-2.5 py-2 font-black text-white">{row.branch_code}</td>
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
