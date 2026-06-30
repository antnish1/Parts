import { useState } from 'react';
import { PageCard } from '../../components/ui/PageCard';

export function DocketScannerPage() {
  const [docketNo, setDocketNo] = useState('');
  const [scannerStatus, setScannerStatus] = useState('Idle');

  return (
    <PageCard eyebrow="Docket" title="Docket Scanner" description="Scan or enter docket details for order processing.">
      <div className="grid gap-3 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Scanner Control</p>
          <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-[#6D8196] bg-[#111827] text-center text-xs text-[#c7d2df]">
            Camera scanner area
          </div>
          <div className="mt-3 flex gap-2">
            <button className="text-xs font-black text-[#82C8E5] hover:underline" onClick={() => setScannerStatus('Scanner ready')}>Start Scanner</button>
            <button className="text-xs font-black text-[#ef6f7b] hover:underline" onClick={() => setScannerStatus('Scanner stopped')}>Stop Scanner</button>
          </div>
          <p className="mt-2 text-xs text-[#c7d2df]">Status: {scannerStatus}</p>
        </div>

        <div className="rounded-lg border border-[#263244] bg-[#0b1020] p-3">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-[#82C8E5]">Manual Entry</p>
          <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-[#6D8196]">Docket Number</label>
          <input className="w-full rounded-md border border-[#263244] bg-[#111827] px-2.5 py-1.5 text-xs text-white outline-none focus:border-[#82C8E5]" value={docketNo} onChange={(event) => setDocketNo(event.target.value)} placeholder="Enter docket number" />
          <div className="mt-3 rounded-md border border-[#263244] bg-[#111827] p-2.5 text-xs text-[#c7d2df]">
            <p className="font-black text-white">Pending integration</p>
            <p className="mt-1">Next step: connect docket number to order lookup and status update workflow.</p>
            {docketNo ? <p className="mt-2 text-[#82C8E5]">Current docket: {docketNo}</p> : null}
          </div>
        </div>
      </div>
    </PageCard>
  );
}
