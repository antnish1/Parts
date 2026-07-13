import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, FilePlus2, Pencil, Plus, RefreshCw, Save, Search, Trash2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../auth/useAuth';
import {
  getOrderCorrectionConsole,
  lookupCorrectionPart,
  submitOrderCorrection,
  type CorrectionAction,
  type CorrectionBilling,
  type CorrectionConsoleData,
  type CorrectionItem,
  type CorrectionOrder,
} from '../../services/orderDataCorrection.service';

type FormMap = Record<string, string>;
type ModalKind = 'order' | 'item' | 'billing' | 'delete-item' | 'delete-billing' | null;

const inputClass = 'w-full rounded-md border border-[#cbd5e1] bg-white px-2.5 py-2 text-xs font-semibold text-[#0f172a] outline-none focus:border-[#0f5fa8] focus:ring-2 focus:ring-[#dbeafe]';
const categories = ['Incorrect Part Number', 'Incorrect Description', 'Incorrect Quantity', 'Incorrect Billing Details', 'Incorrect Docket or Transport', 'Incorrect Receipt Details', 'Incorrect Order Status', 'Incorrect Approval Status', 'Status Report Mismatch', 'Duplicate Row', 'Missing Row', 'Other'];
const orderTypes = ['SOP', 'VOR', 'EMERGENCY', 'STOCK'];
const orderForOptions = ['Stock', 'Customer'];
const warrantyOptions = ['Under Warranty', 'Beyond Warranty', 'Goodwill', 'AMC', 'Not Applicable'];
const orderStatusOptions = ['pending_approval', 'approved', 'processed', 'partially_dispatched', 'dispatched', 'partially_received', 'received', 'issued', 'rejected'];
const approvalStatusOptions = ['pending', 'pending_super_approval', 'pending_manager_approval', 'approved', 'rejected'];
const rowStatusOptions = ['PENDING', 'APPROVED', 'PROCESSED', 'PARTIALLY DISPATCHED', 'DISPATCHED', 'PARTIALLY RECEIVED', 'RECEIVED', 'ISSUED', 'REJECTED'];
const dispatchStatusOptions = ['PENDING', 'PARTIAL', 'DISPATCHED', 'PARTIALLY RECEIVED', 'RECEIVED'];
const billingStatusOptions = ['OPEN', 'BILLED', 'DISPATCHED', 'IN TRANSIT', 'PARTIALLY RECEIVED', 'RECEIVED', 'CANCELLED'];
const transportModeOptions = ['ROAD', 'AIR', 'COURIER', 'HAND DELIVERY', 'RAIL', 'OTHER'];

function text(value: unknown) { return value === null || value === undefined ? '' : String(value); }
function numberValue(value: string) { return value.trim() === '' ? null : Number(value); }
function dateTimeLocal(value: string | null | undefined) { return value ? new Date(value).toISOString().slice(0, 16) : ''; }
function toIsoOrNull(value: string) { return value ? new Date(value).toISOString() : null; }
function money(value: unknown) { return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value ?? 0)); }

function Field({ label, children, span = false }: { label: string; children: ReactNode; span?: boolean }) {
  return <label className={span ? 'block sm:col-span-2' : 'block'}><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.1em] text-[#64748b]">{label}</span>{children}</label>;
}

function SelectField({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) {
  const values = options.includes(value) || !value ? options : [value, ...options];
  return <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)}>{values.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0f172a]/55 p-3"><div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-[#cbd5e1] bg-[#f8fafc] shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#d8e0ea] bg-white px-4 py-3"><h2 className="text-base font-bold text-[#0f172a]">{title}</h2><button type="button" onClick={onClose} className="rounded-md p-1.5 text-[#475569] hover:bg-[#e2e8f0]"><X className="h-4 w-4" /></button></div><div className="p-4">{children}</div></div></div>;
}

function CorrectionReason({ form, set }: { form: FormMap; set: (key: string, value: string) => void }) {
  return <div className="mt-4 grid gap-3 rounded-md border border-[#fbbf24] bg-[#fffbeb] p-3 sm:grid-cols-2"><Field label="Correction Category"><SelectField value={form.category || categories[0]} onChange={(value) => set('category', value)} options={categories} /></Field><Field label="Supporting Reference"><input className={inputClass} value={form.reference || ''} onChange={(event) => set('reference', event.target.value)} placeholder="Optional report, invoice or note reference" /></Field><Field label="Correction Reason" span><textarea className={`${inputClass} min-h-20 resize-y`} value={form.reason || ''} onChange={(event) => set('reason', event.target.value)} placeholder="Explain why this database correction is required" /></Field></div>;
}

function orderForm(order: CorrectionOrder): FormMap {
  return {
    final_order_no: text(order.final_order_no), processing_reference: text(order.processing_reference), order_type: text(order.order_type), order_for: text(order.order_for), machine_no: text(order.machine_no), customer_name: text(order.customer_name), contact_no: text(order.contact_no), call_id: text(order.call_id), warranty_status: text(order.warranty_status), status: text(order.status), approval_status: text(order.approval_status), processed_date: text(order.processed_date).slice(0, 10), dbms_invoice_no: text(order.dbms_invoice_no), dbms_invoice_date: text(order.dbms_invoice_date).slice(0, 10), category: categories[0], reason: '', reference: '', sync_matching_items: 'true',
  };
}

function itemForm(item?: CorrectionItem): FormMap {
  return {
    part_no: text(item?.part_no), description: text(item?.description), dnp: text(item?.dnp), qty: text(item?.qty ?? ''), edited_qty: text(item?.edited_qty), billed_qty: text(item?.billed_qty ?? 0), value: text(item?.value), edited_value: text(item?.edited_value), order_reg_date: text(item?.order_reg_date).slice(0, 10), dbms_invoice_no: text(item?.dbms_invoice_no), dbms_invoice_date: text(item?.dbms_invoice_date).slice(0, 10), docket_no: text(item?.docket_no), transport_name: text(item?.transport_name), received_date: dateTimeLocal(item?.received_date), row_status: text(item?.row_status || 'PENDING'), dispatch_status_legacy: text(item?.dispatch_status_legacy || 'PENDING'), category: item ? categories[0] : 'Missing Row', reason: '', reference: '', update_linked_billings: 'true',
  };
}

function billingForm(billing?: CorrectionBilling): FormMap {
  return {
    billed_qty: text(billing?.billed_qty ?? ''), received_qty: text(billing?.received_qty ?? 0), billing_date: text(billing?.billing_date).slice(0, 10), order_reg_date: text(billing?.order_reg_date).slice(0, 10), delivery_no: text(billing?.delivery_no), invoice_no: text(billing?.invoice_no), docket_no: text(billing?.docket_no), transport_name: text(billing?.transport_name), transport_mode: text(billing?.transport_mode || 'ROAD'), packing_detail: text(billing?.packing_detail), eway_bill_no: text(billing?.eway_bill_no), gst_invoice_no: text(billing?.gst_invoice_no), raw_status: text(billing?.raw_status || 'BILLED'), received_at: dateTimeLocal(billing?.received_at), category: billing ? categories[0] : 'Missing Row', reason: '', reference: '',
  };
}

export function OrderDataCorrectionPage() {
  const { orderId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const allowed = role === 'manager' || role === 'developer';
  const [modal, setModal] = useState<ModalKind>(null);
  const [selectedItem, setSelectedItem] = useState<CorrectionItem | null>(null);
  const [selectedBilling, setSelectedBilling] = useState<CorrectionBilling | null>(null);
  const [form, setForm] = useState<FormMap>({});
  const [message, setMessage] = useState('');
  const [partBusy, setPartBusy] = useState(false);

  const query = useQuery({ queryKey: ['order-correction-console', orderId], queryFn: () => getOrderCorrectionConsole(orderId), enabled: allowed && !!orderId });
  const mutation = useMutation({
    mutationFn: submitOrderCorrection,
    onSuccess: async (data) => {
      queryClient.setQueryData(['order-correction-console', orderId], data);
      await queryClient.invalidateQueries({ queryKey: ['test-order-view', orderId] });
      await queryClient.invalidateQueries({ queryKey: ['test-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['order-list-paged'] });
      setModal(null); setMessage('Correction saved and audit history updated.');
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Correction failed.'),
  });

  const data = query.data;
  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!allowed) setMessage('Only Manager and Developer roles can use the correction console.');
  }, [allowed]);

  const totalValue = useMemo(() => data?.items.reduce((sum, item) => sum + Number(item.edited_value ?? item.value ?? 0), 0) ?? 0, [data]);

  function openOrder() { if (!data) return; setForm(orderForm(data.order)); setSelectedItem(null); setSelectedBilling(null); setModal('order'); setMessage(''); }
  function openItem(item?: CorrectionItem) { setSelectedItem(item ?? null); setSelectedBilling(null); setForm(itemForm(item)); setModal('item'); setMessage(''); }
  function openBilling(item: CorrectionItem, billing?: CorrectionBilling) { setSelectedItem(item); setSelectedBilling(billing ?? null); setForm(billingForm(billing)); setModal('billing'); setMessage(''); }
  function openDeleteItem(item: CorrectionItem) { setSelectedItem(item); setSelectedBilling(null); setForm({ category: 'Duplicate Row', reason: '', reference: '', delete_linked_billings: item.billings.length ? 'false' : 'true' }); setModal('delete-item'); setMessage(''); }
  function openDeleteBilling(item: CorrectionItem, billing: CorrectionBilling) { setSelectedItem(item); setSelectedBilling(billing); setForm({ category: 'Duplicate Row', reason: '', reference: '' }); setModal('delete-billing'); setMessage(''); }

  async function loadPart() {
    setMessage(''); setPartBusy(true);
    try {
      const part = await lookupCorrectionPart(form.part_no || '');
      if (!part) throw new Error('Part number not found in Part Master.');
      const dnp = part.dnp;
      const qty = numberValue(form.qty) ?? 0;
      const editedQty = numberValue(form.edited_qty);
      setForm((current) => ({ ...current, part_no: part.part_no, description: part.description || '', dnp: text(dnp), value: dnp === null ? '' : text(dnp * qty), edited_value: dnp === null || editedQty === null ? '' : text(dnp * editedQty) }));
      setMessage('Part details loaded from Part Master.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Part lookup failed.'); }
    finally { setPartBusy(false); }
  }

  function recalcItem(next: FormMap) {
    const dnp = numberValue(next.dnp);
    const qty = numberValue(next.qty) ?? 0;
    const editedQty = numberValue(next.edited_qty);
    return { ...next, value: dnp === null ? '' : text(dnp * qty), edited_value: dnp === null || editedQty === null ? '' : text(dnp * editedQty) };
  }

  function submit(action: CorrectionAction, changes: Record<string, unknown>, expectedUpdatedAt?: string) {
    if (!form.reason?.trim()) return setMessage('Correction reason is required.');
    mutation.mutate({ action, orderId, itemId: selectedItem?.id, billingId: selectedBilling?.id, expectedUpdatedAt, changes, reason: form.reason.trim(), category: form.category || categories[0], reference: form.reference?.trim(), updateLinkedBillings: form.update_linked_billings !== 'false', syncMatchingItems: form.sync_matching_items !== 'false', ...(action === 'delete_item' ? { deleteLinkedBillings: form.delete_linked_billings === 'true' } : {}) } as never);
  }

  function submitOrder() {
    if (!data) return;
    submit('update_order', { final_order_no: form.final_order_no || null, processing_reference: form.processing_reference || null, order_type: form.order_type, order_for: form.order_for, machine_no: form.machine_no || null, customer_name: form.customer_name || null, contact_no: form.contact_no || null, call_id: form.call_id || null, warranty_status: form.warranty_status || null, status: form.status, approval_status: form.approval_status, processed_date: form.processed_date || null, dbms_invoice_no: form.dbms_invoice_no || null, dbms_invoice_date: form.dbms_invoice_date || null }, data.order.updated_at);
  }

  function submitItem() {
    const changes = { part_no: form.part_no.trim().toUpperCase(), description: form.description || null, dnp: numberValue(form.dnp), qty: numberValue(form.qty) ?? 0, edited_qty: numberValue(form.edited_qty), billed_qty: numberValue(form.billed_qty) ?? 0, value: numberValue(form.value), edited_value: numberValue(form.edited_value), order_reg_date: form.order_reg_date || null, dbms_invoice_no: form.dbms_invoice_no || null, dbms_invoice_date: form.dbms_invoice_date || null, docket_no: form.docket_no || null, transport_name: form.transport_name || null, received_date: toIsoOrNull(form.received_date), row_status: form.row_status || null, dispatch_status_legacy: form.dispatch_status_legacy || null };
    submit(selectedItem ? 'update_item' : 'create_item', changes, selectedItem?.updated_at);
  }

  function submitBilling() {
    const changes = { billed_qty: numberValue(form.billed_qty) ?? 0, received_qty: numberValue(form.received_qty) ?? 0, billing_date: form.billing_date || null, order_reg_date: form.order_reg_date || null, delivery_no: form.delivery_no || null, invoice_no: form.invoice_no || null, docket_no: form.docket_no || null, transport_name: form.transport_name || null, transport_mode: form.transport_mode || null, packing_detail: form.packing_detail || null, eway_bill_no: form.eway_bill_no || null, gst_invoice_no: form.gst_invoice_no || null, raw_status: form.raw_status || null, received_at: toIsoOrNull(form.received_at) };
    submit(selectedBilling ? 'update_billing' : 'create_billing', changes, selectedBilling?.updated_at);
  }

  if (!allowed) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">Only Manager and Developer roles can access Order Data Correction.</div>;
  if (query.isLoading) return <div className="rounded-lg border border-[#d8e0ea] bg-white p-8 text-center text-sm text-[#64748b]">Loading correction console…</div>;
  if (query.error || !data) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{query.error instanceof Error ? query.error.message : 'Could not load correction console.'}</div>;

  return <div className="space-y-3 pb-12">
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#d8e0ea] bg-white p-3"><div><button type="button" onClick={() => navigate(`/orders/${orderId}`)} className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-[#475569] hover:text-[#0f5fa8]"><ArrowLeft className="h-3.5 w-3.5" />Order details</button><h1 className="text-lg font-bold text-[#0f172a]">Order Data Correction</h1><p className="text-xs text-[#64748b]">{data.order.final_order_no || data.order.order_no} • {data.order.branch}</p></div><div className="flex gap-2"><Button variant="secondary" onClick={() => query.refetch()}><RefreshCw className="h-3.5 w-3.5" />Refresh</Button><Button onClick={openOrder}><Pencil className="h-3.5 w-3.5" />Edit Order Header</Button></div></div>
    {message ? <div className={`rounded-md border p-2.5 text-xs font-semibold ${message.toLowerCase().includes('failed') || message.toLowerCase().includes('required') || message.toLowerCase().includes('not found') ? 'border-red-200 bg-red-50 text-red-700' : 'border-blue-200 bg-blue-50 text-blue-700'}`}>{message}</div> : null}
    <div className="grid gap-2 sm:grid-cols-4"><div className="rounded-md border border-[#d8e0ea] bg-white p-3"><p className="text-[10px] uppercase text-[#64748b]">Items</p><p className="text-lg font-bold">{data.items.length}</p></div><div className="rounded-md border border-[#d8e0ea] bg-white p-3"><p className="text-[10px] uppercase text-[#64748b]">Billing Rows</p><p className="text-lg font-bold">{data.items.reduce((sum, item) => sum + item.billings.length, 0)}</p></div><div className="rounded-md border border-[#d8e0ea] bg-white p-3"><p className="text-[10px] uppercase text-[#64748b]">Effective Value</p><p className="text-lg font-bold">{money(totalValue)}</p></div><div className="rounded-md border border-[#d8e0ea] bg-white p-3"><p className="text-[10px] uppercase text-[#64748b]">Corrections</p><p className="text-lg font-bold">{data.events.length}</p></div></div>
    <section className="rounded-lg border border-[#d8e0ea] bg-white"><div className="flex items-center justify-between border-b border-[#e2e8f0] px-3 py-2"><div><h2 className="text-sm font-bold text-[#0f172a]">Order Items</h2><p className="text-[11px] text-[#64748b]">Edit rows, add missing items, manage billing rows, or remove confirmed duplicates.</p></div><Button onClick={() => openItem()}><Plus className="h-3.5 w-3.5" />Add Missing Item</Button></div><div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-left text-xs"><thead className="bg-[#f1f5f9] text-[10px] uppercase tracking-[0.08em] text-[#475569]"><tr><th className="px-3 py-2">Part</th><th className="px-3 py-2">Qty</th><th className="px-3 py-2">DNP / Value</th><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Docket / Transport</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Billing Rows</th><th className="px-3 py-2">Actions</th></tr></thead><tbody className="divide-y divide-[#e2e8f0]">{data.items.map((item) => <tr key={item.id} className="align-top hover:bg-[#f8fafc]"><td className="px-3 py-2"><p className="font-bold text-[#0f172a]">{item.part_no}</p><p className="max-w-[240px] text-[#64748b]">{item.description || '-'}</p></td><td className="px-3 py-2"><p>Ordered: {item.qty}</p><p>Edited: {item.edited_qty ?? '-'}</p><p>Billed: {item.billed_qty}</p></td><td className="px-3 py-2"><p>DNP: {money(item.dnp)}</p><p>Value: {money(item.value)}</p><p>Edited: {item.edited_value == null ? '-' : money(item.edited_value)}</p></td><td className="px-3 py-2"><p>{item.dbms_invoice_no || '-'}</p><p className="text-[#64748b]">{item.dbms_invoice_date || '-'}</p></td><td className="px-3 py-2"><p>{item.docket_no || '-'}</p><p className="text-[#64748b]">{item.transport_name || '-'}</p></td><td className="px-3 py-2"><p>{item.row_status || '-'}</p><p className="text-[#64748b]">{item.dispatch_status_legacy || '-'}</p></td><td className="px-3 py-2"><div className="space-y-1">{item.billings.map((billing) => <div key={billing.id} className="flex items-center justify-between gap-2 rounded border border-[#e2e8f0] px-2 py-1"><span>{billing.invoice_no || billing.delivery_no || 'Billing'} • {billing.billed_qty}</span><span className="flex gap-1"><button type="button" title="Edit billing" onClick={() => openBilling(item, billing)} className="rounded p-1 text-[#0f5fa8] hover:bg-blue-50"><Pencil className="h-3 w-3" /></button><button type="button" title="Remove duplicate billing" onClick={() => openDeleteBilling(item, billing)} className="rounded p-1 text-red-600 hover:bg-red-50"><Trash2 className="h-3 w-3" /></button></span></div>)}<button type="button" onClick={() => openBilling(item)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0f5fa8]"><FilePlus2 className="h-3 w-3" />Add billing row</button></div></td><td className="px-3 py-2"><div className="flex gap-1"><Button variant="secondary" className="px-2" onClick={() => openItem(item)}><Pencil className="h-3 w-3" />Edit</Button><Button variant="danger" className="px-2" onClick={() => openDeleteItem(item)}><Trash2 className="h-3 w-3" />Duplicate</Button></div></td></tr>)}</tbody></table></div></section>
    <section className="rounded-lg border border-[#d8e0ea] bg-white"><div className="border-b border-[#e2e8f0] px-3 py-2"><h2 className="text-sm font-bold">Correction History</h2></div><div className="divide-y divide-[#e2e8f0]">{data.events.length ? data.events.map((event) => <div key={event.id} className="px-3 py-2"><p className="text-xs font-semibold text-[#0f172a]">{event.notes}</p><p className="text-[10px] text-[#64748b]">{new Date(event.created_at).toLocaleString('en-IN')}</p></div>) : <p className="p-4 text-xs text-[#64748b]">No manual corrections recorded.</p>}</div></section>

    {modal === 'order' ? <Modal title="Edit Order Header" onClose={() => setModal(null)}><div className="grid gap-3 sm:grid-cols-2"><Field label="Final Order Number"><input className={inputClass} value={form.final_order_no} onChange={(e) => set('final_order_no', e.target.value.toUpperCase())} /></Field><Field label="Processing Reference"><input className={inputClass} value={form.processing_reference} onChange={(e) => set('processing_reference', e.target.value.toUpperCase())} /></Field><Field label="Order Type"><SelectField value={form.order_type} onChange={(v) => set('order_type', v)} options={orderTypes} /></Field><Field label="Order For"><SelectField value={form.order_for} onChange={(v) => set('order_for', v)} options={orderForOptions} /></Field><Field label="Machine Number"><input className={inputClass} value={form.machine_no} onChange={(e) => set('machine_no', e.target.value.toUpperCase())} /></Field><Field label="Customer Name"><input className={inputClass} value={form.customer_name} onChange={(e) => set('customer_name', e.target.value.toUpperCase())} /></Field><Field label="Contact Number"><input className={inputClass} value={form.contact_no} onChange={(e) => set('contact_no', e.target.value.replace(/\D/g, '').slice(0, 15))} /></Field><Field label="Call ID"><input className={inputClass} value={form.call_id} onChange={(e) => set('call_id', e.target.value.toUpperCase())} /></Field><Field label="Warranty Status"><SelectField value={form.warranty_status} onChange={(v) => set('warranty_status', v)} options={warrantyOptions} /></Field><Field label="Order Status"><SelectField value={form.status} onChange={(v) => set('status', v)} options={orderStatusOptions} /></Field><Field label="Approval Status"><SelectField value={form.approval_status} onChange={(v) => set('approval_status', v)} options={approvalStatusOptions} /></Field><Field label="Processed Date"><input type="date" className={inputClass} value={form.processed_date} onChange={(e) => set('processed_date', e.target.value)} /></Field><Field label="DBMS Invoice Number"><input className={inputClass} value={form.dbms_invoice_no} onChange={(e) => set('dbms_invoice_no', e.target.value.toUpperCase())} /></Field><Field label="DBMS Invoice Date"><input type="date" className={inputClass} value={form.dbms_invoice_date} onChange={(e) => set('dbms_invoice_date', e.target.value)} /></Field><label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={form.sync_matching_items !== 'false'} onChange={(e) => set('sync_matching_items', e.target.checked ? 'true' : 'false')} /><span className="text-xs font-semibold">Update item rows that still carry the previous order-level invoice details</span></label></div><CorrectionReason form={form} set={set} /><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button disabled={mutation.isPending} onClick={submitOrder}><Save className="h-3.5 w-3.5" />{mutation.isPending ? 'Saving…' : 'Confirm Correction'}</Button></div></Modal> : null}

    {modal === 'item' ? <Modal title={selectedItem ? `Edit Item ${selectedItem.part_no}` : 'Add Missing Item'} onClose={() => setModal(null)}><div className="grid gap-3 sm:grid-cols-2"><Field label="Part Number" span><div className="flex gap-2"><input className={inputClass} value={form.part_no} onChange={(e) => set('part_no', e.target.value.toUpperCase())} /><Button variant="secondary" disabled={partBusy} onClick={loadPart}><Search className="h-3.5 w-3.5" />{partBusy ? 'Looking…' : 'Load Part Master'}</Button></div></Field><Field label="Description"><input className={inputClass} value={form.description} readOnly /></Field><Field label="DNP"><input className={`${inputClass} bg-[#f1f5f9]`} type="number" value={form.dnp} readOnly /></Field><Field label="Ordered Quantity"><input className={inputClass} type="number" value={form.qty} onChange={(e) => setForm((current) => recalcItem({ ...current, qty: e.target.value }))} /></Field><Field label="Edited Quantity"><input className={inputClass} type="number" value={form.edited_qty} onChange={(e) => setForm((current) => recalcItem({ ...current, edited_qty: e.target.value }))} /></Field><Field label="Billed Quantity"><input className={inputClass} type="number" value={form.billed_qty} onChange={(e) => set('billed_qty', e.target.value)} /></Field><Field label="Value"><input className={`${inputClass} bg-[#f1f5f9]`} value={form.value} readOnly /></Field><Field label="Edited Value"><input className={`${inputClass} bg-[#f1f5f9]`} value={form.edited_value} readOnly placeholder="Blank while Edited Quantity is blank" /></Field><Field label="Order Registration Date"><input type="date" className={inputClass} value={form.order_reg_date} onChange={(e) => set('order_reg_date', e.target.value)} /></Field><Field label="DBMS Invoice Number"><input className={inputClass} value={form.dbms_invoice_no} onChange={(e) => set('dbms_invoice_no', e.target.value.toUpperCase())} /></Field><Field label="DBMS Invoice Date"><input type="date" className={inputClass} value={form.dbms_invoice_date} onChange={(e) => set('dbms_invoice_date', e.target.value)} /></Field><Field label="Docket Number"><input className={inputClass} value={form.docket_no} onChange={(e) => set('docket_no', e.target.value.toUpperCase())} /></Field><Field label="Transport Name"><input className={inputClass} value={form.transport_name} onChange={(e) => set('transport_name', e.target.value.toUpperCase())} /></Field><Field label="Received Date"><input type="datetime-local" className={inputClass} value={form.received_date} onChange={(e) => set('received_date', e.target.value)} /></Field><Field label="Row Status"><SelectField value={form.row_status} onChange={(v) => set('row_status', v)} options={rowStatusOptions} /></Field><Field label="Dispatch Status"><SelectField value={form.dispatch_status_legacy} onChange={(v) => set('dispatch_status_legacy', v)} options={dispatchStatusOptions} /></Field>{selectedItem ? <label className="flex items-center gap-2 sm:col-span-2"><input type="checkbox" checked={form.update_linked_billings !== 'false'} onChange={(e) => set('update_linked_billings', e.target.checked ? 'true' : 'false')} /><span className="text-xs font-semibold">When part number changes, update linked billing rows too</span></label> : null}</div><CorrectionReason form={form} set={set} /><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button disabled={mutation.isPending} onClick={submitItem}><Save className="h-3.5 w-3.5" />{mutation.isPending ? 'Saving…' : selectedItem ? 'Confirm Correction' : 'Add Item'}</Button></div></Modal> : null}

    {modal === 'billing' ? <Modal title={selectedBilling ? 'Edit Billing Row' : `Add Billing Row — ${selectedItem?.part_no}`} onClose={() => setModal(null)}><div className="grid gap-3 sm:grid-cols-2"><Field label="Billed Quantity"><input type="number" className={inputClass} value={form.billed_qty} onChange={(e) => set('billed_qty', e.target.value)} /></Field><Field label="Received Quantity"><input type="number" className={inputClass} value={form.received_qty} onChange={(e) => set('received_qty', e.target.value)} /></Field><Field label="Billing Date"><input type="date" className={inputClass} value={form.billing_date} onChange={(e) => set('billing_date', e.target.value)} /></Field><Field label="Order Registration Date"><input type="date" className={inputClass} value={form.order_reg_date} onChange={(e) => set('order_reg_date', e.target.value)} /></Field><Field label="Delivery Number"><input className={inputClass} value={form.delivery_no} onChange={(e) => set('delivery_no', e.target.value.toUpperCase())} /></Field><Field label="Invoice Number"><input className={inputClass} value={form.invoice_no} onChange={(e) => set('invoice_no', e.target.value.toUpperCase())} /></Field><Field label="Docket Number"><input className={inputClass} value={form.docket_no} onChange={(e) => set('docket_no', e.target.value.toUpperCase())} /></Field><Field label="Transport Name"><input className={inputClass} value={form.transport_name} onChange={(e) => set('transport_name', e.target.value.toUpperCase())} /></Field><Field label="Transport Mode"><SelectField value={form.transport_mode} onChange={(v) => set('transport_mode', v)} options={transportModeOptions} /></Field><Field label="Packing Detail"><input className={inputClass} value={form.packing_detail} onChange={(e) => set('packing_detail', e.target.value)} /></Field><Field label="E-way Bill Number"><input className={inputClass} value={form.eway_bill_no} onChange={(e) => set('eway_bill_no', e.target.value.toUpperCase())} /></Field><Field label="GST Invoice Number"><input className={inputClass} value={form.gst_invoice_no} onChange={(e) => set('gst_invoice_no', e.target.value.toUpperCase())} /></Field><Field label="Billing Status"><SelectField value={form.raw_status} onChange={(v) => set('raw_status', v)} options={billingStatusOptions} /></Field><Field label="Received Date"><input type="datetime-local" className={inputClass} value={form.received_at} onChange={(e) => set('received_at', e.target.value)} /></Field></div><CorrectionReason form={form} set={set} /><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button disabled={mutation.isPending} onClick={submitBilling}><Save className="h-3.5 w-3.5" />{mutation.isPending ? 'Saving…' : selectedBilling ? 'Confirm Correction' : 'Add Billing Row'}</Button></div></Modal> : null}

    {modal === 'delete-item' ? <Modal title="Remove Duplicate Item" onClose={() => setModal(null)}><div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-bold">This permanently removes item {selectedItem?.part_no}.</p><p className="mt-1 text-xs">The deleted row is preserved inside the correction audit event. Existing linked billing rows are removed only after explicit confirmation.</p></div></div></div>{selectedItem?.billings.length ? <label className="mt-3 flex items-center gap-2 rounded border border-[#fbbf24] bg-[#fffbeb] p-3"><input type="checkbox" checked={form.delete_linked_billings === 'true'} onChange={(e) => set('delete_linked_billings', e.target.checked ? 'true' : 'false')} /><span className="text-xs font-semibold">Also remove {selectedItem.billings.length} linked duplicate billing row(s)</span></label> : null}<CorrectionReason form={form} set={set} /><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" disabled={mutation.isPending || (Boolean(selectedItem?.billings.length) && form.delete_linked_billings !== 'true')} onClick={() => submit('delete_item', {})}><Trash2 className="h-3.5 w-3.5" />Remove Duplicate</Button></div></Modal> : null}
    {modal === 'delete-billing' ? <Modal title="Remove Duplicate Billing Row" onClose={() => setModal(null)}><div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p className="font-bold">Permanently remove billing row {selectedBilling?.invoice_no || selectedBilling?.delivery_no || selectedBilling?.id}?</p><p className="mt-1 text-xs">The deleted row is retained in the audit event.</p></div><CorrectionReason form={form} set={set} /><div className="mt-4 flex justify-end gap-2"><Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button><Button variant="danger" disabled={mutation.isPending} onClick={() => submit('delete_billing', {})}><Trash2 className="h-3.5 w-3.5" />Remove Duplicate</Button></div></Modal> : null}
  </div>;
}
