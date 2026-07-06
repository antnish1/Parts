import { Fragment, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { PageCard } from '../../components/ui/PageCard';
import { lookupTestDocketRows, normalizeDocketNo, receiveTestDocketRow, type TestDocketRow } from '../../services/testDocket.service';
import { StatusBadge } from '../../components/tables/StatusBadge';
import { getStatusRowClasses } from '../../lib/statusRowStyles';

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorCtor;
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function effectiveQty(row: TestDocketRow) {
  return Number(row.edited_qty ?? row.ordered_qty ?? 0);
}

function statusKey(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function rowKey(row: TestDocketRow) {
  return `${row.source_type}-${row.id}`;
}

export function DocketScannerPage() {
  const [docketNo, setDocketNo] = useState('');
  const [scannerStatus, setScannerStatus] = useState('Idle');
  const [rows, setRows] = useState<TestDocketRow[]>([]);
  const [busyId, setBusyId] = useState('');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const lastScanRef = useRef('');
  const lastScanAtRef = useRef(0);

  async function lookupRows(valueOverride?: string) {
    const value = normalizeDocketNo(valueOverride || docketNo);
    setScannerStatus(value ? `Searching docket ${value}...` : 'Enter or scan docket number.');
    if (!value) return;
    try {
      const result = await lookupTestDocketRows(value);
      setRows(result);
      setExpandedRows({});
      setScannerStatus(result.length ? `${result.length} matching docket row(s) found.` : 'No matching docket rows found.');
    } catch (error) {
      setScannerStatus(error instanceof Error ? error.message : 'Lookup failed.');
    }
  }

  function stopScanner() {
    if (scanTimerRef.current) window.clearInterval(scanTimerRef.current);
    scanTimerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsScanning(false);
    setScannerStatus('Scanner stopped.');
  }

  async function startScanner() {
    if (!window.BarcodeDetector) {
      setScannerStatus('BarcodeDetector is not supported on this browser. Use manual docket search.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'] });
      setIsScanning(true);
      setScannerStatus('Scanner running. Point camera at docket barcode.');
      scanTimerRef.current = window.setInterval(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;
        detector.detect(video).then((codes) => {
          const raw = normalizeDocketNo(codes[0]?.rawValue ?? '');
          if (!raw) return;
          const now = Date.now();
          if (lastScanRef.current === raw && now - lastScanAtRef.current < 2500) return;
          lastScanRef.current = raw;
          lastScanAtRef.current = now;
          setDocketNo(raw);
          setScannerStatus(`Detected ${raw}. Searching docket rows...`);
          void lookupRows(raw);
        }).catch(() => undefined);
      }, 700);
    } catch (error) {
      setScannerStatus(error instanceof Error ? error.message : 'Unable to start camera.');
      stopScanner();
    }
  }

  useEffect(() => () => stopScanner(), []);

  async function receiveRow(row: TestDocketRow) {
    const key = rowKey(row);
    setBusyId(key);
    setScannerStatus(`Receiving ${row.part_no} from docket ${row.docket_no || docketNo}...`);
    try {
      await receiveTestDocketRow(row);
      setScannerStatus(`${row.part_no}: billed quantity marked as received.`);
      await lookupRows(row.docket_no || docketNo);
    } catch (error) {
      setScannerStatus(error instanceof Error ? error.message : 'Receive update failed.');
    } finally {
      setBusyId('');
    }
  }

  function toggleRow(id: string) {
    setExpandedRows((current) => ({ ...current, [id]: !current[id] }));
  }

  return (
    <PageCard eyebrow="Docket" title="Docket Scanner" description="Scan or enter only a docket number, then receive the matching billing rows.">
      <div className="grid gap-3 xl:grid-cols-[0.7fr_1.3fr]">
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Scanner Control</p>
          <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-lg border border-dashed border-[#6D8196] bg-[#111827] text-center text-xs text-[#c7d2df]"><video ref={videoRef} className="h-full w-full object-cover" muted playsInline />{!isScanning ? <span className="absolute">Camera scanner area<br />Manual docket search is active</span> : null}</div>
          <div className="mt-3 flex gap-2"><button className="text-xs font-black text-[#82C8E5] hover:underline disabled:opacity-40" disabled={isScanning} onClick={() => void startScanner()}>Start Scanner</button><button className="text-xs font-black text-[#ef6f7b] hover:underline disabled:opacity-40" disabled={!isScanning} onClick={stopScanner}>Stop Scanner</button></div>
          <p className="mt-2 text-xs text-[#c7d2df]">Status: {scannerStatus}</p>
        </div>

        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Docket Row Receive</p>
          <div className="grid gap-2 lg:grid-cols-[1fr_auto]">
            <input className="rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={docketNo} onChange={(event) => setDocketNo(normalizeDocketNo(event.target.value))} placeholder="Enter docket number only" onKeyDown={(event) => { if (event.key === 'Enter') void lookupRows(); }} />
            <button className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => void lookupRows()}>Search Docket</button>
          </div>
          <p className="mt-2 text-[11px] text-[#c7d2df]">This page searches docket rows only. Order number, machine number and customer search are not used here.</p>
          <div className="mt-3 overflow-x-auto rounded-md border border-[#263244]">
            <table className="w-full min-w-[1160px] border-collapse text-left text-xs">
              <thead className="bg-[#111827] text-[10px] uppercase tracking-[0.12em] text-[#c7d2df]">
                <tr><th className="px-2 py-2">View</th><th className="px-2 py-2">Docket</th><th className="px-2 py-2">Invoice</th><th className="px-2 py-2">Part</th><th className="px-2 py-2">Description</th><th className="px-2 py-2 text-right">Billed</th><th className="px-2 py-2 text-right">Received</th><th className="px-2 py-2">Order</th><th className="px-2 py-2">Branch</th><th className="px-2 py-2">Row Status</th><th className="px-2 py-2 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-[#263244] bg-[#111827]">
                {rows.map((row) => {
                  const status = statusKey(row.item_status || row.order_status);
                  const isReceived = (row.billed_qty > 0 && row.received_qty >= row.billed_qty) || status === 'received' || status === 'issued';
                  const key = rowKey(row);
                  const isExpanded = !!expandedRows[key];
                  return (
                    <Fragment key={key}>
                      <tr className={getStatusRowClasses(row.item_status || row.order_status)}>
                        <td className="px-2 py-2"><button className="inline-flex items-center gap-1 text-xs font-black text-[#82C8E5] hover:underline" onClick={() => toggleRow(key)}>{isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} View</button></td>
                        <td className="px-2 py-2 font-black text-white">{row.docket_no || '-'}</td>
                        <td className="px-2 py-2 text-[#d8e3ee]">{row.invoice_no || '-'}</td>
                        <td className="px-2 py-2 font-black text-[#82C8E5]">{row.part_no}</td>
                        <td className="px-2 py-2 text-[#d8e3ee]">{row.description || '-'}</td>
                        <td className="px-2 py-2 text-right font-black text-white">{row.billed_qty}</td>
                        <td className="px-2 py-2 text-right text-[#d8e3ee]">{row.received_qty}</td>
                        <td className="px-2 py-2 text-[#d8e3ee]">{row.final_order_no || row.order_no}</td>
                        <td className="px-2 py-2 text-[#d8e3ee]">{row.branch}</td>
                        <td className="px-2 py-2"><StatusBadge status={row.item_status || row.order_status} /></td>
                        <td className="px-2 py-2 text-right"><button className="font-black text-[#82C8E5] hover:underline disabled:text-[#6D8196] disabled:no-underline" disabled={busyId === key || isReceived} onClick={() => void receiveRow(row)}>{busyId === key ? 'Saving' : isReceived ? 'Received' : 'Receive'}</button></td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={11} className="bg-[#0b1020] px-4 py-3">
                            <div className="grid gap-2 text-xs md:grid-cols-2 xl:grid-cols-4">
                              <div className="rounded-md border border-[#263244] bg-[#111827] p-2"><p className="text-[10px] uppercase text-[#6D8196]">Order No</p><p className="font-black text-white">{row.order_no}</p></div>
                              <div className="rounded-md border border-[#263244] bg-[#111827] p-2"><p className="text-[10px] uppercase text-[#6D8196]">Customer / Machine</p><p className="font-black text-white">{row.customer_name || '-'} / {row.machine_no || '-'}</p></div>
                              <div className="rounded-md border border-[#263244] bg-[#111827] p-2"><p className="text-[10px] uppercase text-[#6D8196]">Qty</p><p className="font-black text-white">Ordered {effectiveQty(row)} • Billed {row.billed_qty} • Received {row.received_qty}</p></div>
                              <div className="rounded-md border border-[#263244] bg-[#111827] p-2"><p className="text-[10px] uppercase text-[#6D8196]">Transport</p><p className="font-black text-white">{row.transport_name || '-'} • {row.delivery_no || '-'}</p></div>
                              <div className="rounded-md border border-[#263244] bg-[#111827] p-2"><p className="text-[10px] uppercase text-[#6D8196]">Billing Date</p><p className="font-black text-white">{row.billing_date || '-'}</p></div>
                              <div className="rounded-md border border-[#263244] bg-[#111827] p-2"><p className="text-[10px] uppercase text-[#6D8196]">Received At</p><p className="font-black text-white">{formatDate(row.received_at)}</p></div>
                              <div className="rounded-md border border-[#263244] bg-[#111827] p-2"><p className="text-[10px] uppercase text-[#6D8196]">Order Status</p><StatusBadge status={row.order_status} /></div>
                              <div className="rounded-md border border-[#263244] bg-[#111827] p-2"><p className="text-[10px] uppercase text-[#6D8196]">Open Order</p><Link className="font-black text-[#82C8E5] hover:underline" to={`/orders/${row.order_id}`}>Open full order detail</Link></div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 ? <p className="p-2.5 text-xs text-[#c7d2df]">No docket rows loaded yet.</p> : null}
          </div>
        </div>
      </div>
    </PageCard>
  );
}
