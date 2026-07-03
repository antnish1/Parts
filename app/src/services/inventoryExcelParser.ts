import * as XLSX from 'xlsx';

export type ParsedInventoryUploadRow = {
  report_date: string;
  branch_code: string;
  item_code: string;
  item_name: string | null;
  item_group: string | null;
  uom: string | null;
  dnp: number;
  qty: number;
  inv_value: number;
};

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function toNumber(value: unknown) {
  const parsed = Number(clean(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function readColumn(row: Record<string, unknown>, names: string[]) {
  const found = Object.keys(row).find((key) => names.some((name) => key.trim().toLowerCase() === name.toLowerCase()));
  return found ? row[found] : '';
}

export async function parseInventoryExcel(file: File, reportDate: string) {
  if (!reportDate) throw new Error('Report date is required.');
  const workbook = XLSX.read(await file.arrayBuffer());
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const deduped = new Map<string, ParsedInventoryUploadRow>();
  let failedRows = 0;

  rawRows.forEach((row) => {
    const branchCode = clean(readColumn(row, ['Br. Code', 'Br Code', 'Branch Code', 'Branch'])).toUpperCase();
    const itemCode = clean(readColumn(row, ['Itemcode', 'Item Code', 'Material', 'Part No'])).replace(/\s+/g, '').toUpperCase();
    const itemName = clean(readColumn(row, ['ItemName', 'Item Name', 'Description']));
    const footerText = `${branchCode} ${itemCode} ${itemName}`.toLowerCase();

    if (!branchCode || !itemCode || footerText.includes('grand total')) {
      failedRows += 1;
      return;
    }

    deduped.set(`${branchCode}|${itemCode}`, {
      report_date: reportDate,
      branch_code: branchCode,
      item_code: itemCode,
      item_name: itemName || null,
      item_group: clean(readColumn(row, ['Item Group', 'Group'])) || null,
      uom: clean(readColumn(row, ['UOM', 'Uom'])) || null,
      dnp: toNumber(readColumn(row, ['DNP', 'Dnp'])),
      qty: toNumber(readColumn(row, ['Closing Balance', 'Closing Bal', 'Qty', 'Quantity'])),
      inv_value: toNumber(readColumn(row, ['Closing Inv Val', 'Inventory Value', 'Inv Value'])),
    });
  });

  return { totalRows: rawRows.length, failedRows, rows: [...deduped.values()] };
}
