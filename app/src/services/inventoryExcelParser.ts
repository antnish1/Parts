import * as XLSX from 'xlsx';

export type ParsedInventoryUploadRow = {
  report_date: string;
  branch_code: string;
  branch_name: string | null;
  item_code: string;
  item_name: string | null;
  item_group: string | null;
  uom: string | null;
  dnp: number;
  opening_balance: number;
  opening_value: number;
  received_qty: number;
  issued_qty: number;
  closing_balance: number;
  closing_value: number;
  qty: number;
  inv_value: number;
};

const INACTIVE_INVENTORY_BRANCH_CODES = new Set([
  'DFM001',
  'DFM002',
  'DFM0014',
  'DFM0031',
  'DFM0033',
  'HDFM002',
]);

const INVENTORY_BRANCH_OVERRIDES: Record<string, { branchName: string; branchCode: string }> = {
  DFM003: { branchName: 'JABALPUR PARTS', branchCode: 'DFM003' },
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeBranchKey(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '');
}

function clean(value: unknown) {
  return String(value ?? '').trim();
}

function toNumber(value: unknown) {
  const normalized = clean(value).replace(/,/g, '').replace(/₹/g, '').replace(/\s/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function readColumn(row: Record<string, unknown>, names: string[]) {
  const acceptedNames = names.map(normalizeHeader);
  const found = Object.keys(row).find((key) => acceptedNames.includes(normalizeHeader(key)));
  return found ? row[found] : '';
}

export async function parseInventoryExcel(file: File, reportDate: string) {
  if (!reportDate) throw new Error('Report date is required.');
  const workbook = XLSX.read(await file.arrayBuffer());
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const deduped = new Map<string, ParsedInventoryUploadRow>();
  let failedRows = 0;
  let ignoredRows = 0;

  rawRows.forEach((row) => {
    const sourceBranchName = clean(readColumn(row, ['Branch']));
    const sourceBranchCode = clean(readColumn(row, ['Br. Code', 'Br Code', 'Branch Code', 'BrCode'])).toUpperCase();
    const itemCode = clean(readColumn(row, ['Itemcode', 'Item Code', 'Material', 'Part No', 'PartNo'])).replace(/\s+/g, '').toUpperCase();
    const itemName = clean(readColumn(row, ['ItemName', 'Item Name', 'Description']));
    const itemGroup = clean(readColumn(row, ['Item Group', 'ItemGroup', 'Group']));
    const uom = clean(readColumn(row, ['UOM', 'Uom']));
    const footerText = `${sourceBranchName} ${sourceBranchCode} ${itemCode} ${itemName}`.toLowerCase();

    if (INACTIVE_INVENTORY_BRANCH_CODES.has(sourceBranchCode)) {
      ignoredRows += 1;
      return;
    }

    if (!sourceBranchCode || !itemCode || footerText.includes('grand total') || footerText === '') {
      failedRows += 1;
      return;
    }

    const branchOverride = INVENTORY_BRANCH_OVERRIDES[sourceBranchCode];
    const branchCode = branchOverride?.branchCode ?? sourceBranchCode;
    const branchName = branchOverride?.branchName ?? sourceBranchName;
    const openingBalance = toNumber(readColumn(row, ['Opening Balance', 'OpeningBalance', 'Opening Bal']));
    const openingValue = toNumber(readColumn(row, ['Opening Inv Val', 'Opening Inv Value', 'Opening Value', 'OpeningInvVal']));
    const receivedQty = toNumber(readColumn(row, ['Received', 'Receipt', 'Received Qty', 'ReceivedQty']));
    const issuedQty = toNumber(readColumn(row, ['Issued', 'Issue', 'Issued Qty', 'IssuedQty']));
    const closingBalance = toNumber(readColumn(row, ['Closing Balance', 'ClosingBalance', 'Closing Bal', 'Qty', 'Quantity']));
    const closingValue = toNumber(readColumn(row, ['Closing Inv Val', 'Closing Inv Value', 'Closing Value', 'Inventory Value', 'Inv Value', 'ClosingInvVal']));
    const branchIdentity = normalizeBranchKey(branchName) || branchCode;

    deduped.set(`${branchIdentity}|${branchCode}|${itemCode}`, {
      report_date: reportDate,
      branch_code: branchCode,
      branch_name: branchName || null,
      item_code: itemCode,
      item_name: itemName || null,
      item_group: itemGroup || null,
      uom: uom || null,
      dnp: toNumber(readColumn(row, ['DNP', 'Dnp'])),
      opening_balance: openingBalance,
      opening_value: openingValue,
      received_qty: receivedQty,
      issued_qty: issuedQty,
      closing_balance: closingBalance,
      closing_value: closingValue,
      qty: closingBalance,
      inv_value: closingValue,
    });
  });

  return { totalRows: rawRows.length, failedRows, ignoredRows, rows: [...deduped.values()] };
}
