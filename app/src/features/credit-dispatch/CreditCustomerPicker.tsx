import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, ShieldAlert } from 'lucide-react';
import { formatMoney } from '../../services/creditDispatch.service';
import { riskTone, searchCreditCustomers, type CustomerSuggestion } from '../../services/creditCustomer.service';

export function CreditCustomerPicker({ value, onChange, onSelect }: { value: string; onChange: (value: string) => void; onSelect: (customer: CustomerSuggestion) => void }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<CustomerSuggestion | null>(null);
  const query = useQuery({ queryKey: ['credit-customer-search', value], queryFn: () => searchCreditCustomers(value), enabled: value.trim().length >= 2 });
  const suggestions = query.data ?? [];

  return (
    <div className="relative">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.13em] text-slate-500">Customer Name <span className="text-red-500">*</span></span>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100">
          <Search className="h-4 w-4 text-slate-400" />
          <input className="min-w-0 flex-1 bg-transparent text-base font-medium text-slate-900 outline-none placeholder:text-slate-300" value={value} onFocus={() => setOpen(true)} onChange={(event) => { onChange(event.target.value); setSelected(null); setOpen(true); }} placeholder="Type customer name or mobile" />
        </div>
      </label>
      {open && value.trim().length >= 2 ? (
        <div className="absolute z-50 mt-2 max-h-80 w-full overflow-auto rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl">
          {query.isLoading ? <p className="p-3 text-sm font-medium text-slate-500">Searching...</p> : suggestions.length === 0 ? <p className="p-3 text-sm font-medium text-slate-500">No matching customer. New customer will be created.</p> : suggestions.map((customer) => (
            <button key={customer.customer_id} type="button" className="w-full rounded-2xl p-3 text-left transition hover:bg-blue-50" onMouseDown={(event) => event.preventDefault()} onClick={() => { setSelected(customer); onSelect(customer); setOpen(false); }}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{customer.customer_name}</p><p className="mt-1 text-xs font-medium text-slate-500">{customer.mobile_no} • {customer.default_branch ?? '-'}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${riskTone(customer.risk_category)}`}>{customer.risk_category}</span></div>
              <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-2 text-center"><div><p className="text-[10px] uppercase text-slate-400">Due</p><p className="text-xs font-semibold text-red-700">{formatMoney(customer.outstanding)}</p></div><div><p className="text-[10px] uppercase text-slate-400">Overdue</p><p className="text-xs font-semibold text-red-700">{formatMoney(customer.overdue)}</p></div><div><p className="text-[10px] uppercase text-slate-400">Paid</p><p className="text-xs font-semibold text-emerald-700">{formatMoney(customer.total_received)}</p></div></div>
              {customer.overdue > 0 ? <p className="mt-2 flex items-center gap-1 text-xs font-medium text-red-700"><ShieldAlert className="h-3.5 w-3.5" />Overdue balance exists</p> : null}
            </button>
          ))}
        </div>
      ) : null}
      {selected ? <div className="mt-3 rounded-3xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-slate-900">Selected Customer</p><p className="mt-1 text-xs font-medium text-slate-500">{selected.mobile_no} • {selected.default_branch ?? '-'}</p></div><span className={`rounded-full border px-2 py-1 text-[10px] font-medium ${riskTone(selected.risk_category)}`}>{selected.risk_category}</span></div><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded-2xl bg-white p-2"><p className="text-[10px] uppercase text-slate-400">Outstanding</p><p className="text-xs font-semibold text-red-700">{formatMoney(selected.outstanding)}</p></div><div className="rounded-2xl bg-white p-2"><p className="text-[10px] uppercase text-slate-400">Overdue</p><p className="text-xs font-semibold text-red-700">{formatMoney(selected.overdue)}</p></div><div className="rounded-2xl bg-white p-2"><p className="text-[10px] uppercase text-slate-400">Paid</p><p className="text-xs font-semibold text-emerald-700">{formatMoney(selected.total_received)}</p></div></div>{selected.overdue > 0 ? <p className="mt-3 flex items-center gap-2 rounded-2xl bg-red-50 p-3 text-xs font-medium text-red-700"><ShieldAlert className="h-4 w-4" />Customer has overdue balance. Manager should review before approval.</p> : null}<Link to={'/credit-dispatch/customers/ledger?id=' + selected.customer_id} className="mt-3 inline-flex text-xs font-medium text-blue-700">View ledger</Link></div> : null}
    </div>
  );
}
