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

// Approval Review: the old Prev 30D column now shows the same live In Transit
// quantity that Order Detail and New Order use.
{
  const relativePath = 'src/features/approvals/ApprovalsPage.tsx';
  let source = read(relativePath);
  source = source
    .replace(/>Prev 30D<\/th>/g, '>In Transit</th>')
    .replace(/\{item\.previous_30d_qty \?\? 0\}/g, '{item.in_transit_qty ?? 0}');
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
