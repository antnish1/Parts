import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { getTestOrders } from '../../services/testData.service';
import { getTestBranches } from '../../services/testBranch.service';
import { getTestParts } from '../../services/testPart.service';
import { createTestProfile, getTestApprovers, getTestProfiles } from '../../services/testProfile.service';

const roles = ['branch', 'admin', 'super', 'manager', 'viewer', 'developer'];

export function DeveloperWorkspacePage() {
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('');
  const [role, setRole] = useState('branch');
  const [message, setMessage] = useState('');
  const { data: orders = [] } = useQuery({ queryKey: ['test-orders'], queryFn: getTestOrders });
  const { data: branches = [] } = useQuery({ queryKey: ['test-branches'], queryFn: getTestBranches });
  const { data: parts = [] } = useQuery({ queryKey: ['test-parts'], queryFn: getTestParts });
  const { data: approvers = [] } = useQuery({ queryKey: ['test-approvers'], queryFn: getTestApprovers });
  const { data: profiles = [], refetch } = useQuery({ queryKey: ['test-profiles'], queryFn: getTestProfiles });

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('Saving...');
    try {
      await createTestProfile({ fullName, branch, role });
      setFullName('');
      setBranch('');
      setRole('branch');
      setMessage('Profile added. Create matching Supabase Auth email/password user separately before login use.');
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to add profile.');
    }
  }

  const checks = [
    ['Test Orders', orders.length], ['Active Branches', branches.length], ['Loaded Parts', parts.length], ['Approvers', approvers.length], ['User Profiles', profiles.length], ['Pending Orders', orders.filter((order) => order.status.includes('pending')).length], ['Processed Orders', orders.filter((order) => order.status === 'processed').length],
  ];

  return (
    <PageCard eyebrow="Developer" title="Developer Workspace" description="Staging diagnostics and user profile setup.">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {checks.map(([label, value]) => (<div key={label} className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6D8196]">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>))}
      </div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Add New User Profile</p>
        <form onSubmit={addUser} className="grid gap-2 lg:grid-cols-[1fr_1fr_160px_auto]">
          <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Branch" value={branch} onChange={(event) => setBranch(event.target.value)} />
          <select className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={role} onChange={(event) => setRole(event.target.value)}>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <button type="submit" className="text-xs font-black text-[#82C8E5] hover:underline">Add User</button>
        </form>
        <p className="mt-2 text-xs text-[#c7d2df]">{message || 'Creates only the portal profile in test_profiles. Supabase Auth account must also exist for login.'}</p>
      </div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Recent User Profiles</p>
        <div className="overflow-hidden rounded-md border border-[#263244]"><table className="w-full min-w-[620px] border-collapse text-left text-xs"><thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Name</th><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Role</th><th className="px-2.5 py-2">Active</th></tr></thead><tbody className="divide-y divide-[#263244]">{profiles.slice(0, 12).map((profile) => (<tr key={profile.id}><td className="px-2.5 py-2 font-black text-white">{profile.full_name}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{profile.branch}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{profile.role}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{profile.is_active ? 'Yes' : 'No'}</td></tr>))}</tbody></table>{profiles.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No profiles found.</p> : null}</div>
      </div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3"><p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Quick Navigation</p><div className="grid gap-2 text-xs sm:grid-cols-3 xl:grid-cols-6"><Link className="font-black text-[#82C8E5] hover:underline" to="/orders/new">New Order</Link><Link className="font-black text-[#82C8E5] hover:underline" to="/orders/track">Track Orders</Link><Link className="font-black text-[#82C8E5] hover:underline" to="/approvals/pending">Approvals</Link><Link className="font-black text-[#82C8E5] hover:underline" to="/admin/approved">Admin</Link><Link className="font-black text-[#82C8E5] hover:underline" to="/inventory/upload">Inventory</Link><Link className="font-black text-[#82C8E5] hover:underline" to="/docket-scanner">Docket</Link></div></div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3"><p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Safety Guardrails</p><div className="grid gap-2 text-xs text-[#d8e3ee] md:grid-cols-2"><p>Only test_ tables are used in rebuild modules.</p><p>Live tables remain untouched until cutover.</p><p>Order numbers are restricted to TEST-* during staging.</p><p>Auth is Supabase email/password, not legacy frontend password matching.</p></div></div>
    </PageCard>
  );
}
