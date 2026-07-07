import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export function RequestReportsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-20">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <Link to="/credit-dispatch" className="mb-2 inline-flex items-center gap-2 text-sm font-black text-slate-500"><ArrowLeft className="h-4 w-4" />Back</Link>
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-600">Credit Dispatch</p>
        <h1 className="text-xl font-black text-slate-950">Reports</h1>
        <p className="mt-1 text-sm font-semibold text-slate-500">Branch and status reporting will appear here.</p>
      </div>
    </div>
  );
}
