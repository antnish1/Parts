const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'src', 'features', 'tracking', 'TrackOrdersPage.tsx');
if (!fs.existsSync(filePath)) process.exit(0);

const inventoryPatch = path.join(__dirname, 'apply-central-branch-inventory-patch.cjs');
if (fs.existsSync(inventoryPatch)) require(inventoryPatch);

const warrantyPatch = path.join(__dirname, 'apply-warranty-super-access-patch.cjs');
if (fs.existsSync(warrantyPatch)) require(warrantyPatch);

const mobilePatch = path.join(__dirname, 'apply-mobile-shell-patch.cjs');
if (fs.existsSync(mobilePatch)) require(mobilePatch);

const newOrderPatch = path.join(__dirname, 'apply-new-order-mobile-safety.cjs');
if (fs.existsSync(newOrderPatch)) require(newOrderPatch);

const trackMobileFilterPatch = path.join(__dirname, 'apply-track-mobile-filter-layout.cjs');
if (fs.existsSync(trackMobileFilterPatch)) require(trackMobileFilterPatch);

const cdNavPatch = path.join(__dirname, 'apply-cd-nav-patch.cjs');
if (fs.existsSync(cdNavPatch)) require(cdNavPatch);

const actionBarPatch = path.join(__dirname, 'mobile-action-bar-fix.cjs');
if (fs.existsSync(actionBarPatch)) require(actionBarPatch);

const requestDialogPatch = path.join(__dirname, 'apply-request-form-dialogs.cjs');
if (fs.existsSync(requestDialogPatch)) require(requestDialogPatch);
