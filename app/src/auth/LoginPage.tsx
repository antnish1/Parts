import { FormEvent, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { roleHomePath } from './roleGuards';

const inputClass = 'w-full rounded-2xl border border-[#F2C7C7] bg-white px-12 py-4 text-sm font-semibold text-[#1f2937] outline-none transition placeholder:text-gray-400 focus:border-[#FFB7C5] focus:shadow-[0_0_0_4px_rgba(255,183,197,0.22)]';
const labelClass = 'mb-2 block text-xs font-black uppercase tracking-[0.18em] text-gray-500';

export function LoginPage() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = useMemo(() => email.trim().length > 3 && password.length >= 6 && isSupabaseConfigured(), [email, password]);

  if (!isLoading && isAuthenticated && role) {
    return <Navigate to={roleHomePath[role]} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');

    if (!isSupabaseConfigured()) {
      setMessage('Supabase environment variables are missing in Vercel. Configure them before enabling login.');
      return;
    }

    if (!email.trim() || !password) {
      setMessage('Enter email and password.');
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Signed in successfully. Loading your workspace...');
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white px-4 py-10 text-[#1f2937]">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#F2C7C7_0%,#FFFFFF_34%,#D5F3D8_68%,#FFB7C5_100%)]" />
      <div className="absolute inset-0 bg-white/55 backdrop-blur-[1px]" />
      <div className="absolute left-10 top-10 h-32 w-32 rounded-full bg-[#F2C7C7]/70 blur-3xl" />
      <div className="absolute bottom-10 right-10 h-44 w-44 rounded-full bg-[#FFB7C5]/60 blur-3xl" />

      <section className="relative w-full max-w-[460px] rounded-[2rem] border border-white/80 bg-white/90 p-6 shadow-[0_30px_90px_rgba(242,199,199,0.55)] backdrop-blur-xl sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#D5F3D8] text-[#1f2937] shadow-[0_12px_35px_rgba(213,243,216,0.8)]">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#FFB7C5]">Parts Connect</p>
          <h1 className="mt-3 text-3xl font-black text-[#1f2937]">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">Sign in with your registered email ID and password.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Email ID</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#FFB7C5]" />
              <input className={inputClass} type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-black uppercase tracking-[0.18em] text-gray-500">Password</label>
              <button type="button" className="text-xs font-black text-[#FFB7C5] hover:text-[#e998aa]" onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#FFB7C5]" />
              <input className={inputClass} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FFB7C5]" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-4 w-4 rounded border-[#F2C7C7] accent-[#FFB7C5]" />
              Remember this device
            </label>
            <span className="font-semibold">Secure access</span>
          </div>

          <Button type="submit" className="h-12 w-full rounded-2xl bg-[#FFB7C5] text-base text-[#1f2937] shadow-[0_16px_35px_rgba(255,183,197,0.45)] hover:bg-[#F2C7C7]" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Verifying...' : 'Sign in to Portal'}
          </Button>
        </form>

        {!isSupabaseConfigured() ? (
          <p className="mt-5 rounded-2xl border border-[#FFB7C5]/50 bg-[#FFB7C5]/20 p-4 text-xs leading-5 text-[#1f2937]">
            Supabase environment variables are not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.
          </p>
        ) : null}

        {message ? <p className="mt-5 rounded-2xl border border-[#F2C7C7] bg-[#D5F3D8]/55 p-4 text-sm font-semibold text-[#1f2937]">{message}</p> : null}
      </section>
    </main>
  );
}
