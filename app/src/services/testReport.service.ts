import type { TestOrder } from './testData.service';

export type ReportRow = {
  label: string;
  count: number;
};

export function summarizeByBranch(orders: TestOrder[]): ReportRow[] {
  const map = new Map<string, number>();
  orders.forEach((order) => map.set(order.branch, (map.get(order.branch) ?? 0) + 1));
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
}

export function summarizeByStatus(orders: TestOrder[]): ReportRow[] {
  const map = new Map<string, number>();
  orders.forEach((order) => map.set(order.status, (map.get(order.status) ?? 0) + 1));
  return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
}

function escapeCsvCell(cell: unknown) {
  return `"${String(cell).split('"').join('""')}"`;
}

export function downloadOrdersCsv(orders: TestOrder[]) {
  const header = ['Order No', 'Branch', 'Type', 'For', 'Machine No', 'Customer', 'Status', 'Created At'];
  const lines = orders.map((order) => [
    order.order_no,
    order.branch,
    order.order_type,
    order.order_for,
    order.machine_no ?? '',
    order.customer_name ?? '',
    order.status,
    order.created_at,
  ]);
  const csv = [header, ...lines]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `test-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
