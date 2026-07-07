const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'tracking', 'TrackOrdersPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);

const inventoryPatch = path.join(__dirname, 'apply-central-branch-inventory-patch.cjs');
if (fs.existsSync(inventoryPatch)) require(inventoryPatch);

const warrantyPatch = path.join(__dirname, 'apply-warranty-super-access-patch.cjs');
if (fs.existsSync(warrantyPatch)) require(warrantyPatch);
