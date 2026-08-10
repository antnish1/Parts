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

// Never fall back to the historical 30-day snapshot when the live calculation is
// available. A failed/missing live result should display 0 rather than stale data.
{
  const relativePath = 'src/features/orders/OrderDetailPage.tsx';
  let source = read(relativePath);
  source = source.replace(/item\.in_transit_qty \?\? item\.previous_30d_qty \?\? 0/g, 'item.in_transit_qty ?? 0');
  write(relativePath, source);
}

console.log('Branch-wide live In Transit quantity patch applied.');
