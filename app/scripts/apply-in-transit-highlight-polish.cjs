const fs = require('fs');
const path = require('path');

const relativePath = 'src/features/approvals/ApprovalsPage.tsx';
const filePath = path.join(__dirname, '..', relativePath);
let source = fs.readFileSync(filePath, 'utf8');

// Keep the In Transit warning readable and subtle.
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
  throw new Error('Subtle Item Review In Transit row highlight marker not found');
}

// Item Review inventory: use the exact branch-specific inventory lookup used on
// Order Details and show it immediately before the In Transit column.
const inTransitImport = "import { getInTransitQtyByBranchParts } from '../../services/inTransit.service';";
const inventoryImport = "import { getInventoryQtyByBranchParts } from '../../services/testInventoryLookup.service';";
if (!source.includes(inventoryImport)) {
  if (!source.includes(inTransitImport)) throw new Error('Item Review In Transit import marker not found');
  source = source.replace(inTransitImport, `${inTransitImport}\n${inventoryImport}`);
}

const inTransitMapMarker = '  const reviewInTransitMap = reviewInTransitQuery.data ?? {};';
const inventoryQueryBlock = `${inTransitMapMarker}\n\n  const reviewInventoryQuery = useQuery({\n    queryKey: ['approval-review-inventory', reviewQuery.data?.order.branch, reviewQuery.data?.items.map((item) => item.part_no).join('|')],\n    queryFn: () => getInventoryQtyByBranchParts(reviewQuery.data!.order.branch, reviewQuery.data!.items.map((item) => item.part_no)),\n    enabled: isReviewPage && !!reviewQuery.data?.order.branch && (reviewQuery.data?.items.length ?? 0) > 0,\n    staleTime: 0,\n  });\n  const reviewInventoryMap = reviewInventoryQuery.data ?? {};`;
if (!source.includes("queryKey: ['approval-review-inventory'")) {
  if (!source.includes(inTransitMapMarker)) throw new Error('Item Review In Transit map marker not found');
  source = source.replace(inTransitMapMarker, inventoryQueryBlock);
}

if (!source.includes('>INV</th>')) {
  const headerPattern = /(<th[^>]*>)In Transit(<\/th>)/;
  const headerMatch = source.match(headerPattern);
  if (!headerMatch) throw new Error('Item Review In Transit header marker not found');
  source = source.replace(headerPattern, `${headerMatch[1]}INV${headerMatch[2]}\n                    ${headerMatch[1]}In Transit${headerMatch[2]}`);
}

const hasTransitMarker = '                  const hasInTransit = !reviewInTransitQuery.isLoading && !reviewInTransitQuery.isError && inTransitQty > 0;';
const inventoryValueLine = '                  const inventoryQty = reviewInventoryMap[normalizePartNo(item.part_no)] ?? 0;';
if (!source.includes(inventoryValueLine)) {
  if (!source.includes(hasTransitMarker)) throw new Error('Item Review In Transit row logic marker not found');
  source = source.replace(hasTransitMarker, `${hasTransitMarker}\n${inventoryValueLine}`);
}

if (!source.includes('reviewInventoryQuery.isLoading')) {
  const transitCellMarker = `                      <td className="px-2.5 py-2 text-right">\n                        {reviewInTransitQuery.isLoading ? (`;
  const inventoryCell = `                      <td className="px-2.5 py-2 text-right font-semibold text-[#0f172a]">\n                        {reviewInventoryQuery.isLoading ? (\n                          <span className="text-[#8fa1b5]">...</span>\n                        ) : reviewInventoryQuery.isError ? (\n                          <span className="font-black text-[#b42318]">—</span>\n                        ) : (\n                          inventoryQty\n                        )}\n                      </td>\n`;
  if (!source.includes(transitCellMarker)) throw new Error('Item Review In Transit cell marker not found');
  source = source.replace(transitCellMarker, `${inventoryCell}${transitCellMarker}`);
}

const inventoryErrorNotice = 'Inventory quantity could not be loaded. Refresh the page before approving this order.';
if (!source.includes(inventoryErrorNotice)) {
  const transitNoticeExpression = /\{reviewInTransitQuery\.isError \? <p className="mb-2 rounded-md border border-\[#f2c8c8\] bg-\[#fff7f7\] px-2\.5 py-1\.5 text-\[11px\] font-semibold text-\[#b42318\]">In Transit quantity could not be loaded\. Refresh the page before approving this order\.<\/p> : null\}/;
  const match = source.match(transitNoticeExpression);
  if (!match) throw new Error('Item Review In Transit error notice expression marker not found');
  source = source.replace(match[0], `${match[0]}\n          {reviewInventoryQuery.isError ? <p className="mb-2 rounded-md border border-[#f2c8c8] bg-[#fff7f7] px-2.5 py-1.5 text-[11px] font-semibold text-[#b42318]">${inventoryErrorNotice}</p> : null}`);
}

fs.writeFileSync(filePath, source, 'utf8');
console.log('Subtle Item Review In Transit highlight and branch inventory column applied.');
