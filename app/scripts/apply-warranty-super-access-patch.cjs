const fs = require('fs');
const path = require('path');

function patchOrderList() {
  const file = path.join(__dirname, '..', 'src', 'services', 'orderList.service.ts');
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');

  if (!text.includes("normalizeBranchKey } from './branchScope.service'")) {
    text = text.replace(
      "import { getCurrentBranchScopeValues, getCurrentPortalProfile } from './branchScope.service';",
      "import { getCurrentBranchScopeValues, getCurrentPortalProfile, normalizeBranchKey } from './branchScope.service';"
    );
  }

  if (!text.includes('function isWarrantySuper')) {
    text = text.replace(
      "type OrderListOptions = {\n  limit?: number;\n  pendingOnly?: boolean;\n};",
      "type OrderListOptions = {\n  limit?: number;\n  pendingOnly?: boolean;\n};\n\nfunction isWarrantySuper(profile: { role?: string | null; branch?: string | null } | null | undefined) {\n  return profile?.role === 'super' && normalizeBranchKey(profile.branch) === 'WARRANTY';\n}"
    );
  }

  text = text.replace(
    "  if (profile?.role === 'super') {\n    query = query.eq('approver_id', profile.id || '__NO_APPROVER__');\n  }",
    "  if (profile?.role === 'super') {\n    if (isWarrantySuper(profile)) {\n      query = query.or(`approver_id.eq.${profile.id || '__NO_APPROVER__'},branch.eq.WARRANTY`);\n    } else {\n      query = query.eq('approver_id', profile.id || '__NO_APPROVER__');\n    }\n  }"
  );

  fs.writeFileSync(file, text, 'utf8');
}

function patchOrderView() {
  const file = path.join(__dirname, '..', 'src', 'services', 'testOrderView.service.ts');
  if (!fs.existsSync(file)) return;
  let text = fs.readFileSync(file, 'utf8');

  if (!text.includes('normalizeBranchKey } from')) {
    text = text.replace(
      "import { currentBranchScopeIncludes, getCurrentPortalProfile } from './branchScope.service';",
      "import { currentBranchScopeIncludes, getCurrentPortalProfile, normalizeBranchKey } from './branchScope.service';"
    );
  }

  if (!text.includes('function canWarrantySuperView')) {
    text = text.replace(
      "function isTransitCandidate(row: TransitCandidate) {",
      "function canWarrantySuperView(profile: { role?: string | null; branch?: string | null } | null | undefined, orderBranch: string | null | undefined) {\n  return profile?.role === 'super' && normalizeBranchKey(profile.branch) === 'WARRANTY' && normalizeBranchKey(orderBranch) === 'WARRANTY';\n}\n\nfunction isTransitCandidate(row: TransitCandidate) {"
    );
  }

  text = text.replace(
    "  if (profile?.role === 'super' && rawOrder.approver_id !== profile.id) throw new Error('This order is assigned to another approver.');",
    "  if (profile?.role === 'super' && rawOrder.approver_id !== profile.id && !canWarrantySuperView(profile, rawOrder.branch)) throw new Error('This order is assigned to another approver.');"
  );

  fs.writeFileSync(file, text, 'utf8');
}

patchOrderList();
patchOrderView();
