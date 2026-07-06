const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'services', 'testOrderView.service.ts');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(
  'const inTransitMap = await getInTransitQtyByPart(rawOrder.branch, rawItems.map((item) => item.part_no));',
  'const inTransitMap: Record<string, number> = {};'
);

fs.writeFileSync(filePath, content, 'utf8');
