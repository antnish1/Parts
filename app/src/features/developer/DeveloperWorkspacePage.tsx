import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { getTestOrders } from '../../services/testData.service';
import { getTestBranches } from '../../services/testBranch.service';
import { getTestParts } from '../../services/testPart.service';
import { getTestApprovers } from '../../services/testProfile.service';

const cutoverChecks = [
  'Run all Supabase test migrations 001 to 006.',
  'Verify no rebuild service writes to live tables.',
  'Create production RPC or Edge Functions before live cutover.',
  'Confirm Supabase Auth users and test_profiles role mapping.',
  'Test full lifecycle: create, approve, process, issue, receive, print.',
  'Export old data backup before switching domain traffic.',
];

export function DeveloperWorkspacePage() {
  const { data: orders = [] } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const { data: branches = [] } = useQuery({ queryKey: ['test-branches'], queryFn: getTestBranches });
  const { data: parts = [] } = useQuery({ queryKey: ['test-parts'], queryFn: getTestParts });
  const { data: approvers = [] } = useQuery({ queryKey: ['test-approvers'], queryFn: getTestApprovers });

  const recentOrders = orders.slice(0, 8);
  const checks = [
    ['Test Orders', orders.length],
    ['Active Branches', branches.length],
    ['Loaded Parts', parts.length],
    ['Approvers', approvers.length],
    ['Pending Orders', orders.filter((order) => order.status.includes('pending')).length],
    ['Approved Orders', orders.filter((order) => order.status === 'approved').length],
    ['Processed Orders', orders.filter((order) => order.status === 'processed').length],
    ['Issued Orders', orders.filter((order) => order.status === 'issued').length],
    ['Received Orders', orders.filter((order) => order.status === 'received').length],
  ];

  return (
    <PageCard eyebrow="Developer" title="Developer Workspace" description="Staging diagnostics, safety guardrails, and support overview.">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {checks.map(([label, value]) => (<div key={label} className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6D8196]">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>))}
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Recent Test Orders</p>
          <div className="overflow-hidden rounded-md border border-[#263244]"><table className="w-full min-w-[620px] border-collapse text-left text-xs"><thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Order</th><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#263244]">{recentOrders.map((order) => (<tr key={order.id}><td className="px-2.5 py-2 font-black text-white">{order.final_order_no || order.order_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.branch}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{order.status}</td><td className="px-2.5 py-2 text-right"><Link className="font-black text-[#82C8E5] hover:underline" to={`/orders/${order.id}`}>Open</Link></td></tr>))}</tbody></table>{recentOrders.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No test orders yet.</p> : null}</div>
        </div>

        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Quick Navigation</p>
          <div className="grid gap-2 text-xs sm:grid-cols-2">
            <Link className="rounded-md border border-[#263244] px-2.5 py-2 font-black text-[#82C8E5] hover:underline" to="/orders/new">New Order</Link>
            <Link className="rounded-md border border-[#263244] px-2.5 py-2 font-black text-[#82C8E5] hover:underline" to="/orders/track">Track Orders</Link>
            <Link className="rounded-md border border-[#263244] px-2.5 py-2 font-black text-[#82C8E5] hover:underline" to="/approvals/pending">Approvals</Link>
            <Link className="rounded-md border border-[#263244] px-2.5 py-2 font-black text-[#82C8E5] hover:underline" to="/admin/approved">Admin</Link>
            <Link className="rounded-md border border-[#263244] px-2.5 py-2 font-black text-[#82C8E5] hover:underline" to="/inventory/upload">Inventory</Link>
            <Link className="rounded-md border border-[#263244] px-2.5 py-2 font-black text-[#82C8E5] hover:underline" to="/docket-scanner">Docket</Link>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Production Cutover Checklist</p>
        <div className="grid gap-2 text-xs text-[#d8e3ee] md:grid-cols-2">
          {cutoverChecks.map((check) => <p key={check}>✓ {check}</p>)}
        </div>
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
