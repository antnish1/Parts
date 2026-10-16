const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src/features/approvals/ApprovalsPage.tsx');
let source = fs.readFileSync(filePath, 'utf8');

// Preserve the existing subtle in-transit styling.
source = source
  .replace(
    "className={hasInTransit ? 'bg-[#3a2f0b]' : 'bg-[#111827]'}",
    "className={hasInTransit ? 'bg-[#fff9e8]' : 'bg-[#111827]'}",
  )
  .replace(
    'border-[#f4c542] bg-[#fff3b0] px-2 py-0.5 font-black text-[#6b4e00]',
    'border-[#e7b94d] bg-[#fff7d6] px-2 py-0.5 font-black text-[#7a5200]',
  );
if (!source.includes("hasInTransit ? 'bg-[#fff9e8]'")) {
  throw new Error('Item Review row highlight marker not found');
}

// APPROVAL_CURRENT_INVENTORY_V2. Run after apply-in-transit-qty.cjs
// (the latter creates the review and its In Transit column).
const inventoryImport = "import { formatInventoryReportDate, getCurrentInventoryByBranchParts } from '../../services/testInventoryLookup.service';";
const transitImport = "import { getInTransitQtyByBranchParts } from '../../services/inTransit.service';";
if (!source.includes(inventoryImport)) {
  if (!source.includes(transitImport)) throw new Error('Approval Review In Transit import missing');
  source = source.replace(transitImport, transitImport + '\n' + inventoryImport);
}

const logicImports = source.split('\n');
const logicIndex = logicImports.findIndex((line) =>
  line.startsWith('import {') && line.includes("from '../../lib/orderLogic';"));
if (logicIndex < 0) throw new Error('Review Qty helper import not found');
if (!logicImports[logicIndex].includes('getPendingQty')) {
  logicImports[logicIndex] = logicImports[logicIndex].replace('import {', 'import { getPendingQty,');
  source = logicImports.join('\n');
}

const inventoryDataMarker = '  const reviewInTransitMap = reviewInTransitQuery.data ?? {};';
const inventoryData = `${inventoryDataMarker}

  const reviewInventoryQuery = useQuery({
    queryKey: ['approval-review-current-inventory', reviewQuery.data?.order.branch, reviewQuery.data?.items.map((item) => item.part_no).join('|')],
    queryFn: () => getCurrentInventoryByBranchParts(reviewQuery.data!.order.branch, reviewQuery.data!.items.map((item) => item.part_no)),
    enabled: !!reviewQuery.data?.order.branch && (reviewQuery.data?.items.length ?? 0) > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  });
  const reviewInventoryMap = reviewInventoryQuery.data?.quantities ?? {};
  const reviewInventoryReportDate = reviewInventoryQuery.data?.reportDate ?? null;`;
if (!source.includes('reviewInventoryReportDate')) {
  if (!source.includes(inventoryDataMarker)) throw new Error('Review Inventory data marker not found');
  source = source.replace(inventoryDataMarker, inventoryData);
}

if (!source.includes('title="Inventory from latest uploaded branch stock report"')) {
  const inTransitHeader = /(<th[^>]*>)In Transit(<\/th>)/;
  const match = source.match(inTransitHeader);
  if (!match) throw new Error('Review In Transit table header not found');
  const pendingHeader = `${match[1]}Pending Qty${match[2]}`;
  const invHeader = `<th className="px-2.5 py-2 text-right" title="Inventory from latest uploaded branch stock report">Inv <span className="block whitespace-nowrap text-[9px] font-medium tracking-normal">{formatInventoryReportDate(reviewInventoryReportDate)}</span></th>`;
  source = source.replace(inTransitHeader, `${pendingHeader}\n                    ${invHeader}\n                    ${match[0]}`);
}

const valueMarker = '                  const hasInTransit = !reviewInTransitQuery.isLoading && !reviewInTransitQuery.isError && inTransitQty > 0;';
const inventoryValueLine = '                  const inventoryQty = reviewInventoryMap[normalizePartNo(item.part_no)] ?? 0;';
if (!source.includes(inventoryValueLine)) {
  if (!source.includes(valueMarker)) throw new Error('Review in-transit item quantity marker not found');
  source = source.replace(valueMarker, valueMarker + '\n' + inventoryValueLine);
}

const inventoryCellMarker = 'reviewInventoryQuery.isLoading ?';
if (!source.includes(inventoryCellMarker)) {
  const transitCellMarker = `                      <td className="px-2.5 py-2 text-right">
                        {reviewInTransitQuery.isLoading ? (`;
  if (!source.includes(transitCellMarker)) throw new Error('Review In Transit cell marker not found');
  const pendingCell = `                      <td className="px-2.5 py-2 text-right font-semibold text-[#0f4c81]">{getPendingQty(item)}</td>
                      <td className="px-2.5 py-2 text-right font-semibold text-[#0f172a]">
                        {reviewInventoryQuery.isLoading ? (
                          <span className="text-[#8fa1b5]">...</span>
                        ) : reviewInventoryQuery.isError || !reviewInventoryReportDate ? (
                          <span title="No inventory report available">—</span>
                        ) : (
                          inventoryQty
                        )}
                      </td>
`;
  source = source.replace(transitCellMarker, pendingCell + transitCellMarker);
}

const notice = 'Current inventory could not be loaded. Refresh the page before approving this order.';
if (!source.includes(notice)) {
  const transitNotice = /\{reviewInTransitQuery\.isError \? <p[^\n]+In Transit quantity could not be loaded\. Refresh the page before approving this order\.<\/p> : null\}/;
  const match = source.match(transitNotice);
  if (!match) throw new Error('Review In Transit notice marker not found');
  source = source.replace(match[0], `${match[0]}
          {reviewInventoryQuery.isError ? <p className="mb-2 rounded-md border border-[#f2c8c8] bg-[#fff7f7] px-2.5 py-1.5 text-[11px] font-semibold text-[#b42318]">${notice}</p> : null}`);
}

fs.writeFileSync(filePath, source, 'utf8');
console.log('Approval Review current inventory/report date, Pending Qty and correct column order applied.');
