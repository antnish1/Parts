import * as XLSX from 'xlsx';
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

function orderExportRows(orders: TestOrder[]) {
  return orders.map((order) => ({
    'Order No': order.order_no,
    'Final Order No': order.final_order_no ?? '',
    Branch: order.branch,
    Type: order.order_type,
    For: order.order_for,
    'Machine No': order.machine_no ?? '',
    Customer: order.customer_name ?? '',
    Status: order.status,
    'Processing Ref': order.processing_reference ?? '',
    'Invoice No': order.dbms_invoice_no ?? '',
    'Invoice Date': order.dbms_invoice_date ?? '',
    'Docket No': order.docket_no ?? '',
    Transport: order.transport_name ?? '',
    'Received Date': order.received_date ?? '',
    'Created At': order.created_at,
  }));
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

export function downloadOrdersExcel(orders: TestOrder[], filenamePrefix = 'orders') {
  const worksheet = XLSX.utils.json_to_sheet(orderExportRows(orders));
  worksheet['!cols'] = [
    { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 18 }, { wch: 24 }, { wch: 20 }, { wch: 18 }, { wch: 18 },
    { wch: 14 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 22 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');
  XLSX.writeFile(workbook, `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.xlsx`);
}
