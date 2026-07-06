const fs = require('fs');
const path = require('path');

function patch(relativePath, replacements) {
  const filePath = path.join(__dirname, '..', relativePath);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');
  const before = content;
  for (const [from, to] of replacements) {
    content = content.replaceAll(from, to);
  }

  if (content !== before) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Portal cutover patch applied: ${relativePath}`);
  }
}

patch('src/services/testProfile.service.ts', [
  [".from('test_profiles')", ".from('portal_profiles')"],
  ["login_id, is_active, created_at", "login_id:legacy_user_id, is_active, created_at"],
  ["id, full_name, branch, role, login_id')", "id, full_name, branch, role, login_id:legacy_user_id')"],
  ['Failed to load test approvers', 'Failed to load portal approvers'],
  ['Failed to load test profiles', 'Failed to load portal profiles'],
]);

patch('src/services/testInventoryLookup.service.ts', [
  [".from('test_branch_mapping')", ".from('branch_mapping')"],
  [".from('test_inventory_current')", ".from('portal_inventory_current')"],
]);

patch('src/services/inventoryUploadWriter.ts', [
  [".from('test_inventory_staging')", ".from('portal_inventory_staging')"],
  [".from('test_inventory_current')", ".from('portal_inventory_current')"],
  [".from('test_inventory_uploads')", ".from('portal_inventory_uploads')"],
  ['Falling back to direct Supabase upload.', 'Falling back to direct portal Supabase upload.'],
]);
