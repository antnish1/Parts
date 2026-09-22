import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { FileText, Plus, Search, Upload, X } from 'lucide-react';
import { PageCard } from '../../components/ui/PageCard';
import {
  createInstallationInvoice,
  findPartMasterMatches,
  getInstallationInvoiceDocumentUrl,
  listInstallationInvoices,
  type EquipmentType,
  type PartMasterMatch,
} from '../../services/installations.service';

const today = new Date().toISOString().slice(0, 10);
const norm = (value: string) => value.trim().toUpperCase();

export function InstallationInvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [jcbInvoiceNo, setJcbInvoiceNo] = useState('');
  const [partNo, setPartNo] = useState('');
  const [description, setDescription] = useState('');
  const [equipmentType, setEquipmentType] = useState<EquipmentType>('ENGINE');
  const [serialNo, setSerialNo] = useState('');
  const [dbmsNo, setDbmsNo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [matches, setMatches] = useState<PartMasterMatch[]>([]);
  const [partLoading, setPartLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');

  const invoices = useQuery({
    queryKey: ['installation-invoices'],
    queryFn: listInstallationInvoices,
    staleTime: 15000,
    refetchOnWindowFocus: true,
  });

  const saveMutation = useMutation({
    mutationFn: createInstallationInvoice,
    onSuccess: async () => {
      setMessage('Invoice saved successfully.');
      setInvoiceDate(today);
      setJcbInvoiceNo('');
      setPartNo('');
      setDescription('');
      setEquipmentType('ENGINE');
      setSerialNo('');
      setDbmsNo('');
      setFile(null);
      setMatches([]);
      setDropdownOpen(false);
      setExpanded(false);
      await queryClient.invalidateQueries({ queryKey: ['installation-invoices'] });
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : 'Could not save invoice.'),
  });

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

  function save() {
    setMessage('');
    if (!invoiceDate || !jcbInvoiceNo.trim() || !partNo.trim() || !description.trim() || !serialNo.trim() || !file) {
      setMessage('Complete Date, JCB Invoice No., Part No., Type, Serial No. and JCB Invoice upload.');
      return;
    }
    saveMutation.mutate({
      invoice_date: invoiceDate,
      jcb_invoice_no: norm(jcbInvoiceNo),
      part_no: norm(partNo),
      description: description.trim(),
      equipment_type: equipmentType,
      serial_no: norm(serialNo),
      dbms_no: norm(dbmsNo),
      file,
    });
  }

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (invoices.data ?? []).filter((row) => !needle || [
      row.jcb_invoice_no,
      row.part_no,
      row.serial_no,
      row.dbms_no,
      row.equipment_type,
    ].some((value) => String(value ?? '').toLowerCase().includes(needle)));
  }, [invoices.data, search]);

  const dropdown = inputRef.current?.getBoundingClientRect();

  return <PageCard eyebrow="Engine & Breaker" title="Invoice" description="">
    <div className="flex items-center justify-between gap-3 border-b border-[#d8e0ea] pb-3">
      <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[#0b1f3a]">Invoice Management</h2>
      <button type="button" onClick={() => setExpanded((value) => !value)} className="inline-flex h-9 items-center gap-2 rounded-md bg-[#0f5fa8] px-4 text-xs font-semibold text-white hover:bg-[#0b4d8a]">
        {expanded ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{expanded ? 'Close' : 'Add'}
      </button>
    </div>

    {expanded ? <section className="mt-3 rounded-xl border border-[#d8e0ea] bg-white p-4">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#334155]">Add Invoice</h3>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs font-semibold text-[#334155]">Date *
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="mt-1 h-10 w-full rounded-md border border-[#cbd5e1] px-3 text-sm" />
        </label>
        <label className="text-xs font-semibold text-[#334155]">JCB Invoice No. *
          <input value={jcbInvoiceNo} onChange={(e) => setJcbInvoiceNo(e.target.value.toUpperCase())} className="mt-1 h-10 w-full rounded-md border border-[#cbd5e1] px-3 text-sm uppercase" />
        </label>
        <label className="relative text-xs font-semibold text-[#334155]">Part No. *
          <div className="relative mt-1"><Search className="absolute left-2.5 top-3 h-3.5 w-3.5 text-[#64748b]" /><input ref={inputRef} value={partNo} onFocus={() => partNo.length >= 2 && setDropdownOpen(true)} onChange={(e) => changePart(e.target.value)} placeholder="Start typing part no." className="h-10 w-full rounded-md border border-[#cbd5e1] pl-8 pr-2 text-sm uppercase" /></div>
          {description ? <span className="mt-1 block truncate text-[10px] font-normal text-[#64748b]">{description}</span> : null}
        </label>
        <label className="text-xs font-semibold text-[#334155]">Type *
          <select value={equipmentType} onChange={(e) => setEquipmentType(e.target.value as EquipmentType)} className="mt-1 h-10 w-full rounded-md border border-[#cbd5e1] bg-white px-3 text-sm">
            <option value="ENGINE">Engine</option>
            <option value="ROCK_BREAKER">Rock Breaker</option>
          </select>
        </label>
        <label className="text-xs font-semibold text-[#334155]">Serial No. *
          <input value={serialNo} onChange={(e) => setSerialNo(e.target.value.toUpperCase())} className="mt-1 h-10 w-full rounded-md border border-[#cbd5e1] px-3 text-sm uppercase" />
        </label>
        <label className="text-xs font-semibold text-[#334155]">DBMS No.
          <input value={dbmsNo} onChange={(e) => setDbmsNo(e.target.value.toUpperCase())} className="mt-1 h-10 w-full rounded-md border border-[#cbd5e1] px-3 text-sm uppercase" />
        </label>
        <label className="text-xs font-semibold text-[#334155] md:col-span-2">JCB Invoice *
          <span className="mt-1 flex h-10 cursor-pointer items-center gap-2 rounded-md border border-[#cbd5e1] bg-[#f8fafc] px-3 text-sm font-medium text-[#334155]"><Upload className="h-4 w-4 text-[#0f5fa8]" /><span className="min-w-0 flex-1 truncate">{file?.name ?? 'Upload PDF / JPG / PNG / WEBP'}</span><input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></span>
        </label>
      </div>
      <div className="mt-4 flex justify-end"><button type="button" disabled={saveMutation.isPending} onClick={save} className="h-9 rounded-md bg-[#0f5fa8] px-6 text-xs font-semibold text-white disabled:opacity-50">{saveMutation.isPending ? 'Saving…' : 'Save'}</button></div>
    </section> : null}

    {dropdownOpen && dropdown ? createPortal(<div style={{ position: 'fixed', left: dropdown.left, top: dropdown.bottom + 4, width: Math.max(dropdown.width, 360), zIndex: 9999 }} className="max-h-72 overflow-y-auto rounded-lg border border-[#b9cee2] bg-white shadow-2xl">
      {partLoading ? <p className="px-3 py-3 text-xs text-[#64748b]">Searching Parts Master…</p> : matches.length ? matches.map((match) => <button type="button" key={match.part_no} onMouseDown={(e) => e.preventDefault()} onClick={() => choosePart(match)} className="block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-[#eef7ff]"><strong className="block text-sm text-[#075fb8]">{match.part_no}</strong><span className="mt-0.5 block text-xs text-[#64748b]">{match.description || 'No description'}</span></button>) : <p className="px-3 py-3 text-xs text-[#64748b]">No matching part.</p>}
    </div>, document.body) : null}

    {message ? <p className="mt-3 rounded-md border border-[#d8e0ea] bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#334155]">{message}</p> : null}

    <section className="mt-3 overflow-hidden rounded-xl border border-[#d8e0ea] bg-white">
      <div className="flex flex-col gap-2 border-b bg-[#f8fafc] px-3 py-3 md:flex-row md:items-center md:justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[#334155]">Invoice Details</h3>
        <label className="relative w-full md:max-w-md"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#64748b]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice, part, serial or DBMS no." className="h-9 w-full rounded-md border border-[#cbd5e1] bg-white pl-8 pr-3 text-xs" /></label>
      </div>
      {invoices.isLoading ? <p className="p-5 text-center text-xs text-[#64748b]">Loading invoice details…</p> : invoices.error ? <p className="p-5 text-center text-xs text-red-700">Could not load invoice details.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-xs">
        <thead className="bg-[#eaf0f6] text-[10px] uppercase text-[#334155]"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">JCB Invoice No.</th><th className="px-3 py-2">Part No.</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Serial No.</th><th className="px-3 py-2">DBMS No.</th><th className="px-3 py-2">JCB Invoice</th><th className="px-3 py-2 text-right">Action</th></tr></thead>
        <tbody>{filtered.map((row) => <tr key={row.id} className="border-b last:border-0">
          <td className="px-3 py-2">{new Date(row.invoice_date).toLocaleDateString('en-IN')}</td>
          <td className="px-3 py-2 font-semibold text-[#0f172a]">{row.jcb_invoice_no}</td>
          <td className="px-3 py-2 font-semibold text-[#075fb8]">{row.part_no}</td>
          <td className="px-3 py-2">{row.equipment_type === 'ROCK_BREAKER' ? 'Rock Breaker' : 'Engine'}</td>
          <td className="px-3 py-2">{row.serial_no}</td>
          <td className="px-3 py-2">{row.dbms_no || '-'}</td>
          <td className="px-3 py-2"><button type="button" onClick={async () => window.open(await getInstallationInvoiceDocumentUrl(row.document_path), '_blank', 'noopener,noreferrer')} className="inline-flex items-center gap-1 font-semibold text-[#075fb8]"><FileText className="h-3.5 w-3.5" />{row.document_name}</button></td>
          <td className="px-3 py-2 text-right">{row.installation_id ? <button type="button" onClick={() => navigate(`/installations/${row.installation_id}`)} className="h-8 rounded-md border border-[#b9cee2] bg-[#eef7ff] px-3 text-[11px] font-semibold text-[#0b4d8a]">Registered</button> : <button type="button" onClick={() => navigate(`/installations/new?invoice=${row.id}`)} className="h-8 rounded-md bg-[#0f5fa8] px-3 text-[11px] font-semibold text-white">Register</button>}</td>
        </tr>)}</tbody>
      </table>{filtered.length === 0 ? <p className="p-5 text-center text-xs text-[#64748b]">No invoice details found.</p> : null}</div>}
    </section>
  </PageCard>;
}
