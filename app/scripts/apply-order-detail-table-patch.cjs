const fs = require('fs');
const path = require('path');

function patchFile(relativePath, replacements) {
  const filePath = path.join(__dirname, '..', relativePath);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;

  for (const [from, to] of replacements) {
    if (content.includes(from)) {
      content = content.split(from).join(to);
      changed = true;
    }
  }

  const beforeRegex = content;

  content = content
    .replace(/\n\s*<div className="mt-4 rounded-xl border border\[#c7d7e5\][\s\S]*?<\/div>\n\s*<\/section>/g, '\n      </section>');

  if (content !== beforeRegex) changed = true;

  if (changed) fs.writeFileSync(filePath, content, 'utf8');
}

patchFile('src/features/orders/OrderDetailPage.tsx', [
  ['overflow-hidden rounded-lg border border-[#d9dee7]', 'overflow-x-auto rounded-lg border border-[#d9dee7]'],
  ['w-full min-w-[1540px] border-collapse text-left text-xs', 'w-full min-w-[1680px] border-collapse text-left text-[11px]'],
  ['PrevQty 30d', 'In Transit'],
  ['item.previous_30d_qty ?? 0', 'item.in_transit_qty ?? item.previous_30d_qty ?? 0'],
  ['\'Prev 30d\'', '\'In Transit\''],
  ['\'PrevQty 30d\'', '\'In Transit\''],
  ['<th className="px-2 py-2 text-right">Billed Qty</th><th className="px-2 py-2">Raw Status</th><th className="px-2 py-2">Uploaded</th>', '<th className="px-2 py-2 text-right">Billed Qty</th><th className="px-2 py-2 text-right">Received Qty</th><th className="px-2 py-2">Received At</th><th className="px-2 py-2">Raw Status</th><th className="px-2 py-2">Uploaded</th>'],
  ['<td className="px-2 py-2 text-right font-semibold text-[#0f172a]">{Number(chunk.billed_qty ?? 0)}</td>\n                                    <td className="px-2 py-2 text-[#475569]">{chunk.raw_status || \'-\'}</td>', '<td className="px-2 py-2 text-right font-semibold text-[#0f172a]">{Number(chunk.billed_qty ?? 0)}</td>\n                                    <td className="px-2 py-2 text-right font-semibold text-[#0f766e]">{Number(chunk.received_qty ?? 0)}</td>\n                                    <td className="px-2 py-2 text-[#475569]">{chunk.received_at ? formatDate(chunk.received_at) : \'-\'}</td>\n                                    <td className="px-2 py-2 text-[#475569]">{chunk.raw_status || \'-\'}</td>'],
]);

patchFile('src/features/orders/NewOrderPage.tsx', [
  ['<th className="px-2 py-2 text-center">30D</th>', '<th className="px-2 py-2 text-center">In Transit</th>'],
  ['console.warn(\'Previous quantity lookup failed\', error);', 'console.warn(\'In transit quantity lookup failed\', error);'],
]);
