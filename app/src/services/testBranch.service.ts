export type TestBranch = {
  id: string;
  branch_name: string;
  branch_code: string;
};

const PORTAL_BRANCHES: TestBranch[] = [
  'Jabalpur BHL',
  'Jabalpur HL',
  'Damoh',
  'Mandla',
  'Dindori',
  'Seoni',
  'Anuppur',
  'Balaghat',
  'Katni',
].map((branch) => ({ id: branch, branch_name: branch, branch_code: branch }));

export async function getTestBranches(): Promise<TestBranch[]> {
  return PORTAL_BRANCHES;
}
