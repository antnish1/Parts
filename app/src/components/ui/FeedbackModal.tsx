import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';

type FeedbackVariant = 'success' | 'error' | 'info';
type LoaderVariant = 'orbit' | 'scanner' | 'comet' | 'matrix' | 'pulse';

export function getFeedbackVariant(message: string): FeedbackVariant {
  const text = message.toLowerCase();
  if (text.includes('success') || text.includes('created') || text.includes('updated') || text.includes('complete') || text.includes('saved') || text.includes('signed in') || text.includes('activated') || text.includes('deactivated')) return 'success';
  if (text.includes('failed') || text.includes('error') || text.includes('invalid') || text.includes('required') || text.includes('not found') || text.includes('duplicate') || text.includes('cannot') || text.includes('unauthorized')) return 'error';
  return 'info';
}

function getMessageTitle(message: string, tone: FeedbackVariant) {
  const firstSentence = message.trim().split(/[.!?]/)[0]?.trim();
  if (firstSentence) return firstSentence;
  if (tone === 'success') return 'Completed';
  if (tone === 'error') return 'Action needed';
  return 'Message';
}

function getMessageDetails(message: string) {
  const details: Array<{ label: string; value: string; tone?: 'good' | 'bad' }> = [];
  const addMatch = message.match(/added:\s*([^,.]+)/i);
  const failedMatch = message.match(/failed:\s*([^,.]+)/i);
  const duplicateMatch = message.match(/merged duplicates:\s*([^,.]+)/i);
  const columnMatch = message.match(/detected part column\s+([^,]+),\s*qty column\s+([^,.]+)/i);

  if (addMatch) details.push({ label: 'Added', value: addMatch[1].trim(), tone: 'good' });
  if (failedMatch) details.push({ label: 'Failed', value: failedMatch[1].trim(), tone: Number(failedMatch[1].trim()) > 0 ? 'bad' : 'good' });
  if (duplicateMatch) details.push({ label: 'Merged duplicates', value: duplicateMatch[1].trim() });
  if (columnMatch) {
    details.push({ label: 'Part column', value: columnMatch[1].trim() });
    details.push({ label: 'Qty column', value: columnMatch[2].trim() });
  }
  return details;
}

function getMessageBody(message: string, tone: FeedbackVariant) {
  const body = message
    .replace(/^[^.!?]+[.!?]?\s*/, '')
    .replace(/added:\s*[^,.]+[, .]*/i, '')
    .replace(/failed:\s*[^,.]+[, .]*/i, '')
    .replace(/merged duplicates:\s*[^,.]+[, .]*/i, '')
    .replace(/detected part column\s+[^,]+,\s*qty column\s+[^,.]+[.]?/i, '')
    .trim();

  if (body) return body;
  if (tone === 'success') return 'The action has been completed successfully.';
  if (tone === 'error') return 'Please review the details and try again.';
  return 'Please review the information below.';
}

export function ActionLoader({ variant = 'orbit', label = 'Loading' }: { variant?: LoaderVariant; label?: string }) {
  if (variant === 'scanner') {
    return (
      <div className="flex items-center gap-3 text-[#82C8E5]">
        <div className="relative h-8 w-16 overflow-hidden rounded-lg border border-[#38bdf8]/40 bg-[#0b1020]">
          <div className="absolute inset-y-1 left-0 w-2 animate-ping rounded-full bg-[#38bdf8]" />
          <div className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-[#38bdf8]/70 shadow-[0_0_18px_#38bdf8]" />
          <div className="absolute inset-y-0 left-1/3 w-px animate-pulse bg-[#38bdf8]" />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em]">{label}</span>
      </div>
    );
  }

  if (variant === 'comet') {
    return (
      <div className="flex items-center gap-3 text-[#1677ff]">
        <div className="relative h-9 w-9">
          <div className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-[#1677ff] border-r-[#38bdf8]" />
          <div className="absolute inset-2 rounded-full bg-[#1677ff] shadow-[0_0_20px_#1677ff]" />
          <div className="absolute -right-3 top-4 h-px w-8 bg-gradient-to-r from-[#1677ff] to-transparent" />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em]">{label}</span>
      </div>
    );
  }

  if (variant === 'matrix') {
    return (
      <div className="flex items-center gap-3 text-[#047857]">
        <div className="grid h-8 w-8 grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, index) => <span key={index} className="animate-pulse rounded-sm bg-[#34d399]" style={{ animationDelay: `${index * 80}ms` }} />)}
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em]">{label}</span>
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className="flex items-center gap-3 text-[#6d28d9]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 animate-ping rounded-full bg-[#8b5cf6]/50" />
          <div className="absolute inset-2 rounded-full bg-[#8b5cf6] shadow-[0_0_22px_#8b5cf6]" />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em]">{label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-[#1677ff]">
      <div className="relative h-9 w-9">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-[#d9dee7] border-t-[#1677ff] border-r-[#38bdf8]" />
        <div className="absolute inset-2 rounded-full border border-[#82C8E5]/40 bg-[#0b1020]" />
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1677ff] shadow-[0_0_18px_#1677ff]" />
      </div>
      <span className="text-xs font-black uppercase tracking-[0.18em]">{label}</span>
    </div>
  );
}

export function BlockingActionOverlay({ show, label = 'Please wait' }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[200] flex cursor-wait items-center justify-center bg-[#f5f7fa]/72 px-4 backdrop-blur-[2px]" aria-busy="true" aria-live="polite">
      <div className="rounded-2xl border border-[#d9dee7] bg-white px-5 py-4 shadow-[0_16px_45px_rgba(16,24,40,0.14)]">
        <ActionLoader variant="orbit" label={label} />
        <p className="mt-3 text-center text-[11px] font-semibold text-[#667085]">Action is running. Please do not close or click anywhere.</p>
      </div>
    </div>
  );
}

export function FeedbackModal({ message, variant, onClose }: { message: string; variant?: FeedbackVariant; onClose: () => void }) {
  if (!message) return null;
  const tone = variant ?? getFeedbackVariant(message);
  const isSuccess = tone === 'success';
  const isError = tone === 'error';
  const Icon = isSuccess ? CheckCircle2 : isError ? AlertTriangle : Info;
  const title = getMessageTitle(message, tone);
  const body = getMessageBody(message, tone);
  const details = getMessageDetails(message);
  const toneClass = isSuccess
    ? { icon: 'text-[#047857]', box: 'bg-[#ecfdf3] border-[#bbf7d0]', accent: 'bg-[#047857]', button: 'bg-[#047857] hover:bg-[#065f46]' }
    : isError
      ? { icon: 'text-[#be123c]', box: 'bg-[#fff1f3] border-[#fecdd3]', accent: 'bg-[#be123c]', button: 'bg-[#be123c] hover:bg-[#9f1239]' }
      : { icon: 'text-[#1677ff]', box: 'bg-[#e6f4ff] border-[#bfdbfe]', accent: 'bg-[#1677ff]', button: 'bg-[#0f4c81] hover:bg-[#0b3b64]' };

  function detailClass(detail: { tone?: 'good' | 'bad' }) {
    if (detail.tone === 'good') return 'border-[#bbf7d0] bg-[#f0fdf4] text-[#14532d]';
    if (detail.tone === 'bad') return 'border-[#fecdd3] bg-[#fff1f3] text-[#9f1239]';
    return 'border-[#d9e2ec] bg-[#f8fbff] text-[#344054]';
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/45 px-4 backdrop-blur-[2px]">
      <div className="relative w-full max-w-[460px] overflow-hidden rounded-2xl border border-[#d7dee8] bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
        <div className={`h-1 w-full ${toneClass.accent}`} />
        <button type="button" className="absolute right-3 top-3 rounded-full border border-[#d9dee7] bg-white p-1.5 text-[#667085] transition hover:bg-[#f8fafc] hover:text-[#101827]" onClick={onClose} aria-label="Close message">
          <X className="h-4 w-4" />
        </button>

        <div className="px-5 pb-4 pt-5">
          <div className="flex items-start gap-3 pr-8">
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClass.box}`}>
              <Icon className={`h-5 w-5 ${toneClass.icon}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-5 text-[#101827]">{title}</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm font-normal leading-5 text-[#475467]">{body}</p>
            </div>
          </div>

          {details.length ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {details.map((detail) => (
                <div key={detail.label} className={`rounded-xl border px-3 py-2 ${detailClass(detail)}`}>
                  <p className="text-[10px] font-medium uppercase tracking-[0.12em] opacity-75">{detail.label}</p>
                  <p className="mt-0.5 text-sm font-semibold">{detail.value}</p>
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex justify-end border-t border-[#eef2f6] pt-3">
            <button type="button" className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition ${toneClass.button}`} onClick={onClose}>Okay</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InlineLoader({ variant = 'orbit', label = 'Working' }: { variant?: LoaderVariant; label?: string }) {
  return (
    <div className="rounded-2xl border border-[#263244] bg-[#0b1020] p-3">
      <ActionLoader variant={variant} label={label} />
    </div>
  );
}

export function ButtonLoader() {
  return <Loader2 className="h-4 w-4 animate-spin" />;
}
