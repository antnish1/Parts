import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, Eye, EyeOff, Handshake, LockKeyhole, Settings, ShieldCheck, UserRound } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { roleHomePath } from './roleGuards';

const inputClass = 'h-[42px] w-full rounded-full border border-[#e3e9f2] bg-[#f7f9fc] pl-10 pr-10 text-xs font-medium text-[#092650] outline-none transition placeholder:text-[#a7b3c3] focus:border-[#196abc] focus:ring-2 focus:ring-[#196abc]/15';
const labelClass = 'mb-1.5 flex items-center gap-2 text-[11px] font-bold text-[#142d4d]';

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

  if (!isLoading && isAuthenticated && role) return <Navigate to={roleHomePath[role]} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!isSupabaseConfigured()) return setMessage('Supabase environment variables are missing.');
    if (!loginId.trim() || !password) return setMessage('Enter User ID and password.');
    if (password.length < 6) return setMessage('Password must contain at least 6 characters.');
    setIsSubmitting(true);
    const authEmail = normalizeLoginIdentifier(loginId);
    const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password });
    setIsSubmitting(false);
    if (error) return setMessage('Invalid User ID or password.');
    setMessage('Signed in. Opening portal...');
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#d9eafa] text-[#0b2340]">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[url('/portalbg.jpeg')] bg-right bg-no-repeat" style={{ backgroundSize: '125% 100%' }} />
      <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-full w-full bg-gradient-to-r from-white/90 via-white/5 to-transparent md:w-[51%]" />
      <div aria-hidden="true" className="pointer-events-none absolute left-0 top-0 h-[9px] w-[38%] -skew-y-[13deg] origin-top-left bg-gradient-to-r from-[#082957] via-[#efb324] to-white" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-[18px] w-[30%] -skew-y-[17deg] origin-bottom-right bg-gradient-to-r from-[#f4bd18] to-[#082957]" />

      <div className="relative mx-auto grid w-full max-w-[1440px] grid-cols-1 items-center px-5 py-16 md:min-h-[100dvh] md:grid-cols-[minmax(0,1fr)_340px_minmax(0,1fr)] md:px-[5.2%] md:py-10">
        <div className="z-10 mb-12 flex max-w-[345px] flex-col items-start justify-start md:mb-0 md:self-start md:pt-4">
          <div>
            <span className="mb-4 block h-[3px] w-10 rounded-full bg-[#efbd15]" />
            <h2 className="text-[30px] font-extrabold leading-tight tracking-[-0.04em] text-[#061c38]">Welcome Back</h2>
            <p className="mt-3 max-w-[250px] text-[17px] font-medium leading-[1.4] text-[#68778d]">Sign in to access your<br />Parts Connect portal</p>
            <div className="mt-9 flex items-center gap-3 text-[10px] font-bold text-[#1b2f49]">
              <span className="flex items-center gap-1.5"><Settings size={19} className="text-[#0e315c]" />Faster<br />Service</span>
              <span className="h-8 w-px bg-[#ebc65a]" />
              <span className="flex items-center gap-1.5"><ShieldCheck size={19} className="text-[#0e315c]" />Better<br />Support</span>
              <span className="h-8 w-px bg-[#ebc65a]" />
              <span className="flex items-center gap-1.5"><Handshake size={19} className="text-[#0e315c]" />Stronger<br />Together</span>
            </div>
          </div>
        </div>

        <section className="relative z-20 w-full rounded-[22px] border border-white/90 bg-white px-7 pb-8 pt-12 shadow-[0_15px_38px_rgba(7,33,73,0.15)]" aria-labelledby="parts-signin-heading">
          <span aria-hidden="true" className="absolute right-0 top-0 h-10 w-12 rounded-tr-[22px] bg-[linear-gradient(45deg,transparent_42%,#f4bd22_43%,#f4bd22_61%,transparent_62%)]" />
          <span aria-hidden="true" className="absolute bottom-0 left-0 h-9 w-11 rounded-bl-[22px] bg-[linear-gradient(45deg,transparent_42%,#f4bd22_43%,#f4bd22_61%,transparent_62%)]" />
          <div className="absolute left-1/2 top-0 flex h-[64px] w-[64px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[4px] border-white bg-[#092c57] text-white shadow-lg ring-1 ring-[#e3b63b]">
            <UserRound aria-hidden="true" className="h-7 w-7 stroke-[1.7]" />
          </div>
          <h1 id="parts-signin-heading" className="text-[24px] font-extrabold tracking-tight">Sign in</h1>
          <p className="mb-5 mt-1 text-[11px] font-medium leading-[1.55] text-[#68788c]">Your Gateway to Seamless Parts Operations.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="parts-login-user" className={labelClass}><UserRound className="h-4 w-4" />User ID</label>
              <div className="relative">
                <UserRound aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718296]" />
                <input id="parts-login-user" className={inputClass} autoComplete="username" placeholder="Enter your User ID" value={loginId} onChange={(event) => setLoginId(event.target.value)} />
              </div>
            </div>
            <div>
              <label htmlFor="parts-login-password" className={labelClass}><LockKeyhole className="h-4 w-4" />Password</label>
              <div className="relative">
                <LockKeyhole aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718296]" />
                <input id="parts-login-password" className={inputClass} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-[#718198]" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end">
              <button type="button" className="flex items-center gap-1 text-[10px] font-bold text-[#0877da] hover:underline" onClick={() => setMessage('Please contact your Parts Connect administrator to reset your password.')}>Forgot password? <ChevronRight className="h-3 w-3" /></button>
            </div>
            <button type="submit" disabled={isSubmitting} className="flex h-[44px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#073056] to-[#061b38] text-[13px] font-bold text-white shadow-[0_7px_13px_rgba(6,37,75,0.22)] cursor-pointer transition hover:brightness-110 disabled:cursor-default disabled:opacity-65">
              {isSubmitting ? 'Verifying...' : 'Sign In'} {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            </button>
          </form>
          {!isSupabaseConfigured() && <p role="alert" className="mt-4 text-xs text-red-700">Supabase environment variables are missing.</p>}
          {message && <p role="status" className="mt-4 rounded-xl bg-[#eaf4ff] px-3 py-2 text-xs text-[#174f8e]">{message}</p>}
        </section>
        <div aria-hidden="true" />
      </div>
    </main>
  );
}
