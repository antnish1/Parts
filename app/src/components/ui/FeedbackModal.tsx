import { AlertTriangle, CheckCircle2, Info, Loader2, Sparkles, X } from 'lucide-react';
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
          <div className="absolute inset-y-0 left-1/3 w-px animate-pulse bg-[#facc15]" />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em]">{label}</span>
      </div>
    );
  }

  if (variant === 'comet') {
    return (
      <div className="flex items-center gap-3 text-[#ffd400]">
        <div className="relative h-9 w-9">
          <div className="absolute inset-0 animate-spin rounded-full border border-transparent border-t-[#ffd400] border-r-[#38bdf8]" />
          <div className="absolute inset-2 rounded-full bg-[#ffd400] shadow-[0_0_20px_#ffd400]" />
          <div className="absolute -right-3 top-4 h-px w-8 bg-gradient-to-r from-[#ffd400] to-transparent" />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em]">{label}</span>
      </div>
    );
  }

  if (variant === 'matrix') {
    return (
      <div className="flex items-center gap-3 text-[#a7f3d0]">
        <div className="grid h-8 w-8 grid-cols-3 gap-1">
          {Array.from({ length: 9 }).map((_, index) => <span key={index} className="animate-pulse rounded-sm bg-[#34d399]" style={{ animationDelay: `${index * 80}ms` }} />)}
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em]">{label}</span>
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className="flex items-center gap-3 text-[#c4b5fd]">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 animate-ping rounded-full bg-[#8b5cf6]/50" />
          <div className="absolute inset-2 rounded-full bg-[#8b5cf6] shadow-[0_0_22px_#8b5cf6]" />
        </div>
        <span className="text-xs font-black uppercase tracking-[0.18em]">{label}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-[#82C8E5]">
      <div className="relative h-9 w-9">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-[#263244] border-t-[#82C8E5] border-r-[#ffd400]" />
        <div className="absolute inset-2 rounded-full border border-[#82C8E5]/40 bg-[#0b1020]" />
        <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffd400] shadow-[0_0_18px_#ffd400]" />
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
  const glow = isSuccess ? '#22c55e' : isError ? '#ef4444' : '#38bdf8';
  const title = isSuccess ? 'Mission Successful' : isError ? 'Action Needs Attention' : 'System Message';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#020617]/80 px-4 backdrop-blur-md">
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#0b1020] p-1 shadow-[0_0_80px_rgba(56,189,248,0.2)]">
        <div className="absolute -left-24 -top-24 h-48 w-48 rounded-full opacity-30 blur-3xl" style={{ background: glow }} />
        <div className="absolute -bottom-24 -right-24 h-48 w-48 rounded-full bg-[#ffd400]/20 blur-3xl" />
        <div className="relative rounded-[1.3rem] border border-[#263244] bg-[#111827]/95 p-6 text-center">
          <button type="button" className="absolute right-4 top-4 rounded-full border border-[#263244] p-1 text-[#c7d2df] hover:border-white hover:text-white" onClick={onClose} aria-label="Close message">
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-[#0b1020]" style={{ boxShadow: `0 0 44px ${glow}` }}>
            <Icon className="h-10 w-10" style={{ color: glow }} />
          </div>
          <div className="mb-3 flex items-center justify-center gap-2 text-[#ffd400]">
            <Sparkles className="h-4 w-4" />
            <p className="text-[10px] font-black uppercase tracking-[0.26em]">Parts Connect Portal</p>
            <Sparkles className="h-4 w-4" />
          </div>
          <h2 className="text-2xl font-black text-white">{title}</h2>
          <p className="mx-auto mt-3 max-w-md whitespace-pre-wrap text-sm font-semibold leading-6 text-[#c7d2df]">{message}</p>
          <div className="mt-6 flex justify-center">
            <Button type="button" className="rounded-xl px-8" onClick={onClose}>{isError ? 'Fix It' : 'Continue'}</Button>
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
