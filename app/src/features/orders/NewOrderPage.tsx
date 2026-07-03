import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { createTestOrder } from '../../services/testData.service';
import { getTestParts } from '../../services/testPart.service';
import { getTestBranches } from '../../services/testBranch.service';
import { getTestApprovers } from '../../services/testProfile.service';
import { getTestLast30QtyByBranchPart } from '../../services/testPartUsage.service';
import { getTestMachineByNo, normalizeMachineNo, saveTestMachineCustomer } from '../../services/testMachine.service';
import { normalizePartNo } from '../../lib/orderLogic';

const inputClass = 'mt-2 w-full rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5] disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'text-[10px] font-black uppercase tracking-[0.12em] text-[#6D8196]';

type ItemLine = { lineId: number; partNo: string; description: string; dnp: string; qty: string; previous30dQty: number };
const defaultItem: ItemLine = { lineId: 1, partNo: '400/35820', description: 'FILTER ELEMENT', dnp: '182', qty: '1', previous30dQty: 0 };

export function NewOrderPage() {
  const queryClient = useQueryClient();
  const { data: parts = [] } = useQuery({ queryKey: ['test-parts'], queryFn: getTestParts });
  const { data: branches = [] } = useQuery({ queryKey: ['test-branches'], queryFn: getTestBranches });
  const { data: approvers = [] } = useQuery({ queryKey: ['test-approvers'], queryFn: getTestApprovers });
  const [message, setMessage] = useState('');
  const [machineStatus, setMachineStatus] = useState('');
  const [form, setForm] = useState({ branch: 'Jabalpur BHL', orderType: 'VOR', orderFor: 'Customer', approverId: '', machineNo: 'JCB3DX-TEST', customerName: 'Demo Customer', callId: 'CALL-TEST', warrantyStatus: 'UW' });
  const [items, setItems] = useState<ItemLine[]>([defaultItem]);
  const totalValue = useMemo(() => items.reduce((sum, item) => sum + Number(item.dnp || 0) * Number(item.qty || 0), 0), [items]);

  const mutation = useMutation({
    mutationFn: createTestOrder,
    onSuccess: (order) => {
      setMessage(`Created ${order.order_no} with ${items.length} item row(s).`);
      queryClient.invalidateQueries({ queryKey: ['test-orders'] });
      queryClient.invalidateQueries({ queryKey: ['test-dashboard-summary'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Order creation failed. Check write policies.'),
  });

  function updateField(field: keyof typeof form, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  function updateItem(lineId: number, field: keyof ItemLine, value: string | number) { setItems((current) => current.map((item) => (item.lineId === lineId ? { ...item, [field]: value } : item))); }

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
      } else {
        setMachineStatus('Machine not found. Enter customer name and save.');
      }
    } catch (error) {
      setMachineStatus(error instanceof Error ? error.message : 'Machine lookup failed.');
    }
  }

  async function saveMachine() {
    if (!form.machineNo || !form.customerName) return setMachineStatus('Machine number and customer name are required.');
    try {
      const saved = await saveTestMachineCustomer(form.machineNo, form.customerName);
      updateField('machineNo', saved.machine_no);
      setMachineStatus('Machine customer saved.');
    } catch (error) {
      setMachineStatus(error instanceof Error ? error.message : 'Machine save failed. Check insert policy.');
    }
  }

  async function refreshPreviousQty(lineId: number, partNo: string, branch = form.branch) {
    const normalized = normalizePartNo(partNo);
    if (!normalized || !branch) return;
    try { updateItem(lineId, 'previous30dQty', await getTestLast30QtyByBranchPart(branch, normalized, 30)); }
    catch (error) { console.warn('Previous quantity lookup failed', error); }
  }

  function selectPart(lineId: number, partNo: string) {
    const part = parts.find((item) => item.part_no === partNo);
    setItems((current) => current.map((item) => (item.lineId === lineId ? { ...item, partNo, description: part?.description ?? item.description, dnp: part?.dnp != null ? String(part.dnp) : item.dnp } : item)));
    void refreshPreviousQty(lineId, partNo);
  }

  function addItem() { const next = { ...defaultItem, lineId: Date.now(), previous30dQty: 0 }; setItems((current) => [...current, next]); void refreshPreviousQty(next.lineId, next.partNo); }
  function removeItem(lineId: number) { setItems((current) => (current.length === 1 ? current : current.filter((item) => item.lineId !== lineId))); }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setMessage('');
    const parsedItems = items.map((item) => ({ partNo: normalizePartNo(item.partNo), description: item.description.trim(), dnp: Number(item.dnp), qty: Number(item.qty), previous30dQty: item.previous30dQty || 0 }));
    const duplicatePart = parsedItems.find((item, index) => parsedItems.findIndex((candidate) => candidate.partNo === item.partNo) !== index);
    const invalidItem = parsedItems.find((item) => !item.partNo || !item.description || !Number.isFinite(item.dnp) || !Number.isFinite(item.qty) || item.dnp < 0 || item.qty <= 0 || !Number.isInteger(item.qty));

    if (!form.branch || !form.orderType || !form.orderFor) return setMessage('Please fill all mandatory order fields.');
    if (!form.approverId) return setMessage('Please select approver.');
    if (form.orderType === 'VOR' && (!form.machineNo || !form.customerName || !form.warrantyStatus || form.orderFor !== 'Customer')) return setMessage('VOR order requires customer, machine, machine type, and approver.');
    if (['SOP', 'ZSPL', 'ZMAC'].includes(form.orderType) && !form.orderFor) return setMessage('Order For is required.');
    if (form.orderFor === 'Customer' && (!form.machineNo || !form.customerName || !form.warrantyStatus)) return setMessage('Customer order requires machine, customer, and machine type.');
    if (duplicatePart) return setMessage(`Duplicate item not allowed: ${duplicatePart.partNo}`);
    if (invalidItem) return setMessage('Each item must have valid Part No, Description, DNP zero or above, and whole Qty greater than zero.');

    mutation.mutate({ branch: form.branch, orderType: form.orderType, orderFor: form.orderFor, approverId: form.approverId, machineNo: form.orderFor === 'Stock' ? '' : normalizeMachineNo(form.machineNo), customerName: form.orderFor === 'Stock' ? '' : form.customerName, callId: form.callId, warrantyStatus: form.orderFor === 'Stock' ? 'NA' : form.warrantyStatus, items: parsedItems });
  }

  return (
    <PageCard eyebrow="Orders" title="New Order" description="Create multi-item branch order.">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 lg:grid-cols-4">
          <div><label className={labelClass}>Branch</label><select className={inputClass} value={form.branch} onChange={(e) => { updateField('branch', e.target.value); items.forEach((item) => void refreshPreviousQty(item.lineId, item.partNo, e.target.value)); }}>{(branches.length ? branches : [{ branch_name: 'Jabalpur BHL', branch_code: 'JBP_BHL', id: 'fallback' }]).map((branch) => (<option key={branch.id} value={branch.branch_name}>{branch.branch_name}</option>))}</select></div>
          <div><label className={labelClass}>Order Type</label><select className={inputClass} value={form.orderType} onChange={(e) => { const value = e.target.value; updateField('orderType', value); if (value === 'VOR') updateField('orderFor', 'Customer'); }}><option>VOR</option><option>SOP</option><option>ZSPL</option><option>ZMAC</option><option>LUBES</option></select></div>
          <div><label className={labelClass}>Order For</label><select className={inputClass} value={form.orderFor} disabled={form.orderType === 'VOR'} onChange={(e) => updateField('orderFor', e.target.value)}><option>Customer</option><option>Stock</option></select></div>
          <div><label className={labelClass}>Approved By</label><select className={inputClass} value={form.approverId} onChange={(e) => updateField('approverId', e.target.value)}><option value="">Select Approver</option>{approvers.map((approver) => <option key={approver.id} value={approver.id}>{approver.full_name} ({approver.role})</option>)}</select></div>
          <div><label className={labelClass}>Machine Type</label><select className={inputClass} value={form.warrantyStatus} onChange={(e) => updateField('warrantyStatus', e.target.value)} disabled={form.orderFor === 'Stock'}><option>UW</option><option>BW</option><option>NA</option></select></div>
          <div><label className={labelClass}>Machine No</label><input className={inputClass} value={form.machineNo} onBlur={() => void lookupMachine()} onChange={(e) => { updateField('machineNo', e.target.value); setMachineStatus(''); }} disabled={form.orderFor === 'Stock'} /></div>
          <div><label className={labelClass}>Customer Name</label><input className={inputClass} value={form.customerName} onChange={(e) => updateField('customerName', e.target.value)} disabled={form.orderFor === 'Stock'} /></div>
          <div className="flex items-end gap-2"><button type="button" className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => void lookupMachine()} disabled={form.orderFor === 'Stock'}>Lookup</button><button type="button" className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => void saveMachine()} disabled={form.orderFor === 'Stock'}>Save</button></div>
          <div><label className={labelClass}>Call ID</label><input className={inputClass} value={form.callId} onChange={(e) => updateField('callId', e.target.value)} /></div>
          <div className="rounded-md border border-[#263244] bg-[#0b1020] px-2.5 py-2 lg:col-span-3"><p className={labelClass}>Order Value</p><p className="mt-1 text-lg font-black text-white">₹{totalValue.toFixed(2)}</p>{machineStatus ? <p className="mt-1 text-xs text-[#c7d2df]">{machineStatus}</p> : null}</div>
        </div>

        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <div className="mb-2 flex items-center justify-between"><p className="text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Item Lines</p><Button type="button" className="rounded-md px-3 py-1.5 text-xs" onClick={addItem}>Add Item</Button></div>
          <div className="space-y-2">{items.map((item, index) => (<div key={item.lineId} className="grid gap-2 rounded-md border border-[#263244] p-2 lg:grid-cols-8"><div><label className={labelClass}>Lookup</label><select className={inputClass} value={item.partNo} onChange={(e) => selectPart(item.lineId, e.target.value)}>{parts.map((part) => <option key={part.part_no} value={part.part_no}>{part.part_no}</option>)}</select></div><div><label className={labelClass}>Part No</label><input className={inputClass} value={item.partNo} onBlur={() => void refreshPreviousQty(item.lineId, item.partNo)} onChange={(e) => updateItem(item.lineId, 'partNo', e.target.value)} /></div><div className="lg:col-span-2"><label className={labelClass}>Description</label><input className={inputClass} value={item.description} onChange={(e) => updateItem(item.lineId, 'description', e.target.value)} /></div><div><label className={labelClass}>30D Qty</label><input className={inputClass} value={item.previous30dQty} readOnly /></div><div><label className={labelClass}>DNP</label><input className={inputClass} value={item.dnp} onChange={(e) => updateItem(item.lineId, 'dnp', e.target.value)} /></div><div><label className={labelClass}>Qty</label><input className={inputClass} value={item.qty} onChange={(e) => updateItem(item.lineId, 'qty', e.target.value)} /></div><div className="flex items-end justify-end"><Button type="button" variant="danger" className="rounded-md px-3 py-1.5 text-xs" onClick={() => removeItem(item.lineId)}>Remove</Button></div><div className="lg:col-span-8 text-xs text-[#c7d2df]">Line {index + 1}: ₹{(Number(item.dnp || 0) * Number(item.qty || 0)).toFixed(2)} • Previous 30D branch qty: {item.previous30dQty}</div></div>))}</div>
        </div>

        <Button type="submit" disabled={mutation.isPending} className="w-full rounded-md py-2 text-xs">{mutation.isPending ? 'Creating...' : 'Create Order'}</Button>
      </form>
      {message ? <p className="mt-3 rounded-lg border border-[#263244] bg-[#0b1020] p-3 text-xs text-[#d8e3ee]">{message}</p> : null}
    </PageCard>
  );
}
