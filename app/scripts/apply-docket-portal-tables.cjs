const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'services', 'testDocket.service.ts');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');

content = content
  .replaceAll(".from('test_order_item_billings')", ".from('portal_order_item_billings')")
  .replaceAll(".from('test_order_items')", ".from('portal_order_items')")
  .replaceAll('order:test_orders!inner', 'order:portal_orders!inner')
  .replaceAll('item:test_order_items!inner', 'item:portal_order_items!inner');

fs.writeFileSync(filePath, content, 'utf8');
