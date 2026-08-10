const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
}

function write(relativePath, source) {
  fs.writeFileSync(path.join(__dirname, '..', relativePath), source, 'utf8');
}

// Order detail/review data: replace the older client-side transit aggregation with
// the canonical branch-wide RPC calculation.
{
  const relativePath = 'src/services/testOrderView.service.ts';
  let source = read(relativePath);

  const importMarker = "import { supabase } from '../lib/supabase';";
  const importLine = "import { getInTransitQtyByBranchParts } from './inTransit.service';";
  if (!source.includes(importLine)) {
    if (!source.includes(importMarker)) throw new Error('In Transit service import marker not found');
    source = source.replace(importMarker, `${importMarker}\n${importLine}`);
  }

  const functionPattern = /async function getInTransitQtyByPart\(branch: string, partNos: string\[\]\) \{[\s\S]*?\n\}\n\nexport async function getTestOrderView/;
  const replacement = `async function getInTransitQtyByPart(branch: string, partNos: string[]) {\n  return getInTransitQtyByBranchParts(branch, partNos);\n}\n\nexport async function getTestOrderView`;
  if (!functionPattern.test(source)) {
    if (!source.includes('return getInTransitQtyByBranchParts(branch, partNos);')) {
      throw new Error('In Transit order-view helper marker not found');
    }
  } else {
    source = source.replace(functionPattern, replacement);
  }

  write(relativePath, source);
}

// Approval Review: query the canonical live In Transit RPC directly from the page.
// Do not rely on the indirect order-view mapping because a stale/missing mapping can
// silently present false zeroes. Rows with an existing In Transit quantity are
// deliberately highlighted so the approving manager notices duplicate movement.
{
  const relativePath = 'src/features/approvals/ApprovalsPage.tsx';
  let source = read(relativePath);

  const serviceImportMarker = "import { getTestOrderView } from '../../services/testOrderView.service';";
  const serviceImportLine = "import { getInTransitQtyByBranchParts } from '../../services/inTransit.service';";
  if (!source.includes(serviceImportLine)) {
    if (!source.includes(serviceImportMarker)) throw new Error('Approval Review In Transit service import marker not found');
    source = source.replace(serviceImportMarker, `${serviceImportMarker}\n${serviceImportLine}`);
  }

  const orderLogicMarker = "import { getEffectiveQty, getEffectiveValue } from '../../lib/orderLogic';";
  const orderLogicReplacement = "import { getEffectiveQty, getEffectiveValue, normalizePartNo } from '../../lib/orderLogic';";
  if (!source.includes('getEffectiveQty, getEffectiveValue, normalizePartNo')) {
    if (!source.includes(orderLogicMarker)) throw new Error('Approval Review order logic import marker not found');
    source = source.replace(orderLogicMarker, orderLogicReplacement);
  }

  const reviewQueryMarker = `  const reviewQuery = useQuery({\n    queryKey: ['approval-review', reviewOrderId],\n    queryFn: () => getTestOrderView(reviewOrderId),\n    enabled: isReviewPage,\n  });`;
  const reviewTransitQueryBlock = `${reviewQueryMarker}\n\n  const reviewInTransitQuery = useQuery({\n    queryKey: ['approval-review-in-transit', reviewQuery.data?.order.branch, reviewQuery.data?.items.map((item) => item.part_no).join('|')],\n    queryFn: () => getInTransitQtyByBranchParts(reviewQuery.data!.order.branch, reviewQuery.data!.items.map((item) => item.part_no)),\n    enabled: isReviewPage && !!reviewQuery.data?.order.branch && (reviewQuery.data?.items.length ?? 0) > 0,\n    staleTime: 0,\n  });\n  const reviewInTransitMap = reviewInTransitQuery.data ?? {};`;
  if (!source.includes("queryKey: ['approval-review-in-transit'")) {
    if (!source.includes(reviewQueryMarker)) throw new Error('Approval Review query marker not found');
    source = source.replace(reviewQueryMarker, reviewTransitQueryBlock);
  }

  source = source.replace(/>Prev 30D<\/th>/g, '>In Transit</th>');

  const loadingMarker = `{reviewQuery.isLoading ? <p className="text-xs text-[#c7d2df]">Loading item review...</p> : null}`;
  const errorNotice = `${loadingMarker}\n          {reviewInTransitQuery.isError ? <p className="mb-2 rounded-md border border-[#f2c8c8] bg-[#fff7f7] px-2.5 py-1.5 text-[11px] font-semibold text-[#b42318]">In Transit quantity could not be loaded. Refresh the page before approving this order.</p> : null}`;
  if (!source.includes('Refresh the page before approving this order.')) {
    if (!source.includes(loadingMarker)) throw new Error('Approval Review loading marker not found');
    source = source.replace(loadingMarker, errorNotice);
  }

  const oldRowsStart = '                {reviewQuery.data?.items.map((item) => (';
  const oldRowsEnd = '                ))}';
  const startIndex = source.indexOf(oldRowsStart);
  if (startIndex !== -1) {
    const endIndex = source.indexOf(oldRowsEnd, startIndex);
    if (endIndex === -1) throw new Error('Approval Review rows end marker not found');

    const liveRows = `                {reviewQuery.data?.items.map((item) => {\n                  const inTransitQty = reviewInTransitMap[normalizePartNo(item.part_no)] ?? 0;\n                  const hasInTransit = !reviewInTransitQuery.isLoading && !reviewInTransitQuery.isError && inTransitQty > 0;\n                  return (\n                    <tr key={item.id} className={hasInTransit ? 'bg-[#3a2f0b]' : 'bg-[#111827]'}>\n                      <td className=\"px-2.5 py-2 font-black text-white\">{item.part_no}</td>\n                      <td className=\"px-2.5 py-2 text-[#d8e3ee]\">{item.description || '-'}</td>\n                      <td className=\"px-2.5 py-2 text-right text-[#d8e3ee]\">{item.qty}</td>\n                      <td className=\"px-2.5 py-2 text-right\">\n                        {reviewInTransitQuery.isLoading ? (\n                          <span className=\"text-[#8fa1b5]\">...</span>\n                        ) : reviewInTransitQuery.isError ? (\n                          <span className=\"font-black text-[#ff8a80]\">—</span>\n                        ) : hasInTransit ? (\n                          <span className=\"inline-flex min-w-[2.25rem] items-center justify-center rounded-full border border-[#f4c542] bg-[#fff3b0] px-2 py-0.5 font-black text-[#6b4e00]\" title=\"This part already has quantity in transit for this branch\">⚠ {inTransitQty}</span>\n                        ) : (\n                          <span className=\"text-[#d8e3ee]\">0</span>\n                        )}\n                      </td>\n                      <td className=\"px-2.5 py-2 text-right\">\n                        <input\n                          className=\"w-20 rounded-md border border-[#263244] bg-[#0b1020] px-2 py-1 text-right text-xs text-white outline-none focus:border-[#82C8E5]\"\n                          value={editedQty[item.id] ?? String(item.edited_qty ?? getEffectiveQty(item))}\n                          disabled={isBlockingAction}\n                          onChange={(event) => setEditedQty((current) => ({ ...current, [item.id]: event.target.value }))}\n                        />\n                      </td>\n                      <td className=\"px-2.5 py-2 text-right text-[#d8e3ee]\">{item.dnp ?? 0}</td>\n                      <td className=\"px-2.5 py-2 text-right font-black text-white\">₹{getEffectiveValue(item).toFixed(2)}</td>\n                    </tr>\n                  );\n                })}`;

    source = source.slice(0, startIndex) + liveRows + source.slice(endIndex + oldRowsEnd.length);
  } else if (!source.includes('const inTransitQty = reviewInTransitMap[normalizePartNo(item.part_no)] ?? 0;')) {
    throw new Error('Approval Review rows marker not found');
  }

  write(relativePath, source);
}

// Order Details intentionally performs its own live RPC query instead of relying
// only on the order-view mapping. This makes the visible column authoritative and
// avoids silently presenting a false zero when an indirect mapping is stale.
{
  const relativePath = 'src/features/orders/OrderDetailPage.tsx';
  let source = read(relativePath);

  const importMarker = "import { getInventoryQtyByBranchParts } from '../../services/testInventoryLookup.service';";
  const importLine = "import { getInTransitQtyByBranchParts } from '../../services/inTransit.service';";
  if (!source.includes(importLine)) {
    if (!source.includes(importMarker)) throw new Error('Order Detail In Transit import marker not found');
    source = source.replace(importMarker, `${importMarker}\n${importLine}`);
  }

  const inventoryQueryMarker = `  const inventoryQuery = useQuery({\n    queryKey: ['test-order-inventory', data?.order.branch, data?.items.map((item) => item.part_no).join('|')],\n    queryFn: () => getInventoryQtyByBranchParts(data!.order.branch, data!.items.map((item) => item.part_no)),\n    enabled: !!data?.order.branch && data.items.length > 0,\n  });`;
  const transitQueryBlock = `${inventoryQueryMarker}\n  const inTransitQuery = useQuery({\n    queryKey: ['order-detail-in-transit', data?.order.branch, data?.items.map((item) => item.part_no).join('|')],\n    queryFn: () => getInTransitQtyByBranchParts(data!.order.branch, data!.items.map((item) => item.part_no)),\n    enabled: !!data?.order.branch && data.items.length > 0,\n    staleTime: 0,\n  });`;
  if (!source.includes("queryKey: ['order-detail-in-transit'")) {
    if (!source.includes(inventoryQueryMarker)) throw new Error('Order Detail inventory query marker not found');
    source = source.replace(inventoryQueryMarker, transitQueryBlock);
  }

  const inventoryMapMarker = '  const inventoryMap = inventoryQuery.data ?? {};';
  const transitMapLine = '  const inTransitMap = inTransitQuery.data ?? {};';
  if (!source.includes(transitMapLine)) {
    if (!source.includes(inventoryMapMarker)) throw new Error('Order Detail inventory map marker not found');
    source = source.replace(inventoryMapMarker, `${inventoryMapMarker}\n${transitMapLine}`);
  }

  source = source.replace(/item\.in_transit_qty \?\? item\.previous_30d_qty \?\? 0/g, 'inTransitMap[normalizePartNo(item.part_no)] ?? item.in_transit_qty ?? 0');
  source = source.replace(/item\.in_transit_qty \?\? 0/g, 'inTransitMap[normalizePartNo(item.part_no)] ?? item.in_transit_qty ?? 0');

  const cellMarker = '<td className="px-2 py-2 text-right text-[#0f172a]">{inTransitMap[normalizePartNo(item.part_no)] ?? item.in_transit_qty ?? 0}</td>';
  const liveCell = '<td className="px-2 py-2 text-right font-semibold text-[#0f172a]">{inTransitQuery.isLoading ? \'...\' : inTransitQuery.isError ? \'—\' : (inTransitMap[normalizePartNo(item.part_no)] ?? item.in_transit_qty ?? 0)}</td>';
  if (source.includes(cellMarker)) source = source.replace(cellMarker, liveCell);

  const partSectionMarker = '<p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-[#0f4c81]">Part Details</p>';
  const errorNotice = `${partSectionMarker}\n        {inTransitQuery.isError ? <p className="mb-2 rounded-md border border-[#f2c8c8] bg-[#fff7f7] px-2.5 py-1.5 text-[11px] font-semibold text-[#b42318]">In Transit quantity could not be loaded. Refresh the page or contact Developer support.</p> : null}`;
  if (!source.includes('In Transit quantity could not be loaded.')) {
    if (!source.includes(partSectionMarker)) throw new Error('Order Detail Part Details marker not found');
    source = source.replace(partSectionMarker, errorNotice);
  }

  write(relativePath, source);
}

console.log('Branch-wide live In Transit quantity patch applied.');
