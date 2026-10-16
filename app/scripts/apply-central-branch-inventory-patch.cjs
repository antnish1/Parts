const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/services/testInventoryLookup.service.ts');
let text = fs.readFileSync(file, 'utf8');
if (text.includes('CURRENT_INVENTORY_SNAPSHOT_V2')) {
  // The latest-report stock lookup uses getBranchCalculationScope directly.
  // Do not reintroduce the former shared-code fallback, which mixed old
  // 2026-06 unkeyed inventory into the current 2026-10 branch snapshot.
  console.log('Current inventory snapshot V2: legacy inventory patch skipped.');
} else {

if (!text.includes("centralBranchGroup.service")) {
  text = text.replace(
    "import { getBranchCalculationScope } from './branchCalculation.service';",
    "import { getBranchCalculationScope } from './branchCalculation.service';\nimport { isCentralBranchValue, usesCentralBranchGroup } from './centralBranchGroup.service';"
  );
}

if (!text.includes('const includeCentral = usesCentralBranchGroup')) {
  text = text.replace(
    '  const normalizedBranchKey = normalizeBranchKey(branchName);\n',
    '  const normalizedBranchKey = normalizeBranchKey(branchName);\n  const includeCentral = usesCentralBranchGroup([branchName, ...branchScope]);\n'
  );
}

text = text.replace(
  "    .filter((row) => (row.branch_key ? scopeSet.has(row.branch_key) : false) || normalizeBranchKey(row.branch_name) === normalizedBranchKey || normalizeBranchKey(row.branch_code) === normalizedBranchKey)",
  "    .filter((row) => {\n      const exactMatch = (row.branch_key ? scopeSet.has(row.branch_key) : false) || normalizeBranchKey(row.branch_name) === normalizedBranchKey || normalizeBranchKey(row.branch_code) === normalizedBranchKey;\n      const groupMatch = includeCentral && [row.branch_key, row.branch_name, row.branch_code].some(isCentralBranchValue);\n      return exactMatch || groupMatch;\n    })"
);

fs.writeFileSync(file, text);

}
