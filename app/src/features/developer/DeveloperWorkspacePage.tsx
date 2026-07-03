import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { getTestOrders } from '../../services/testData.service';
import { getTestBranches } from '../../services/testBranch.service';
import { getTestParts } from '../../services/testPart.service';
import { getTestApprovers } from '../../services/testProfile.service';

export function DeveloperWorkspacePage() {
  const { data: orders = [] } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const { data: branches = [] } = useQuery({ queryKey: ['test-branches'], queryFn: getTestBranches });
  const { data: parts = [] } = useQuery({ queryKey: ['test-parts'], queryFn: getTestParts });
  const { data: approvers = [] } = useQuery({ queryKey: ['test-approvers'], queryFn: getTestApprovers });

  const checks = [
    ['Test Orders', orders.length],
    ['Active Branches', branches.length],
    ['Loaded Parts', parts.length],
    ['Approvers', approvers.length],
    ['Pending Orders', orders.filter((order) => order.status.includes('pending')).length],
    ['Processed Orders', orders.filter((order) => order.status === 'processed').length],
  ];

  return (
    <PageCard eyebrow="Developer" title="Developer Workspace" description="Staging diagnostics and support overview.">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {checks.map(([label, value]) => (<div key={label} className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6D8196]">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>))}
      </div>
      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Safety Guardrails</p>
        <div className="grid gap-2 text-xs text-[#d8e3ee] md:grid-cols-2">
          <p>Only test_ tables are used in rebuild modules.</p>
          <p>Live tables remain untouched until cutover.</p>
          <p>Order numbers are restricted to TEST-* during staging.</p>
          <p>Auth is Supabase email/password, not legacy frontend password matching.</p>
        </div>
      </div>
    </PageCard>
  );
}
