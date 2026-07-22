import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Check, Download, FileSpreadsheet, Search, Upload } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PageCard } from '../../components/ui/PageCard';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import {
  createInstallationEntriesBulk,
  createInstallationEntry,
  findPartMasterMatches,
  getExistingInstallationInvoiceNos,
  getPartMasterDescriptions,
  listInstallationBranches,
  type EquipmentType,
  type PartMasterMatch,
} from '../../services/installations.service';

const today = new Date().toISOString().slice(0, 10);

type ImportRow = {
  rowNo: number;
  equipment_type: EquipmentType | '';
  invoice_date: string;
  branch: string;
  invoice_no: string;
  customer_name: string;
  part_no: string;
  description: string;
  quantity: number;
  errors: string[];
};

function normalizeType(value: unknown): EquipmentType | '' {
  const text = String(value ?? '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (text === 'ENGINE') return 'ENGINE';
  if (text === 'ROCK_BREAKER' || text === 'ROCKBREAKER') return 'ROCK_BREAKER';
  return '';
}

function toIsoDate(year: number, month: number, day: number): string {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return '';
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function excelDate(value: unknown): string {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? toIsoDate(parsed.y, parsed.m, parsed.d) : '';
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toIsoDate(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const text = String(value ?? '').trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  return toIsoDate(Number(match[3]), Number(match[2]), Number(match[1]));
}

function displayDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '-';
}

function norm(value: string) {
  return value.trim().toUpperCase();
}

export function NewInstallationPage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('ENGINE');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [branch, setBranch] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [partNo, setPartNo] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [matches, setMatches] = useState<PartMasterMatch[]>([]);
  const [partLoading, setPartLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  const branches = useQuery({ queryKey: ['installation-branches'], queryFn: listInstallationBranches });
  const mutation = useMutation({
    mutationFn: createInstallationEntry,
    onSuccess: (id) => navigate(`/installations/${id}`, { replace: true }),
    onError: (e) => {
      setConfirmOpen(false);
      setError(e instanceof Error ? e.message : 'Could not create entry.');
    },
  });
  const bulkMutation = useMutation({
    mutationFn: createInstallationEntriesBulk,
    onSuccess: (ids) => {
      setImportMessage(`${ids.length} entries created successfully.`);
      setTimeout(() => navigate('/installations', { replace: true }), 700);
    },
    onError: (e) => setImportMessage(e instanceof Error ? e.message : 'Excel import failed.'),
  });

  useEffect(() => {
    function close(event: MouseEvent) {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  async function changePart(value: string) {
    const next = norm(value);
    setPartNo(next);
    setDescription('');
    if (next.length < 2) {
      setMatches([]);
      setDropdownOpen(false);
      return;
    }
    setPartLoading(true);
    setDropdownOpen(true);
    try {
      setMatches(await findPartMasterMatches(next));
    } catch {
      setMatches([]);
    } finally {
      setPartLoading(false);
    }
  }

  function choosePart(match: PartMasterMatch) {
    setPartNo(match.part_no);
    setDescription(match.description);
    setMatches([]);
    setDropdownOpen(false);
  }

  function submit() {
    setError('');
    if (!invoiceDate || !branch || !invoiceNo.trim() || !customerName.trim() || !partNo.trim() || !description.trim() || quantity <= 0) {
      setError('Complete all required fields.');
      return;
    }
    setConfirmOpen(true);
  }

  function confirmCreate() {
    mutation.mutate({
      equipment_type: equipmentType,
      invoice_date: invoiceDate,
      branch,
      invoice_no: norm(invoiceNo),
      customer_name: customerName.trim(),
      items: [{ part_no: partNo, description: description.trim(), quantity }],
    });
  }

  function downloadTemplate() {
    const sampleDate = new Date().toLocaleDateString('en-GB');
    const ws = XLSX.utils.json_to_sheet([{
      'Equipment Type': 'Engine',
      'Invoice Date': sampleDate,
      'Branch': 'JABALPUR_PARTS',
      'Invoice No': 'INV-001',
      'Customer Name': 'Customer Name',
      'Part No': '1234567890',
      'Quantity': 1,
    }]);
    ws['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 18 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Installation Upload');
    XLSX.writeFile(wb, 'Engine-Breaker-Installation-Template.xlsx');
  }

  async function handleExcel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportMessage('Reading file and fetching descriptions from Parts Master…');
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '', raw: true });
      const branchSet = new Set((branches.data ?? []).map((value) => norm(value)));
      const invoiceCounts = new Map<string, number>();
      raw.forEach((row) => {
        const invoice = norm(String(row['Invoice No'] ?? ''));
        if (invoice) invoiceCounts.set(invoice, (invoiceCounts.get(invoice) ?? 0) + 1);
      });
      const partNos = raw.map((row) => norm(String(row['Part No'] ?? ''))).filter(Boolean);
      const [existingInvoiceNos, descriptions] = await Promise.all([
        getExistingInstallationInvoiceNos([...invoiceCounts.keys()]),
        getPartMasterDescriptions(partNos),
      ]);
      const existing = new Set(existingInvoiceNos);
      const parsed: ImportRow[] = raw.map((row, index) => {
        const type = normalizeType(row['Equipment Type']);
        const date = excelDate(row['Invoice Date']);
        const invoice = norm(String(row['Invoice No'] ?? ''));
        const branchName = String(row['Branch'] ?? '').trim();
        const customer = String(row['Customer Name'] ?? '').trim();
        const part = norm(String(row['Part No'] ?? ''));
        const qty = Number(row['Quantity'] ?? 0);
        const masterDescription = descriptions[part] ?? '';
        const errors: string[] = [];
        if (!type) errors.push('Invalid equipment type');
        if (!date) errors.push('Date must be DD/MM/YYYY');
        if (!branchName || !branchSet.has(norm(branchName))) errors.push('Invalid branch');
        if (!invoice) errors.push('Invoice No. required');
        if ((invoiceCounts.get(invoice) ?? 0) > 1) errors.push('Duplicate invoice in file');
        if (existing.has(invoice)) errors.push('Invoice already exists');
        if (!customer) errors.push('Customer required');
        if (!part) errors.push('Part No. required');
        if (!masterDescription) errors.push('Part not found — enter description manually');
        if (!(qty > 0)) errors.push('Invalid quantity');
        return {
          rowNo: index + 2,
          equipment_type: type,
          invoice_date: date,
          branch: branchName,
          invoice_no: invoice,
          customer_name: customer,
          part_no: part,
          description: masterDescription,
          quantity: qty,
          errors,
        };
      });
      const types = [...new Set(parsed.map((row) => row.equipment_type).filter(Boolean))];
      if (types.length > 1) parsed.forEach((row) => row.errors.push('Mixed equipment types are not allowed'));
      setImportRows(parsed);
      setImportOpen(true);
      setImportMessage(`${parsed.length} rows loaded. Descriptions were fetched from Parts Master.`);
    } catch (e) {
      setImportMessage(e instanceof Error ? e.message : 'Could not read Excel file.');
    }
  }

  function updateImportedDescription(index: number, value: string) {
    setImportRows((current) => current.map((row, rowIndex) => {
      if (rowIndex !== index) return row;
      const errors = row.errors.filter((item) => item !== 'Part not found — enter description manually');
      if (!value.trim()) errors.push('Part not found — enter description manually');
      return { ...row, description: value, errors };
    }));
  }

  const validRows = useMemo(() => importRows.filter((row) => row.errors.length === 0 && row.equipment_type), [importRows]);
  const allRowsValid = importRows.length > 0 && validRows.length === importRows.length;
  const dropdown = inputRef.current?.getBoundingClientRect();

  return <PageCard eyebrow="Installation Management" title="Add New Engine & Breaker Entry" description="Create one installation entry manually or upload multiple entries from Excel">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="inline-flex rounded-lg border border-[#cbd5e1] bg-[#f8fafc] p-1">{(['ENGINE', 'ROCK_BREAKER'] as EquipmentType[]).map((type) => <button key={type} onClick={() => setEquipmentType(type)} className={`inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-semibold ${equipmentType === type ? 'bg-[#0b1f3a] text-white shadow' : 'text-[#334155]'}`}>{equipmentType === type ? <Check className="h-4 w-4" /> : null}{type === 'ENGINE' ? 'Engine' : 'Rock Breaker'}</button>)}</div><div className="flex gap-2"><button onClick={downloadTemplate} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#0f5fa8] bg-white px-3 text-xs font-semibold text-[#0f5fa8]"><Download className="h-4 w-4" />Template</button><label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md bg-[#0f5fa8] px-3 text-xs font-semibold text-white"><Upload className="h-4 w-4" />Upload Excel<input type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcel} /></label></div></div>
    {importMessage ? <p className="mt-3 rounded-md border border-[#b9d5ef] bg-[#eef7ff] p-3 text-sm text-[#0b4d8a]">{importMessage}</p> : null}
    <div className="mt-3 grid gap-3 rounded-xl border border-[#d8e0ea] bg-white p-4 md:grid-cols-2"><label className="text-xs font-semibold text-[#334155]">Invoice Date<input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-[#cbd5e1] px-3 text-sm" /></label><label className="text-xs font-semibold text-[#334155]">Branch<select value={branch} onChange={(e) => setBranch(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-[#cbd5e1] bg-white px-3 text-sm"><option value="">Select branch</option>{(branches.data ?? []).map((name) => <option key={name}>{name}</option>)}</select></label><label className="text-xs font-semibold text-[#334155]">Invoice No.<input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value.toUpperCase())} className="mt-1 h-10 w-full rounded-md border border-[#cbd5e1] px-3 text-sm uppercase" /></label><label className="text-xs font-semibold text-[#334155]">Customer Name<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-[#cbd5e1] px-3 text-sm" /></label></div>
    <div className="mt-3 rounded-xl border border-[#d8e0ea] bg-white p-4"><h3 className="text-xs font-semibold uppercase text-[#334155]">Part Details</h3><p className="mt-1 text-[10px] text-[#64748b]">Enter at least two characters to search Parts Master. One part is allowed per entry.</p><div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr_140px]"><label className="relative text-xs font-semibold">Part No.<div className="relative mt-1"><Search className="absolute left-2 top-3 h-3.5 w-3.5 text-[#64748b]" /><input ref={inputRef} value={partNo} onFocus={() => partNo.length >= 2 && setDropdownOpen(true)} onChange={(e) => changePart(e.target.value)} className="h-10 w-full rounded-md border pl-7 pr-2 uppercase" /></div></label><label className="text-xs font-semibold">Description<input value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-[#f8fafc] px-3" placeholder="Auto-filled or enter manually" /></label><label className="text-xs font-semibold">Quantity<input type="number" min="0.01" step="0.01" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="mt-1 h-10 w-full rounded-md border px-3" /></label></div></div>
    {dropdownOpen && dropdown ? createPortal(<div style={{ position: 'fixed', left: dropdown.left, top: dropdown.bottom + 4, width: Math.max(dropdown.width, 360), zIndex: 9999 }} className="max-h-72 overflow-y-auto rounded-lg border border-[#b9cee2] bg-white shadow-2xl">{partLoading ? <p className="px-3 py-3 text-xs text-[#64748b]">Searching Parts Master…</p> : matches.length ? matches.map((match) => <button type="button" key={match.part_no} onMouseDown={(e) => e.preventDefault()} onClick={() => choosePart(match)} className="block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-[#eef7ff]"><strong className="block text-sm text-[#075fb8]">{match.part_no}</strong><span className="mt-0.5 block text-xs text-[#64748b]">{match.description || 'No description'}</span></button>) : <p className="px-3 py-3 text-xs text-[#64748b]">No matching part. Enter the description manually.</p>}</div>, document.body) : null}
    {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    <div className="mt-3 flex justify-end gap-2"><button onClick={() => navigate('/installations')} className="h-9 rounded-md border border-[#cbd5e1] bg-white px-4 text-xs font-semibold text-[#334155]">Cancel</button><button disabled={mutation.isPending} onClick={submit} className="h-9 rounded-md bg-[#0f5fa8] px-5 text-xs font-semibold text-white disabled:opacity-50">{mutation.isPending ? 'Creating…' : 'Create Entry'}</button></div>
    {importOpen ? <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#0f172a]/55 p-3"><div className="max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b bg-[#eaf0f6] px-4 py-3"><div><h2 className="text-sm font-semibold text-[#0b1f3a]">Excel Import Preview</h2><p className="text-xs text-[#64748b]">{validRows.length} valid of {importRows.length} rows • Dates must be DD/MM/YYYY</p></div><FileSpreadsheet className="h-5 w-5 text-[#0f5fa8]" /></div><div className="max-h-[65vh] overflow-auto"><table className="w-full min-w-[1050px] text-xs"><thead className="sticky top-0 bg-[#f8fafc]"><tr>{['Row', 'Type', 'Invoice Date', 'Branch', 'Invoice No.', 'Customer', 'Part No.', 'Description from Parts Master', 'Qty', 'Status'].map((heading) => <th key={heading} className="border-b px-2 py-2 text-left text-[10px] uppercase text-[#64748b]">{heading}</th>)}</tr></thead><tbody>{importRows.map((row, index) => <tr key={row.rowNo} className="border-b"><td className="px-2 py-2">{row.rowNo}</td><td className="px-2 py-2">{row.equipment_type || '-'}</td><td className="px-2 py-2">{displayDate(row.invoice_date)}</td><td className="px-2 py-2">{row.branch}</td><td className="px-2 py-2">{row.invoice_no}</td><td className="px-2 py-2">{row.customer_name}</td><td className="px-2 py-2">{row.part_no}</td><td className="px-2 py-2"><input value={row.description} onChange={(e) => updateImportedDescription(index, e.target.value)} className="h-8 w-full min-w-[220px] rounded border px-2" placeholder="Fetched automatically; enter manually only if not found" /></td><td className="px-2 py-2">{row.quantity}</td><td className={`px-2 py-2 font-semibold ${row.errors.length ? 'text-red-700' : 'text-emerald-700'}`}>{row.errors.length ? row.errors.join('; ') : 'Ready'}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t px-4 py-3"><p className="text-xs text-[#64748b]">{allRowsValid ? 'All rows are ready to import.' : 'Correct every invalid row before importing.'}</p><div className="flex gap-2"><button onClick={() => setImportOpen(false)} className="h-9 rounded-md border border-[#cbd5e1] bg-white px-4 text-xs font-semibold text-[#334155]">Cancel</button><button disabled={!allRowsValid || bulkMutation.isPending} onClick={() => bulkMutation.mutate(validRows as Array<ImportRow & { equipment_type: EquipmentType }>)} className="h-9 rounded-md bg-[#0f5fa8] px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#dbe7f1] disabled:text-[#64748b]">{bulkMutation.isPending ? 'Importing…' : `Import ${validRows.length} Entries`}</button></div></div></div></div> : null}
    <ConfirmDialog open={confirmOpen} title="Create installation entry?" message={`Create this ${equipmentType === 'ENGINE' ? 'Engine' : 'Rock Breaker'} entry for ${branch || 'the selected branch'}?`} confirmLabel="Create Entry" busy={mutation.isPending} onCancel={() => setConfirmOpen(false)} onConfirm={confirmCreate} />
  </PageCard>;
}
