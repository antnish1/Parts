import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/useAuth';
import { createTestOrder } from '../../services/testData.service';
import { getTestParts } from '../../services/testPart.service';
import { getTestBranches } from '../../services/testBranch.service';
import { getTestApprovers } from '../../services/testProfile.service';
import { getTestLast30QtyByBranchPart } from '../../services/testPartUsage.service';
import { getTestMachineByNo, normalizeMachineNo } from '../../services/testMachine.service';
import { parseBulkPartsFile } from '../../services/bulkParts.service';
import { normalizePartNo } from '../../lib/orderLogic';
import { OrderPlacedSummary } from './OrderPlacedSummary';

const inputClass = 'mt-2 h-12 w-full rounded-xl border border-[#263244] bg-[#0b1020] px-4 text-sm font-semibold text-white outline-none transition placeholder:text-[#6D8196] focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/25 disabled:cursor-not-allowed disabled:opacity-55';
const tableInputClass = 'h-11 w-full rounded-xl border border-[#263244] bg-[#0b1020] px-3 text-sm font-semibold text-white outline-none transition focus:border-[#38bdf8] focus:ring-2 focus:ring-[#38bdf8]/25 disabled:cursor-not-allowed disabled:opacity-55';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.12em] text-[#c7d2df]';
const sectionTitleClass = 'mb-4 text-xs font-black uppercase tracking-[0.16em] text-[#fff176]';

type ItemLine = { lineId: number; partNo: string; description: string; dnp: string; qty: string; previous30dQty: number };
type OrderSummary = { orderNo: string; branch: string; orderType: string; orderFor: string; customerName: string; approverName: string; totalItems: number; totalValue: number };
type BranchOption = { id: string; branch_name: string; branch_code: string };
const defaultItem: ItemLine = { lineId: 1, partNo: '', description: '', dnp: '', qty: '', previous30dQty: 0 };
const fallbackBranches: BranchOption[] = [{ branch_name: 'Jabalpur BHL', branch_code: 'JBP_BHL', id: 'fallback' }];

function normalizeBranchKey(value: string | null | undefined) {
  return (value || '').trim().replace(/[\s_-]+/g, '').toUpperCase();
}

function resolveBranchName(branches: BranchOption[], value: string | null | undefined) {
  const key = normalizeBranchKey(value);
  if (!key) return '';
  const match = branches.find((branch) => normalizeBranchKey(branch.branch_name) === key || normalizeBranchKey(branch.branch_code) === key);
  return match?.branch_name ?? value?.trim() ?? '';
}

export function NewOrderPage() {
  const queryClient = useQueryClient();
  const { profile, role } = useAuth();
  const { data: parts = [] } = useQuery({ queryKey: ['test-parts'], queryFn: getTestParts });
  const { data: branches = [] } = useQuery({ queryKey: ['test-branches'], queryFn: getTestBranches });
  const { data: approvers = [] } = useQuery({ queryKey: ['test-approvers'], queryFn: getTestApprovers });
  const [message, setMessage] = useState('');
  const [machineStatus, setMachineStatus] = useState('');
  const [bulkHasHeader] = useState(true);
  const [orderSummary, setOrderSummary] = useState<OrderSummary | null>(null);
  const [form, setForm] = useState({ branch: 'Jabalpur BHL', orderType: '', orderFor: '', approverId: '', machineNo: '', customerName: '', callId: '', warrantyStatus: '' });
  const [items, setItems] = useState<ItemLine[]>([defaultItem]);

  const branchOptions = useMemo(() => {
    const list = (branches.length ? branches : fallbackBranches) as BranchOption[];
    if (role !== 'branch' || !profile?.branch) return list;
    const profileBranchName = resolveBranchName(list, profile.branch);
    if (!profileBranchName) return list;
    const exists = list.some((branch) => normalizeBranchKey(branch.branch_name) === normalizeBranchKey(profileBranchName));
    return exists ? list : [{ id: 'profile-branch', branch_name: profileBranchName, branch_code: profileBranchName }, ...list];
  }, [branches, profile?.branch, role]);

  const totalValue = useMemo(() => items.reduce((sum, item) => sum + Number(item.dnp || 0) * Number(item.qty || 0), 0), [items]);

  useEffect(() => {
    if (role !== 'branch' || !profile?.branch) return;
    const nextBranch = resolveBranchName(branchOptions, profile.branch);
    if (!nextBranch) return;
    setForm((current) => (current.branch === nextBranch ? current : { ...current, branch: nextBranch }));
  }, [branchOptions, profile?.branch, role]);

  const mutation = useMutation({
    mutationFn: createTestOrder,
    onSuccess: (order) => {
      const approver = approvers.find((item) => item.id === form.approverId);
      setOrderSummary({ orderNo: order.order_no, branch: form.branch, orderType: form.orderType, orderFor: form.orderFor, customerName: form.customerName, approverName: approver?.full_name ?? '', totalItems: items.length, totalValue });
      setMessage('Order created successfully.');
      queryClient.invalidateQueries({ queryKey: ['test-orders'] });
      queryClient.invalidateQueries({ queryKey: ['test-dashboard-summary'] });
      queryClient.invalidateQueries({ queryKey: ['order-list-paged'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Order creation failed. Check write policies.'),
  });

  function updateField(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function updateItem(lineId: number, field: keyof ItemLine, value: string | number) { setItems((current) => current.map((item) => (item.lineId === lineId ? { ...item, [field]: value } : item))); }
  function findPart(partNo: string) { const normalized = normalizePartNo(partNo); return parts.find((part) => normalizePartNo(part.part_no) === normalized); }
  function partCategory(partNo: string) { const part = findPart(partNo); return part?.cat1 || part?.cat2 || '-'; }

  async function lookupMachine() {
    const normalized = normalizeMachineNo(form.machineNo);
    if (!normalized || form.orderFor === 'Stock') return;
    setMachineStatus('Checking machine...');
    try {
      const machine = await getTestMachineByNo(normalized);
      updateField('machineNo', normalized);
      if (machine) {
        updateField('customerName', machine.customer_name);
        setMachineStatus(`Customer found: ${machine.customer_name}`);
      } else setMachineStatus('Machine not found. Enter customer name manually.');
    } catch (error) {
      setMachineStatus(error instanceof Error ? error.message : 'Machine lookup failed.');
    }
  }

  async function refreshPreviousQty(lineId: number, partNo: string, branch = form.branch) {
    const normalized = normalizePartNo(partNo);
    if (!normalized || !branch) return;
    try { updateItem(lineId, 'previous30dQty', await getTestLast30QtyByBranchPart(branch, normalized, 30)); }
    catch (error) { console.warn('Previous quantity lookup failed', error); }
  }

  function handlePartChange(lineId: number, value: string) {
    const normalized = normalizePartNo(value);
    const part = findPart(normalized);
    setItems((current) => current.map((item) => (item.lineId === lineId ? {
      ...item,
      partNo: normalized,
      description: part?.description ?? item.description,
      dnp: part?.dnp != null ? String(part.dnp) : item.dnp,
    } : item)));
    if (part) void refreshPreviousQty(lineId, normalized);
  }

  async function handleBulkUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const result = await parseBulkPartsFile(file, bulkHasHeader, parts);
      const nextItems: ItemLine[] = result.rows.map((row, index) => ({ lineId: Date.now() + index, partNo: row.partNo, description: row.description, dnp: row.dnp, qty: String(row.qty), previous30dQty: 0 }));
      if (!nextItems.length) return setMessage(`No valid item rows found. Detected part column ${result.detectedPartColumn}, quantity column ${result.detectedQtyColumn}, source rows ${result.totalSourceRows}, invalid rows ${result.failed}. Expected Material No and Billed Qty columns.`);
      setItems(nextItems);
      nextItems.forEach((item) => void refreshPreviousQty(item.lineId, item.partNo));
      const unknownNote = result.unknown ? ` Unknown in part master: ${result.unknown}. Review description/DNP before creating order.` : '';
      setMessage(`Bulk upload complete. Added: ${result.success}, failed: ${result.failed}, merged duplicates: ${Math.max(0, result.merged)}. Detected part column ${result.detectedPartColumn}, qty column ${result.detectedQtyColumn}.${unknownNote}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bulk upload failed.');
    }
  }

  function addItem() { setItems((current) => [...current, { ...defaultItem, lineId: Date.now() }]); }
  function removeItem(lineId: number) { setItems((current) => (current.length === 1 ? current : current.filter((item) => item.lineId !== lineId))); }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setOrderSummary(null);
    const parsedItems = items.map((item) => ({ partNo: normalizePartNo(item.partNo), description: item.description.trim(), dnp: Number(item.dnp), qty: Number(item.qty), previous30dQty: item.previous30dQty || 0 }));
    const duplicatePart = parsedItems.find((item, index) => parsedItems.findIndex((candidate) => candidate.partNo === item.partNo) !== index);
    const invalidItem = parsedItems.find((item) => !item.partNo || !item.description || !Number.isFinite(item.dnp) || !Number.isFinite(item.qty) || item.dnp < 0 || item.qty <= 0 || !Number.isInteger(item.qty));
    if (!form.branch || !form.orderType || !form.orderFor) return setMessage('Please fill Order Type and Order For.');
    if (!form.approverId) return setMessage('Please select approver.');
    if (form.orderType === 'VOR' && form.orderFor !== 'Customer') return setMessage('VOR order must be for Customer.');
    if (form.orderFor === 'Customer' && (!form.machineNo || !form.customerName || !form.warrantyStatus)) return setMessage('Customer order requires machine number, customer name, and machine type.');
    if (duplicatePart) return setMessage(`Duplicate item not allowed: ${duplicatePart.partNo}`);
    if (invalidItem) return setMessage('Each item must have valid Part, Qty, Description, and DNP. Qty must be a whole number above zero.');
    mutation.mutate({ branch: form.branch, orderType: form.orderType, orderFor: form.orderFor, approverId: form.approverId, machineNo: form.orderFor === 'Stock' ? '' : normalizeMachineNo(form.machineNo), customerName: form.orderFor === 'Stock' ? '' : form.customerName, callId: form.callId, warrantyStatus: form.orderFor === 'Stock' ? 'NA' : form.warrantyStatus, items: parsedItems });
  }

  return (
    <PageCard eyebrow="Orders" title="New Order" description="Create branch order.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-[#334155] bg-[#0b1020] p-5">
            <p className={sectionTitleClass}>Order Setup</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className={labelClass}>Order Type</label><select className={inputClass} value={form.orderType} onChange={(e) => { const value = e.target.value; updateField('orderType', value); if (value === 'VOR') updateField('orderFor', 'Customer'); }}><option value="">Select Order Type</option><option>VOR</option><option>SOP</option><option>ZSPL</option><option>ZMAC</option><option>LUBES</option></select></div>
              <div><label className={labelClass}>Order For</label><select className={inputClass} value={form.orderFor} disabled={form.orderType === 'VOR'} onChange={(e) => updateField('orderFor', e.target.value)}><option value="">Select Order For</option><option>Customer</option><option>Stock</option></select></div>
              <div><label className={labelClass}>Employee Name</label><input className={inputClass} value={profile?.fullName ?? ''} placeholder="Employee Name" readOnly /></div>
              <div><label className={labelClass}>Approved By</label><select className={inputClass} value={form.approverId} onChange={(e) => updateField('approverId', e.target.value)}><option value="">Select Approver</option>{approvers.map((approver) => <option key={approver.id} value={approver.id}>{approver.full_name} ({approver.role})</option>)}</select></div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#334155] bg-[#0b1020] p-5">
            <p className={sectionTitleClass}>Customer Details</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className={labelClass}>Machine Number</label><input className={inputClass} value={form.machineNo} placeholder="Enter Machine No" onBlur={() => void lookupMachine()} onChange={(e) => { updateField('machineNo', e.target.value); setMachineStatus(''); }} disabled={form.orderFor === 'Stock'} /></div>
              <div><label className={labelClass}>Customer Name</label><input className={inputClass} value={form.customerName} placeholder="Auto-fetched Customer Name" onChange={(e) => updateField('customerName', e.target.value)} disabled={form.orderFor === 'Stock'} /></div>
              <div><label className={labelClass}>Machine Type</label><select className={inputClass} value={form.warrantyStatus} onChange={(e) => updateField('warrantyStatus', e.target.value)} disabled={form.orderFor === 'Stock'}><option value="">Select Machine Type</option><option>Backhoe Loader</option><option>Excavator</option><option>Wheel Loader</option><option>Telehandler</option><option>Compactor</option><option>NA</option></select></div>
              <div><label className={labelClass}>Call ID</label><input className={inputClass} value={form.callId} placeholder="Enter Call ID" onChange={(e) => updateField('callId', e.target.value)} /></div>
            </div>
            {machineStatus ? <p className="mt-3 text-xs text-[#c7d2df]">{machineStatus}</p> : null}
          </section>
        </div>

        <section className="rounded-2xl border border-[#6b5b15] bg-[#0b1020] p-5">
          <p className={sectionTitleClass}>Parts Builder</p>
          <div className="overflow-hidden rounded-2xl border border-[#334155] bg-[#111827]">
            <table className="w-full min-w-[1120px] border-collapse text-sm">
              <thead className="bg-[#17202d] text-xs uppercase tracking-[0.08em] text-white">
                <tr>
                  <th className="px-3 py-3 text-left">Part</th>
                  <th className="px-3 py-3 text-left">Qty</th>
                  <th className="px-3 py-3 text-center">30D Qty</th>
                  <th className="px-3 py-3 text-left">Description</th>
                  <th className="px-3 py-3 text-left">DNP</th>
                  <th className="px-3 py-3 text-left">Category</th>
                  <th className="px-3 py-3 text-left">Value</th>
                  <th className="px-3 py-3 text-center"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263244]">
                {items.map((item) => {
                  const lineValue = Number(item.dnp || 0) * Number(item.qty || 0);
                  return (
                    <tr key={item.lineId}>
                      <td className="px-3 py-2"><input list="parts-master-list" className={tableInputClass} value={item.partNo} onBlur={() => void refreshPreviousQty(item.lineId, item.partNo)} onChange={(e) => handlePartChange(item.lineId, e.target.value)} /></td>
                      <td className="px-3 py-2"><input className={tableInputClass} value={item.qty} onChange={(e) => updateItem(item.lineId, 'qty', e.target.value)} /></td>
                      <td className="px-3 py-2 text-center font-black text-white">{item.previous30dQty}</td>
                      <td className="px-3 py-2"><input className={tableInputClass} value={item.description} onChange={(e) => updateItem(item.lineId, 'description', e.target.value)} /></td>
                      <td className="px-3 py-2"><input className={tableInputClass} value={item.dnp} onChange={(e) => updateItem(item.lineId, 'dnp', e.target.value)} /></td>
                      <td className="px-3 py-2 text-[#d8e3ee]">{partCategory(item.partNo)}</td>
                      <td className="px-3 py-2 font-black text-white">₹{lineValue.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center"><button type="button" className="text-xl font-black text-[#ff5c5c]" onClick={() => removeItem(item.lineId)}>×</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <datalist id="parts-master-list">{parts.map((part) => <option key={part.part_no} value={part.part_no}>{part.description ?? ''}</option>)}</datalist>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[#6b5b15] bg-[#111827] p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Button type="button" className="rounded-xl bg-[#ffd94a] px-4 py-2 text-sm text-[#0b1020] hover:bg-[#ffe177]" onClick={addItem}>⊕ Add Item</Button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#6b5b15] bg-[#17202d] px-4 py-2 text-sm font-black text-[#ffe177] hover:border-[#ffd94a]">⇧ Bulk Parts Upload<input className="hidden" type="file" accept=".xlsx,.xls" onChange={handleBulkUpload} /></label>
            </div>
            <p className="text-lg font-black text-white">Total: ₹ <span className="text-2xl text-[#ffd400]">{totalValue.toFixed(2)}</span></p>
            <Button type="submit" disabled={mutation.isPending} className="rounded-xl bg-[#e6a400] px-5 py-2.5 text-sm text-[#0b1020] shadow-lg shadow-[#e6a400]/20 hover:bg-[#ffbd00]">{mutation.isPending ? 'Creating...' : '⌁ Submit Order'}</Button>
          </div>
        </section>
      </form>
      {orderSummary ? <OrderPlacedSummary {...orderSummary} onClose={() => setOrderSummary(null)} /> : null}
      {message ? <p className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3 text-xs text-[#d8e3ee]">{message}</p> : null}
    </PageCard>
  );
}
