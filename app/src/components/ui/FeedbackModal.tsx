import { AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { Button } from './Button';

type FeedbackVariant = 'success' | 'error' | 'info';
type LoaderVariant = 'orbit' | 'scanner' | 'comet' | 'matrix' | 'pulse';

export function getFeedbackVariant(message: string): FeedbackVariant {
  const text = message.toLowerCase();
  if (text.includes('success') || text.includes('created') || text.includes('updated') || text.includes('complete') || text.includes('saved') || text.includes('signed in') || text.includes('activated') || text.includes('deactivated')) return 'success';
  if (text.includes('failed') || text.includes('error') || text.includes('invalid') || text.includes('required') || text.includes('not found') || text.includes('duplicate') || text.includes('cannot') || text.includes('unauthorized')) return 'error';
  return 'info';
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

export function FeedbackModal({ message, variant, onClose }: { message: string; variant?: FeedbackVariant; onClose: () => void }) {
  if (!message) return null;
  const tone = variant ?? getFeedbackVariant(message);
  const isSuccess = tone === 'success';
  const isError = tone === 'error';
  const Icon = isSuccess ? CheckCircle2 : isError ? AlertTriangle : Info;
  const toneClass = isSuccess
    ? { icon: 'text-[#047857]', bg: 'bg-[#ecfdf3]', border: 'border-[#bbf7d0]', button: 'bg-[#047857] text-white hover:bg-[#065f46]' }
    : isError
      ? { icon: 'text-[#be123c]', bg: 'bg-[#fff1f3]', border: 'border-[#fecdd3]', button: 'bg-[#be123c] text-white hover:bg-[#9f1239]' }
      : { icon: 'text-[#1677ff]', bg: 'bg-[#e6f4ff]', border: 'border-[#bfdbfe]', button: 'bg-[#1677ff] text-white hover:bg-[#0f5ed7]' };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/55 px-4 backdrop-blur-sm">
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-[#d9dee7] bg-white shadow-[0_18px_70px_rgba(16,24,40,0.22)]">
        <button type="button" className="absolute right-3 top-3 rounded-full border border-[#d9dee7] bg-white p-1 text-[#667085] hover:bg-[#f2f4f7]" onClick={onClose} aria-label="Close message">
          <X className="h-4 w-4" />
        </button>
        <div className="p-4 pr-11">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClass.border} ${toneClass.bg}`}>
              <Icon className={`h-5 w-5 ${toneClass.icon}`} />
            </div>
            <p className="min-h-9 whitespace-pre-wrap pt-1 text-sm font-black leading-5 text-[#101827]">{message}</p>
          </div>
          <div className="mt-4 flex justify-end">
            <Button type="button" className={`rounded-lg px-4 py-2 text-xs ${toneClass.button}`} onClick={onClose}>OK</Button>
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
