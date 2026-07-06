const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'approvals', 'ApprovalsPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);

let content = fs.readFileSync(filePath, 'utf8');

content = content
  .replace("import { getOrderList } from '../../services/orderList.service';", "import { getApprovalOrderList } from '../../services/orderList.service';")
  .replace("queryKey: ['order-list-paged'],", "queryKey: ['approval-order-list'],")
  .replace('queryFn: getOrderList,', 'queryFn: getApprovalOrderList,')
  .replace("approved: orders.filter((order) => order.status === 'approved').length,", 'approved: pendingOrders.length,')
  .replace("rejected: orders.filter((order) => order.status === 'rejected').length,", 'rejected: filteredOrders.length,')
  .replace('>Approved</p>', '>Queue</p>')
  .replace('>Rejected</p>', '>Showing</p>')
  .replace('Loading pending approval orders...', 'Loading pending approval orders...');

fs.writeFileSync(filePath, content, 'utf8');
