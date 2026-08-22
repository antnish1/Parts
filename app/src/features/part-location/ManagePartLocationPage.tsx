import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MapPin, Plus, Search, Trash2 } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { PageCard } from '../../components/ui/PageCard';
import { addPartLocation, deactivatePartLocation, findPartLocations, getKnownPartLocations, type PartLocation } from '../../services/partLocation.service';
import { lookupTestPartByNo, type TestPart } from '../../services/testPart.service';

function normalizePartNo(value: string) {
  return value.trim().replace(/\s+/g, '').toUpperCase();
}

export function ManagePartLocationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialPartNo = normalizePartNo(searchParams.get('partNo') || '');
  const [partNo, setPartNo] = useState(initialPartNo);
  const [verifiedPartNo, setVerifiedPartNo] = useState('');
  const [part, setPart] = useState<TestPart | null>(null);
  const [locations, setLocations] = useState<PartLocation[]>([]);
  const [location, setLocation] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canAdd = useMemo(() => Boolean(verifiedPartNo && location.trim() && !isSaving), [verifiedPartNo, location, isSaving]);

  async function verifyPart(rawPartNo = partNo) {
    const normalized = normalizePartNo(rawPartNo);
    if (!normalized) {
      setError('Enter a part number first.');
      return;
    }

    setPartNo(normalized);
    setVerifiedPartNo('');
    setPart(null);
    setLocations([]);
    setMessage('');
    setError('');
    setIsVerifying(true);

    const [partResult, locationResult] = await Promise.allSettled([
      lookupTestPartByNo(normalized),
      findPartLocations(normalized),
    ]);

    if (partResult.status === 'fulfilled') setPart(partResult.value);
    if (locationResult.status === 'fulfilled') setLocations(locationResult.value);
    if (locationResult.status === 'rejected') {
      setError(locationResult.reason instanceof Error ? locationResult.reason.message : 'Unable to load current locations.');
      setIsVerifying(false);
      return;
    }

    setVerifiedPartNo(normalized);
    if (partResult.status === 'rejected' || !partResult.value) {
      setMessage('Part was not found in Parts Master. You can still assign a physical location after verifying the part number.');
    }
    setIsVerifying(false);
  }

  useEffect(() => {
    if (initialPartNo) void verifyPart(initialPartNo);
    // Run only for the part number carried from the finder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const term = location.trim();
    if (!term) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void getKnownPartLocations(term)
        .then(setSuggestions)
        .catch(() => setSuggestions([]));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [location]);

  function handleVerify(event: FormEvent) {
    event.preventDefault();
    void verifyPart();
  }

  async function handleAdd(event: FormEvent) {
    event.preventDefault();
    if (!canAdd) return;

    setIsSaving(true);
    setError('');
    setMessage('');
    try {
      await addPartLocation(verifiedPartNo, location);
      const refreshed = await findPartLocations(verifiedPartNo);
      setLocations(refreshed);
      setMessage(`${location.trim()} added to ${verifiedPartNo}.`);
      setLocation('');
      setSuggestions([]);
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Unable to add location.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove(item: PartLocation) {
    if (!window.confirm(`Remove ${item.location} from ${verifiedPartNo}? The history will be retained.`)) return;
    setRemovingId(item.id);
    setError('');
    setMessage('');
    try {
      await deactivatePartLocation(item.id);
      setLocations((current) => current.filter((row) => row.id !== item.id));
      setMessage(`${item.location} removed from the active locations.`);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Unable to remove location.');
    } finally {
      setRemovingId('');
    }
  }

  return (
    <PageCard eyebrow="Inventory" title="Manage Part Location" description="Add or remove physical storage locations for a part.">
      <div className="mx-auto max-w-3xl space-y-3">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-black text-[#475569] hover:bg-[#eaf2f8] hover:text-[#0f172a]"><ArrowLeft className="h-4 w-4" />Back</button>

        <form onSubmit={handleVerify} className="rounded-xl border border-[#d9e2ec] bg-white p-3 shadow-sm">
          <label htmlFor="manage-part-no" className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-[#475569]">Part Number</label>
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#64748b]" />
              <input id="manage-part-no" value={partNo} onChange={(event) => { setPartNo(event.target.value); setVerifiedPartNo(''); }} autoCapitalize="characters" enterKeyHint="search" placeholder="Enter part number" className="h-11 w-full rounded-xl border border-[#cbd5e1] bg-white pl-9 pr-3 text-sm font-bold text-[#0f172a] outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10" />
            </div>
            <Button type="submit" disabled={isVerifying} className="h-11 shrink-0 rounded-xl px-4">{isVerifying ? 'Checking…' : 'Verify'}</Button>
          </div>
        </form>

        {error ? <div className="rounded-xl border border-[#fecaca] bg-[#fff7f7] px-3 py-2.5 text-sm font-semibold text-[#b91c1c]">{error}</div> : null}
        {message ? <div className="rounded-xl border border-[#bae6c7] bg-[#f0fdf4] px-3 py-2.5 text-sm font-semibold text-[#166534]">{message}</div> : null}

        {verifiedPartNo ? (
          <>
            <section className="rounded-xl border border-[#d9e2ec] bg-white p-3 shadow-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">Verified Part</p>
              <h2 className="break-all text-lg font-black text-[#0f172a]">{verifiedPartNo}</h2>
              <p className="mt-0.5 text-sm font-semibold text-[#475569]">{part?.description || 'Part details unavailable in Parts Master'}</p>
              {part?.dnp != null ? <p className="mt-1 text-xs font-black text-[#0f4c81]">DNP ₹{part.dnp.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p> : null}
            </section>

            <form onSubmit={handleAdd} className="rounded-xl border border-[#d9e2ec] bg-white p-3 shadow-sm">
              <label htmlFor="part-location-input" className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.12em] text-[#475569]">Location</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-[14px] h-4 w-4 text-[#64748b]" />
                <input id="part-location-input" value={location} onChange={(event) => setLocation(event.target.value)} autoComplete="off" placeholder="Search or enter location" className="h-11 w-full rounded-xl border border-[#cbd5e1] bg-white pl-9 pr-3 text-sm font-bold text-[#0f172a] outline-none focus:border-[#0f4c81] focus:ring-2 focus:ring-[#0f4c81]/10" />
                {suggestions.length > 0 ? (
                  <div className="absolute left-0 right-0 top-[48px] z-20 max-h-52 overflow-y-auto rounded-xl border border-[#d9e2ec] bg-white p-1.5 shadow-xl">
                    {suggestions.map((item) => <button key={item} type="button" onClick={() => { setLocation(item); setSuggestions([]); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-[#334155] hover:bg-[#eef8ff]">{item}</button>)}
                  </div>
                ) : null}
              </div>
              <Button type="submit" disabled={!canAdd} className="mt-3 w-full rounded-xl sm:w-auto"><Plus className="h-4 w-4" />{isSaving ? 'Adding…' : 'Add Location'}</Button>
            </form>

            <section className="rounded-xl border border-[#d9e2ec] bg-white p-3 shadow-sm">
              <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#475569]">Current Locations ({locations.length})</p>
              {locations.length > 0 ? (
                <div className="space-y-2">
                  {locations.map((item) => (
                    <div key={item.id} className="flex min-h-[56px] items-center justify-between gap-3 rounded-xl border border-[#dbe4ee] bg-[#f8fbff] px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2.5"><MapPin className="h-4 w-4 shrink-0 text-[#0f4c81]" /><p className="break-words text-sm font-black text-[#0f172a]">{item.location}</p></div>
                      <button type="button" disabled={removingId === item.id} onClick={() => void handleRemove(item)} aria-label={`Remove ${item.location}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#fecaca] bg-white text-[#dc2626] hover:bg-[#fff1f2] disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              ) : <p className="rounded-xl border border-dashed border-[#cbd5e1] bg-[#f8fafc] px-3 py-5 text-center text-xs font-semibold text-[#64748b]">No active locations yet.</p>}
            </section>
          </>
        ) : null}
      </div>
    </PageCard>
  );
}
