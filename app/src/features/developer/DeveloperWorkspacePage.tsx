import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getOrderList } from '../../services/orderList.service';
import { getTestBranches } from '../../services/testBranch.service';
import { getTestParts } from '../../services/testPart.service';
import { createPortalUser, getTestApprovers, getTestProfiles, setTestProfileActive, updateTestProfile } from '../../services/testProfile.service';
import { getDeveloperCommentsInbox } from '../../services/developerComments.service';

const roles = ['branch', 'admin', 'super', 'manager', 'viewer', 'developer'];

export function DeveloperWorkspacePage() {
  const [fullName, setFullName] = useState('');
  const [branch, setBranch] = useState('');
  const [role, setRole] = useState('branch');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginId, setLoginId] = useState('');
  const [message, setMessage] = useState('');
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editRole, setEditRole] = useState('branch');
  const [editLoginId, setEditLoginId] = useState('');
  const { data: orders = [] } = useQuery({ queryKey: ['order-list-paged', 'developer-workspace'], queryFn: getOrderList });
  const { data: branches = [] } = useQuery({ queryKey: ['test-branches'], queryFn: getTestBranches });
  const { data: parts = [] } = useQuery({ queryKey: ['test-parts'], queryFn: getTestParts });
  const { data: approvers = [] } = useQuery({ queryKey: ['test-approvers'], queryFn: getTestApprovers });
  const { data: profiles = [], refetch } = useQuery({ queryKey: ['test-profiles'], queryFn: getTestProfiles });
  const { data: comments = [], isLoading: commentsLoading } = useQuery({ queryKey: ['developer-comments-inbox'], queryFn: getDeveloperCommentsInbox });

  async function addUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('Creating Supabase Auth user...');
    try {
      await createPortalUser({ email, password, fullName, branch, role, loginId });
      setFullName('');
      setBranch('');
      setRole('branch');
      setEmail('');
      setPassword('');
      setLoginId('');
      setMessage('Supabase Auth user and portal profile created.');
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to create user.');
    }
  }

  function startEdit(profile: (typeof profiles)[number]) {
    setEditId(profile.id);
    setEditName(profile.full_name);
    setEditBranch(profile.branch);
    setEditRole(profile.role);
    setEditLoginId(profile.login_id ?? '');
    setMessage(`Editing ${profile.full_name}`);
  }

  async function saveEdit(profile: (typeof profiles)[number]) {
    setMessage('Saving profile...');
    try {
      await updateTestProfile(profile.id, { fullName: editName, branch: editBranch, role: editRole, loginId: editLoginId, isActive: profile.is_active });
      setEditId('');
      setMessage('Profile updated.');
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Profile update failed.');
    }
  }

  async function toggleActive(profile: (typeof profiles)[number]) {
    setMessage(profile.is_active ? 'Deactivating profile...' : 'Activating profile...');
    try {
      await setTestProfileActive(profile.id, !profile.is_active);
      setMessage(profile.is_active ? 'Profile deactivated.' : 'Profile activated.');
      await refetch();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Profile status update failed.');
    }
  }

  const checks = [
    ['Test Orders', orders.length], ['Active Branches', branches.length], ['Loaded Parts', parts.length], ['Approvers', approvers.length], ['User Profiles', profiles.length], ['Comments', comments.length], ['Pending Orders', orders.filter((order) => order.status.includes('pending')).length], ['Processed Orders', orders.filter((order) => order.status === 'processed').length],
  ];

  return (
    <PageCard eyebrow="Developer" title="Developer Workspace" description="Staging diagnostics and Supabase user setup.">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {checks.map(([label, value]) => (<div key={label} className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#6D8196]">{label}</p><p className="mt-1 text-lg font-black text-white">{value}</p></div>))}
      </div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Create Supabase User</p>
        <form onSubmit={addUser} className="grid gap-2 lg:grid-cols-[0.8fr_1fr_1fr_1fr_1fr_150px_auto]">
          <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="User ID e.g. DAMOH01" value={loginId} onChange={(event) => setLoginId(event.target.value.toUpperCase())} />
          <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Email optional if User ID used" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input type="password" className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Full name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" placeholder="Branch" value={branch} onChange={(event) => setBranch(event.target.value)} />
          <select className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={role} onChange={(event) => setRole(event.target.value)}>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <button type="submit" className="text-xs font-black text-[#82C8E5] hover:underline">Create</button>
        </form>
        <p className="mt-2 text-xs text-[#c7d2df]">{message || 'When User ID is filled, login uses an internal auth alias like damoh01@portal.local. Staff only enters DAMOH01 and password.'}</p>
      </div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Recent User Profiles</p>
        <div className="overflow-hidden rounded-md border border-[#263244]"><table className="w-full min-w-[960px] border-collapse text-left text-xs"><thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">User ID</th><th className="px-2.5 py-2">Name</th><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Role</th><th className="px-2.5 py-2">Active</th><th className="px-2.5 py-2 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#263244]">{profiles.slice(0, 12).map((profile) => { const editing = editId === profile.id; return (<tr key={profile.id}><td className="px-2.5 py-2 font-black text-white">{editing ? <input className="w-full rounded-md border border-[#263244] bg-[#111827] px-2 py-1 text-xs text-white" value={editLoginId} onChange={(event) => setEditLoginId(event.target.value.toUpperCase())} /> : profile.login_id || '-'}</td><td className="px-2.5 py-2 font-black text-white">{editing ? <input className="w-full rounded-md border border-[#263244] bg-[#111827] px-2 py-1 text-xs text-white" value={editName} onChange={(event) => setEditName(event.target.value)} /> : profile.full_name}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{editing ? <input className="w-full rounded-md border border-[#263244] bg-[#111827] px-2 py-1 text-xs text-white" value={editBranch} onChange={(event) => setEditBranch(event.target.value)} /> : profile.branch}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{editing ? <select className="w-full rounded-md border border-[#263244] bg-[#111827] px-2 py-1 text-xs text-white" value={editRole} onChange={(event) => setEditRole(event.target.value)}>{roles.map((item) => <option key={item} value={item}>{item}</option>)}</select> : profile.role}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{profile.is_active ? 'Yes' : 'No'}</td><td className="px-2.5 py-2 text-right"><div className="flex justify-end gap-3">{editing ? <button className="font-black text-[#82C8E5] hover:underline" onClick={() => void saveEdit(profile)}>Save</button> : <button className="font-black text-[#82C8E5] hover:underline" onClick={() => startEdit(profile)}>Edit</button>}{editing ? <button className="font-black text-[#c7d2df] hover:underline" onClick={() => setEditId('')}>Cancel</button> : <button className="font-black text-[#ef6f7b] hover:underline" onClick={() => void toggleActive(profile)}>{profile.is_active ? 'Deactivate' : 'Activate'}</button>}</div></td></tr>); })}</tbody></table>{profiles.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No profiles found.</p> : null}</div>
      </div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Comments Inbox</p>
        {commentsLoading ? <p className="text-xs text-[#c7d2df]">Loading comments...</p> : null}
        <div className="overflow-hidden rounded-md border border-[#263244]"><table className="w-full min-w-[900px] border-collapse text-left text-xs"><thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]"><tr><th className="px-2.5 py-2">Order</th><th className="px-2.5 py-2">Branch</th><th className="px-2.5 py-2">Status</th><th className="px-2.5 py-2">Comment</th><th className="px-2.5 py-2">By</th><th className="px-2.5 py-2 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#263244]">{comments.map((item) => (<tr key={item.id}><td className="px-2.5 py-2 font-black text-white">{item.final_order_no || item.order_no}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.branch}</td><td className="px-2.5 py-2"><StatusBadge status={item.status} /></td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.comment}</td><td className="px-2.5 py-2 text-[#d8e3ee]">{item.created_by || '-'} • {item.created_at.slice(0, 10)}</td><td className="px-2.5 py-2 text-right"><Link className="font-black text-[#82C8E5] hover:underline" to={`/orders/${item.order_id}`}>Open</Link></td></tr>))}</tbody></table>{comments.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No recent comments.</p> : null}</div>
      </div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3"><p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Quick Navigation</p><div className="grid gap-2 text-xs sm:grid-cols-3 xl:grid-cols-6"><Link className="font-black text-[#82C8E5] hover:underline" to="/orders/new">New Order</Link><Link className="font-black text-[#82C8E5] hover:underline" to="/orders/track">Track Orders</Link><Link className="font-black text-[#82C8E5] hover:underline" to="/approvals/pending">Approvals</Link><Link className="font-black text-[#82C8E5] hover:underline" to="/admin/approved">Admin</Link><Link className="font-black text-[#82C8E5] hover:underline" to="/inventory/upload">Inventory</Link><Link className="font-black text-[#82C8E5] hover:underline" to="/docket-scanner">Docket</Link></div></div>

      <div className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3"><p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Safety Guardrails</p><div className="grid gap-2 text-xs text-[#d8e3ee] md:grid-cols-2"><p>Service-role key stays only inside Supabase Edge Function.</p><p>Only active developer profile can create users.</p><p>Live tables remain untouched until cutover.</p><p>Auth is Supabase email/password, not legacy frontend password matching.</p></div></div>
    </PageCard>
  );
}
