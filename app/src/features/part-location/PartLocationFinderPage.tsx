import { FormEvent, useEffect, useMemo, useState } from 'react';
import { MapPin, Plus, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Button } from '../../components/ui/Button';
import { PageCard } from '../../components/ui/PageCard';
import { findPartLocations, type PartLocation } from '../../services/partLocation.service';
import { lookupTestPartByNo, suggestTestParts, type TestPart } from '../../services/testPart.service';

const RECENT_KEY = 'pc-part-location-recent';
const WRITE_ROLES = new Set(['manager', 'admin', 'developer']);

function normalizePartNo(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

function loadRecentSearches() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string').slice(0, 5) : [];
  } catch {
    return [];
  }
}

function rememberPart(partNo: string) {
  const next = [partNo, ...loadRecentSearches().filter((item) => item !== partNo)].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function PartLocationFinderPage() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [partNo, setPartNo] = useState('');
  const [searchedPartNo, setSearchedPartNo] = useState('');
  const [part, setPart] = useState<TestPart | null>(null);
  const [locations, setLocations] = useState<PartLocation[]>([]);
  const [recent, setRecent] = useState<string[]>(() => loadRecentSearches());
  const [isSearching, setIsSearching] = useState(false);
  const [lookupWarning, setLookupWarning] = useState('');
  const [error, setError] = useState('');
  const [suggestions, setSuggestions] = useState<TestPart[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const canManage = useMemo(() => WRITE_ROLES.has(profile?.role ?? ''), [profile?.role]);

  useEffect(() => {
    const query = normalizePartNo(partNo);
    if (query.length < 2 || query === searchedPartNo) {
      setSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    let cancelled = false;
    setIsSuggesting(true);
    const timer = window.setTimeout(() => {
      void suggestTestParts(query)
        .then((items) => {
          if (cancelled) return;
          setSuggestions(items);
          setShowSuggestions(true);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setIsSuggesting(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [partNo, searchedPartNo]);

  async function searchForPart(rawPartNo: string) {
    const normalized = normalizePartNo(rawPartNo);
    if (!normalized) {
      setError('Enter a part number to search.');
      return;
    }

    setPartNo(normalized);
    setSearchedPartNo(normalized);
    setIsSearching(true);
    setError('');
    setLookupWarning('');
    setPart(null);
    setLocations([]);

    const [locationResult, partResult] = await Promise.allSettled([
      findPartLocations(normalized),
      lookupTestPartByNo(normalized),
    ]);

    if (locationResult.status === 'fulfilled') {
      setLocations(locationResult.value);
    } else {
      setError(locationResult.reason instanceof Error ? locationResult.reason.message : 'Location lookup failed.');
    }

    if (partResult.status === 'fulfilled') {
      setPart(partResult.value);
    } else {
      setLookupWarning('Part details are temporarily unavailable. Location results are shown independently.');
    }

    setRecent(rememberPart(normalized));
    setIsSearching(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void searchForPart(partNo);
  }

  return (
    <PageCard eyebrow="Inventory" title="Part Location Finder" description="Find the physical storage location of a part.">
      <div className="mx-auto max-w-3xl space-y-3">
        <form onSubmit={handleSubmit} className="rounded-xl border border-[#d9e2ec] bg-white p-3 shadow-sm">
          <label htmlFor="part-location-search" className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-[#475569]">Part Number</label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
              <input
                id="part-location-search"
                value={partNo}
                onChange={(event) => {
                  setPartNo(event.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => {
                  if (suggestions.length > 0) setShowSuggestions(true);
                }}
                onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
                placeholder="Enter part number"
                autoCapitalize="characters"
                autoComplete="off"
                aria-autocomplete="list"
                aria-expanded={showSuggestions && (isSuggesting || suggestions.length > 0)}
                aria-controls="part-location-suggestions"
                enterKeyHint="search"
                className="h-11 w-full rounded-xl border border-[#cbd5e1] bg-white pl-9 pr-9 text-sm font-bold text-[#0f172a] outline-none transition focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10"
              />
              {partNo ? <button type="button" onClick={() => { setPartNo(''); setSuggestions([]); setShowSuggestions(false); }} aria-label="Clear part number" className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#64748b] hover:bg-[#f1f5f9]"><X className="h-4 w-4" /></button> : null}

              {showSuggestions && (isSuggesting || suggestions.length > 0) ? (
                <div id="part-location-suggestions" role="listbox" className="absolute left-0 right-0 top-[48px] z-30 max-h-72 overflow-y-auto rounded-xl border border-[#d9e2ec] bg-white p-1.5 shadow-xl">
                  {isSuggesting && suggestions.length === 0 ? (
                    <div className="px-3 py-2 text-xs font-semibold text-[#64748b]">Finding matching parts…</div>
                  ) : null}
                  {suggestions.map((item) => (
                    <button
                      key={item.part_no}
                      type="button"
                      role="option"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setPartNo(item.part_no);
                        setSuggestions([]);
                        setShowSuggestions(false);
                        void searchForPart(item.part_no);
                      }}
                      className="block w-full rounded-lg px-3 py-2 text-left hover:bg-[#eef8ff] focus:bg-[#eef8ff] focus:outline-none"
                    >
                      <span className="block text-sm font-black text-[#0f172a]">{item.part_no}</span>
                      {item.description ? <span className="mt-0.5 block truncate text-xs font-semibold text-[#64748b]">{item.description}</span> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <Button type="submit" disabled={isSearching} className="h-11 shrink-0 rounded-xl px-4">{isSearching ? 'Searching…' : 'Search'}</Button>
          </div>

          {!searchedPartNo && recent.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#94a3b8]">Recent</p>
              <div className="flex flex-wrap gap-1.5">
                {recent.map((item) => <button key={item} type="button" onClick={() => void searchForPart(item)} className="rounded-lg border border-[#dbe4ee] bg-[#f8fafc] px-2.5 py-1.5 text-xs font-extrabold text-[#334155] hover:border-[#82C8E5] hover:bg-[#eef8ff]">{item}</button>)}
              </div>
            </div>
          ) : null}
        </form>

        {error ? <div className="rounded-xl border border-[#fecaca] bg-[#fff7f7] px-3 py-2.5 text-sm font-semibold text-[#b91c1c]">{error}</div> : null}
        {lookupWarning ? <div className="rounded-xl border border-[#fde68a] bg-[#fffbeb] px-3 py-2.5 text-xs font-semibold text-[#92400e]">{lookupWarning}</div> : null}

        {searchedPartNo && !isSearching ? (
          <section className="overflow-hidden rounded-xl border border-[#d9e2ec] bg-white shadow-sm">
            <div className="border-b border-[#e2e8f0] p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">Part</p>
                  <h2 className="break-all text-lg font-black text-[#0f172a]">{searchedPartNo}</h2>
                  <p className="mt-0.5 text-sm font-semibold text-[#475569]">{part?.description || 'Part description unavailable'}</p>
                  {part?.dnp != null ? <p className="mt-1 text-xs font-black text-[#0f4c81]">DNP ₹{part.dnp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p> : null}
                </div>
                {canManage ? <Button type="button" variant="secondary" className="shrink-0 rounded-lg px-3 py-2 text-xs" onClick={() => navigate(`/parts/location-finder/manage?partNo=${encodeURIComponent(searchedPartNo)}`)}><Plus className="h-4 w-4" />Add</Button> : null}
              </div>
            </div>

            <div className="p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[#475569]">{locations.length === 1 ? '1 Location Found' : `${locations.length} Locations Found`}</p>
              </div>

              {locations.length > 0 ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {locations.map((item) => (
                    <div key={item.id} className="flex min-h-[64px] items-center gap-3 rounded-xl border border-[#dbe4ee] bg-[#f8fbff] px-3 py-2.5">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e6f4ff] text-[#0f4c81]"><MapPin className="h-4 w-4" /></span>
                      <p className="break-words text-base font-black leading-tight text-[#0f172a]">{item.location}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-4 py-6 text-center">
                  <MapPin className="mx-auto h-6 w-6 text-[#94a3b8]" />
                  <p className="mt-2 text-sm font-black text-[#334155]">No location recorded</p>
                  <p className="mt-1 text-xs font-semibold text-[#64748b]">This part does not yet have an active physical location in Parts Connect.</p>
                  {canManage ? <Button type="button" className="mt-3 rounded-lg px-3 py-2 text-xs" onClick={() => navigate(`/parts/location-finder/manage?partNo=${encodeURIComponent(searchedPartNo)}`)}><Plus className="h-4 w-4" />Add Location</Button> : null}
                </div>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </PageCard>
  );
}
