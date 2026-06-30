import { FormEvent, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { createTestOrder } from '../../services/testData.service';
import { getTestParts } from '../../services/testPart.service';
import { getTestBranches } from '../../services/testBranch.service';

const inputClass = 'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-pc-gold';
const labelClass = 'text-xs font-black uppercase tracking-widest text-pc-muted';

export function NewOrderPage() {
  const queryClient = useQueryClient();
  const { data: parts = [] } = useQuery({ queryKey: ['test-parts'], queryFn: getTestParts });
  const { data: branches = [] } = useQuery({ queryKey: ['test-branches'], queryFn: getTestBranches });
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({
    branch: 'Jabalpur BHL',
    orderType: 'VOR',
    orderFor: 'Customer',
    machineNo: 'JCB3DX-TEST',
    customerName: 'Demo Customer',
    callId: 'CALL-TEST',
    warrantyStatus: 'Warranty',
    partNo: '400/35820',
    description: 'FILTER ELEMENT',
    dnp: '182',
    qty: '1',
  });

  const mutation = useMutation({
    mutationFn: createTestOrder,
    onSuccess: (order) => {
      setMessage(`Created ${order.order_no} in test_orders only.`);
      queryClient.invalidateQueries({ queryKey: ['test-orders'] });
      queryClient.invalidateQueries({ queryKey: ['test-dashboard-summary'] });
    },
    onError: (error) => {
      setMessage(error instanceof Error ? error.message : 'Order creation failed. Check test table write policies.');
    },
  });

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectPart(partNo: string) {
    const part = parts.find((item) => item.part_no === partNo);
    setForm((current) => ({
      ...current,
      partNo,
      description: part?.description ?? current.description,
      dnp: part?.dnp != null ? String(part.dnp) : current.dnp,
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const qty = Number(form.qty);
    const dnp = Number(form.dnp);

    if (!form.branch || !form.orderType || !form.orderFor || !form.partNo || !form.description) {
      setMessage('Please fill all mandatory fields.');
      return;
    }

    if (!Number.isFinite(qty) || qty <= 0) {
      setMessage('Qty must be greater than zero.');
      return;
    }

    if (!Number.isFinite(dnp) || dnp < 0) {
      setMessage('DNP must be zero or greater.');
      return;
    }

    mutation.mutate({
      branch: form.branch,
      orderType: form.orderType,
      orderFor: form.orderFor,
      machineNo: form.machineNo,
      customerName: form.customerName,
      callId: form.callId,
      warrantyStatus: form.warrantyStatus,
      partNo: form.partNo,
      description: form.description,
      dnp,
      qty,
    });
  }

  return (
    <PageCard eyebrow="Orders" title="New Order" description="This test form writes only to test_orders and test_order_items. It reads branches and parts only from test tables.">
      <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-2">
        <div>
          <label className={labelClass}>Branch</label>
          <select className={inputClass} value={form.branch} onChange={(e) => updateField('branch', e.target.value)}>
            {(branches.length ? branches : [{ branch_name: 'Jabalpur BHL', branch_code: 'JBP_BHL', id: 'fallback' }]).map((branch) => (
              <option key={branch.id} value={branch.branch_name}>{branch.branch_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Order Type</label>
          <select className={inputClass} value={form.orderType} onChange={(e) => updateField('orderType', e.target.value)}>
            <option>VOR</option>
            <option>SOP</option>
            <option>ZSPL</option>
            <option>ZMAC</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Order For</label>
          <select className={inputClass} value={form.orderFor} onChange={(e) => updateField('orderFor', e.target.value)}>
            <option>Customer</option>
            <option>Stock</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Warranty Status</label>
          <select className={inputClass} value={form.warrantyStatus} onChange={(e) => updateField('warrantyStatus', e.target.value)}>
            <option>Warranty</option>
            <option>Paid</option>
            <option>NA</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Machine No</label>
          <input className={inputClass} value={form.machineNo} onChange={(e) => updateField('machineNo', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Customer Name</label>
          <input className={inputClass} value={form.customerName} onChange={(e) => updateField('customerName', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Call ID</label>
          <input className={inputClass} value={form.callId} onChange={(e) => updateField('callId', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Part Lookup</label>
          <select className={inputClass} value={form.partNo} onChange={(e) => selectPart(e.target.value)}>
            {parts.map((part) => (
              <option key={part.part_no} value={part.part_no}>{part.part_no} - {part.description ?? 'No description'}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Part No</label>
          <input className={inputClass} value={form.partNo} onChange={(e) => updateField('partNo', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <input className={inputClass} value={form.description} onChange={(e) => updateField('description', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>DNP</label>
          <input className={inputClass} value={form.dnp} onChange={(e) => updateField('dnp', e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Qty</label>
          <input className={inputClass} value={form.qty} onChange={(e) => updateField('qty', e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? 'Creating...' : 'Create Test Order'}
          </Button>
        </div>
      </form>
      {message ? <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-pc-text">{message}</p> : null}
    </PageCard>
  );
}
