const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'services', 'testDocket.service.ts');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');
if (content.includes('fetchLegacyDocketRows')) process.exit(0);

content = content.replace("source_type: 'billing' | 'item';", "source_type: 'billing' | 'item' | 'legacy_request';");

const insertAfter = `function matchesDocket(row: { docket_no: string | null | undefined }, needle: string) {\n  return docketKey(row.docket_no) === needle;\n}\n`;
const legacyFunction = `function mapLegacyDocketStatus(value) {\n  const raw = String(value ?? '').trim().toUpperCase().replace(/[\\s-]+/g, ' ');\n  if (raw === 'RECEIVED') return 'received';\n  if (raw === 'ISSUED') return 'issued';\n  if (raw === 'REJECTED') return 'rejected';\n  if (raw === 'PENDING APPROVAL') return 'pending_approval';\n  if (raw === 'PROCESSED') return 'processed';\n  if (raw === 'DISPATCHED') return 'dispatched';\n  if (raw === 'PARTIALLY DISPATCHED') return 'partially_dispatched';\n  return String(value ?? '').trim().toLowerCase().replace(/[\\s-]+/g, '_') || 'pending_approval';\n}\n\nasync function fetchLegacyDocketRows(docket: string, branchValues: string[] | null | undefined): Promise<TestDocketRow[]> {\n  const targetKey = docketKey(docket);\n  if (!targetKey) return [];\n\n  let query = supabase\n    .from('requests')\n    .select('id, created_at, Branch, OrderType, OrderFor, MachineNo, CustomerName, PartNo, Qty, Description, OrderNo, Status, DeliveryNo, BillNo, BillingDt, TransportName, Docket, BilledQty, ApprovalStatus, editedqty, billed_qty_total, DBMSinvoiceNo, DBMSinvoiceDate, receivedDate')\n    .not('Docket', 'is', null)\n    .limit(5000);\n\n  if (branchValues?.length) query = query.in('Branch', branchValues);\n\n  const { data, error } = await query;\n  if (error) {\n    console.warn('Legacy request docket fallback failed.', error.message);\n    return [];\n  }\n\n  return ((data ?? []) as Array<Record<string, any>>)\n    .filter((row) => docketKey(row.Docket) === targetKey)\n    .map((row) => {\n      const status = mapLegacyDocketStatus(row.Status);\n      const billed = toNumber(row.BilledQty || row.billed_qty_total || (['received', 'issued'].includes(status) ? row.editedqty || row.Qty : 0));\n      const received = ['received', 'issued'].includes(status) ? billed : 0;\n      const id = String(row.id);\n      return {\n        id: 'legacy-' + id,\n        source_type: 'legacy_request' as const,\n        order_id: 'legacy-' + id,\n        item_id: 'legacy-' + id,\n        order_no: row.OrderNo || 'REQ-' + id,\n        final_order_no: row.OrderNo || null,\n        branch: row.Branch || '-',\n        order_type: row.OrderType || null,\n        order_for: row.OrderFor || null,\n        customer_name: row.CustomerName || null,\n        machine_no: row.MachineNo || null,\n        order_status: status,\n        approval_status: row.ApprovalStatus || null,\n        part_no: row.PartNo || 'UNKNOWN',\n        description: row.Description || null,\n        ordered_qty: toNumber(row.Qty),\n        edited_qty: row.editedqty ?? null,\n        item_status: status,\n        invoice_no: row.BillNo || row.DBMSinvoiceNo || null,\n        billing_date: row.BillingDt || row.DBMSinvoiceDate || null,\n        docket_no: row.Docket || null,\n        transport_name: row.TransportName || null,\n        delivery_no: row.DeliveryNo || null,\n        billed_qty: billed,\n        received_qty: received,\n        received_at: row.receivedDate || null,\n        raw_status: row.Status || null,\n        created_at: row.created_at,\n      };\n    });\n}\n`;

if (!content.includes(insertAfter)) {
  console.error('Docket fallback patch failed: insertion anchor not found.');
  process.exit(1);
}
content = content.replace(insertAfter, `${insertAfter}\n${legacyFunction}`);

const oldLookup = `  const billingRows = await fetchBillingRows(docket, branchValues);\n  const itemRows = await fetchItemRows(docket, branchValues);\n  const chunkItemIds = new Set(billingRows.map((row) => row.item_id));\n  const fallbackItemRows = itemRows.filter((row) => !chunkItemIds.has(row.item_id));\n\n  return [...billingRows, ...fallbackItemRows].sort((a, b) => {`;
const newLookup = `  const billingRows = await fetchBillingRows(docket, branchValues);\n  const itemRows = await fetchItemRows(docket, branchValues);\n  const chunkItemIds = new Set(billingRows.map((row) => row.item_id));\n  const fallbackItemRows = itemRows.filter((row) => !chunkItemIds.has(row.item_id));\n  const structuredRows = [...billingRows, ...fallbackItemRows];\n  const legacyRows = structuredRows.length ? [] : await fetchLegacyDocketRows(docket, branchValues);\n\n  return [...structuredRows, ...legacyRows].sort((a, b) => {`;
if (!content.includes(oldLookup)) {
  console.error('Docket fallback patch failed: lookup anchor not found.');
  process.exit(1);
}
content = content.replace(oldLookup, newLookup);

const oldReceiveGuard = `  if (!row.id) throw new Error('Docket row id is required.');\n  const status = normalizedStatus(row.item_status || row.order_status);`;
const newReceiveGuard = `  if (!row.id) throw new Error('Docket row id is required.');\n  if (row.source_type === 'legacy_request') throw new Error('This docket row is from legacy requests. Import it into portal tables before receiving from the new docket page.');\n  const status = normalizedStatus(row.item_status || row.order_status);`;
if (!content.includes(oldReceiveGuard)) {
  console.error('Docket fallback patch failed: receive guard anchor not found.');
  process.exit(1);
}
content = content.replace(oldReceiveGuard, newReceiveGuard);

fs.writeFileSync(filePath, content, 'utf8');
