import { FormEvent, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, Eye, EyeOff, LockKeyhole, UserRound } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { roleHomePath } from './roleGuards';

const inputClass = 'h-[52px] w-full rounded-full border border-[#d8e2ed] bg-[#f9fbfe] pl-12 pr-12 text-[14px] font-medium text-[#082753] outline-none transition placeholder:text-[#9ca9bb] focus:border-[#1787ee] focus:ring-2 focus:ring-[#1787ee]/15';
const labelClass = 'mb-2 flex items-center gap-2.5 text-[13px] font-bold text-[#092650]';

function normalizeLoginIdentifier(value: string) {
  const text = value.trim();
  if (text.includes('@')) return text.toLowerCase();
  return `${text.replace(/\s+/g, '').toLowerCase()}@portal.local`;
}

export function LoginPage() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = useMemo(() => loginId.trim().length > 0 && password.length >= 6 && isSupabaseConfigured(), [loginId, password]);

  if (!isLoading && isAuthenticated && role) return <Navigate to={roleHomePath[role]} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!isSupabaseConfigured()) return setMessage('Supabase environment variables are missing.');
    if (!loginId.trim() || !password) return setMessage('Enter User ID and password.');
    setIsSubmitting(true);
    const authEmail = normalizeLoginIdentifier(loginId);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
    setIsSubmitting(false);
    if (error) return setMessage('Invalid User ID or password.');
    setMessage('Signed in. Opening portal...');
  }

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#e5f2ff] text-[#092650]">
      {/* The approved image owns the full hero artwork and branding. Keep it visible above the interactive card. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[url('/jsign.jpeg')] bg-top bg-no-repeat" style={{ backgroundSize: '100% auto' }} />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col px-[clamp(20px,9vw,54px)] pb-10 pt-[clamp(300px,45vh,590px)] sm:pb-14">
        <section className="relative w-full rounded-[27px] border border-white/90 bg-white px-6 pb-7 pt-14 shadow-[0_16px_38px_rgba(10,60,114,0.17)] sm:px-8 sm:pb-9" aria-labelledby="parts-signin-heading">
          <div className="absolute left-1/2 top-0 flex h-[78px] w-[78px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[5px] border-white bg-gradient-to-br from-[#168df2] to-[#064998] text-white shadow-[0_4px_9px_rgba(9,61,134,0.12)]">
            <UserRound aria-hidden="true" className="h-9 w-9 stroke-[1.8]" />
          </div>
          <h1 id="parts-signin-heading" className="text-[30px] font-extrabold leading-tight tracking-[-0.035em]">Sign in</h1>
          <p className="mb-6 mt-2 max-w-[350px] text-[13px] font-medium leading-[1.55] text-[#718198]">Use the same User ID and password as the Parts Connect portal.</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="parts-login-user" className={labelClass}><UserRound className="h-5 w-5 text-[#167bd5]" />User ID</label>
              <div className="relative">
                <UserRound aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7e8da0]" />
                <input id="parts-login-user" className={inputClass} autoComplete="username" placeholder="e.g. DAMOH01" value={loginId} onChange={(event) => setLoginId(event.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="parts-login-password" className={labelClass}><LockKeyhole className="h-5 w-5 text-[#167bd5]" />Password</label>
              <div className="relative">
                <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#7e8da0]" />
                <input id="parts-login-password" className={inputClass} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="absolute right-4 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-[#718198] hover:text-[#0969c6]" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" className="flex items-center gap-1 text-[12px] font-bold text-[#0877da] hover:underline" onClick={() => setMessage('Please contact your Parts Connect administrator to reset your password.')}>
                Forgot password? <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <button type="submit" disabled={!canSubmit || isSubmitting} className="flex h-[54px] w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#0750a5] to-[#0b99fc] text-[16px] font-bold text-white shadow-[0_6px_17px_rgba(10,112,216,0.21)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65">
              {isSubmitting ? 'Verifying...' : 'Sign in'} {!isSubmitting && <ArrowRight aria-hidden="true" className="h-5 w-5" />}
            </button>
          </form>
          {!isSupabaseConfigured() && <p role="alert" className="mt-4 text-xs text-red-700">Supabase environment variables are missing.</p>}
          {message && <p role="status" className="mt-4 rounded-xl bg-[#eaf4ff] px-3 py-2 text-sm text-[#174f8e]">{message}</p>}
        </section>
      </div>
    </main>
  );
}
