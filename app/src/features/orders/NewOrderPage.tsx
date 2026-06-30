import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageCard } from '../../components/ui/PageCard';
import { Button } from '../../components/ui/Button';
import { createTestOrder } from '../../services/testData.service';
import { getTestParts } from '../../services/testPart.service';
import { getTestBranches } from '../../services/testBranch.service';

const inputClass = 'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-pc-gold';
const labelClass = 'text-xs font-black uppercase tracking-widest text-pc-muted';

type ItemLine = {
  lineId: number;
  partNo: string;
  description: string;
  dnp: string;
  qty: string;
};

const defaultItem: ItemLine = { lineId: 1, partNo: '400/35820', description: 'FILTER ELEMENT', dnp: '182', qty: '1' };

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
  });
  const [items, setItems] = useState<ItemLine[]>([defaultItem]);

  const totalValue = useMemo(() => items.reduce((sum, item) => sum + Number(item.dnp || 0) * Number(item.qty || 0), 0), [items]);

  const mutation = useMutation({
    mutationFn: createTestOrder,
    onSuccess: (order) => {
      setMessage(`Created ${order.order_no} with ${items.length} item row(s) in test tables only.`);
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

  function updateItem(lineId: number, field: keyof ItemLine, value: string) {
    setItems((current) => current.map((item) => (item.lineId === lineId ? { ...item, [field]: value } : item)));
  }

  function selectPart(lineId: number, partNo: string) {
    const part = parts.find((item) => item.part_no === partNo);
    setItems((current) => current.map((item) => (
      item.lineId === lineId
        ? { ...item, partNo, description: part?.description ?? item.description, dnp: part?.dnp != null ? String(part.dnp) : item.dnp }
        : item
    )));
  }

  function addItem() {
    setItems((current) => [...current, { ...defaultItem, lineId: Date.now() }]);
  }

  function removeItem(lineId: number) {
    setItems((current) => (current.length === 1 ? current : current.filter((item) => item.lineId !== lineId)));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    const parsedItems = items.map((item) => ({
      partNo: item.partNo.trim(),
      description: item.description.trim(),
      dnp: Number(item.dnp),
      qty: Number(item.qty),
    }));

    const invalidItem = parsedItems.find((item) => !item.partNo || !item.description || !Number.isFinite(item.dnp) || !Number.isFinite(item.qty) || item.dnp < 0 || item.qty <= 0);

    if (!form.branch || !form.orderType || !form.orderFor) {
      setMessage('Please fill all mandatory order fields.');
      return;
    }

    if (invalidItem) {
      setMessage('Each item must have Part No, Description, DNP zero or above, and Qty greater than zero.');
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
      items: parsedItems,
    });
  }

  return (
    <PageCard eyebrow="Orders" title="New Order" description="Create multi-item TEST orders. Writes only to test_orders and test_order_items.">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 lg:grid-cols-2">
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
              <option>VOR</option><option>SOP</option><option>ZSPL</option><option>ZMAC</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Order For</label>
            <select className={inputClass} value={form.orderFor} onChange={(e) => updateField('orderFor', e.target.value)}>
              <option>Customer</option><option>Stock</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Warranty Status</label>
            <select className={inputClass} value={form.warrantyStatus} onChange={(e) => updateField('warrantyStatus', e.target.value)}>
              <option>Warranty</option><option>Paid</option><option>NA</option>
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
          <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-xs font-black uppercase tracking-widest text-pc-muted">Order Value</p>
            <p className="mt-2 text-3xl font-black text-white">₹{totalValue.toFixed(2)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-black text-white">Item Lines</p>
            <Button type="button" onClick={addItem}>Add Item</Button>
          </div>
          <div className="space-y-4">
            {items.map((item, index) => (
              <div key={item.lineId} className="grid gap-3 rounded-xl border border-slate-800 p-3 lg:grid-cols-6">
                <div>
                  <label className={labelClass}>Lookup</label>
                  <select className={inputClass} value={item.partNo} onChange={(e) => selectPart(item.lineId, e.target.value)}>
                    {parts.map((part) => <option key={part.part_no} value={part.part_no}>{part.part_no}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Part No</label>
                  <input className={inputClass} value={item.partNo} onChange={(e) => updateItem(item.lineId, 'partNo', e.target.value)} />
                </div>
                <div className="lg:col-span-2">
                  <label className={labelClass}>Description</label>
                  <input className={inputClass} value={item.description} onChange={(e) => updateItem(item.lineId, 'description', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>DNP</label>
                  <input className={inputClass} value={item.dnp} onChange={(e) => updateItem(item.lineId, 'dnp', e.target.value)} />
                </div>
                <div>
                  <label className={labelClass}>Qty</label>
                  <input className={inputClass} value={item.qty} onChange={(e) => updateItem(item.lineId, 'qty', e.target.value)} />
                </div>
                <div className="lg:col-span-6 flex items-center justify-between text-sm text-pc-muted">
                  <span>Line {index + 1} Value: ₹{(Number(item.dnp || 0) * Number(item.qty || 0)).toFixed(2)}</span>
                  <Button type="button" variant="danger" onClick={() => removeItem(item.lineId)}>Remove</Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Button type="submit" disabled={mutation.isPending} className="w-full">
          {mutation.isPending ? 'Creating...' : 'Create Multi-Item Test Order'}
        </Button>
      </form>
      {message ? <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-pc-text">{message}</p> : null}
    </PageCard>
  );
}
