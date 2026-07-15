import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Plus, Search } from 'lucide-react';
import { ensureSalesEmployeeName, searchSalesEmployees } from '../../services/salesEmployee.service';

type Props = {
  value: string;
  onChange: (value: string) => void;
  inputClassName: string;
};

export function SalesEmployeeAutocomplete({ value, onChange, inputClassName }: Props) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const normalized = value.trim().replace(/\s+/g, ' ').toUpperCase();

  const employeeQuery = useQuery({
    queryKey: ['sales-employees', normalized],
    queryFn: () => searchSalesEmployees(normalized),
    enabled: open && normalized.length >= 2,
    staleTime: 60_000,
  });

  const exactMatch = useMemo(
    () => (employeeQuery.data ?? []).some((employee) => employee.name === normalized),
    [employeeQuery.data, normalized],
  );

  const addMutation = useMutation({
    mutationFn: ensureSalesEmployeeName,
    onSuccess: async (name) => {
      onChange(name);
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['sales-employees'] });
    },
  });

  function choose(name: string) {
    onChange(name);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          className={`${inputClassName} pl-10`}
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            onChange(event.target.value.toUpperCase());
            setOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 160)}
          placeholder="Type at least 2 letters"
          autoComplete="off"
        />
      </div>

      {open && normalized.length >= 2 ? (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          {employeeQuery.isLoading ? <p className="px-3 py-2 text-xs font-semibold text-slate-500">Searching employees…</p> : null}
          {(employeeQuery.data ?? []).map((employee) => (
            <button
              key={employee.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-800 hover:bg-blue-50 hover:text-blue-700"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(employee.name)}
            >
              <span>{employee.name}</span>
              {employee.name === normalized ? <Check className="h-4 w-4 text-emerald-600" /> : null}
            </button>
          ))}

          {!employeeQuery.isLoading && !exactMatch && normalized.length >= 2 ? (
            <button
              type="button"
              className="mt-1 flex w-full items-center gap-2 rounded-lg border border-dashed border-blue-300 bg-blue-50 px-3 py-2 text-left text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => addMutation.mutate(normalized)}
              disabled={addMutation.isPending}
            >
              <Plus className="h-4 w-4" />
              {addMutation.isPending ? 'Adding…' : `Add “${normalized}”`}
            </button>
          ) : null}

          {!employeeQuery.isLoading && (employeeQuery.data ?? []).length === 0 && exactMatch ? (
            <p className="px-3 py-2 text-xs font-semibold text-slate-500">No other matching names.</p>
          ) : null}

          {addMutation.error ? <p className="px-3 py-2 text-xs font-semibold text-red-600">Could not add this name.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
