import { FormEvent, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, PackageCheck, ShieldCheck, Truck, UserRoundCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { roleHomePath } from './roleGuards';

const inputClass = 'w-full rounded-2xl border border-slate-800 bg-slate-950/80 px-12 py-4 text-sm font-semibold text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-pc-gold focus:bg-slate-950 focus:shadow-[0_0_0_4px_rgba(250,204,21,0.08)]';
const labelClass = 'mb-2 block text-xs font-black uppercase tracking-[0.18em] text-slate-400';

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
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Signed in successfully. Loading your workspace...');
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#060914] text-pc-text">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(250,204,21,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.14),transparent_34%)]" />
      <div className="absolute left-1/2 top-0 h-px w-[70vw] -translate-x-1/2 bg-gradient-to-r from-transparent via-pc-gold/50 to-transparent" />
      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950/85 shadow-[0_30px_90px_rgba(0,0,0,0.55)] backdrop-blur-xl lg:min-h-[720px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative overflow-hidden border-b border-white/10 bg-slate-900/70 p-8 lg:border-b-0 lg:border-r lg:p-12">
            <div className="absolute -right-20 top-10 h-72 w-72 rounded-full bg-pc-gold/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
            <div className="relative flex h-full flex-col justify-between gap-10">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pc-gold text-slate-950 shadow-lg shadow-yellow-500/20">
                    <Truck className="h-8 w-8" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.26em] text-pc-gold">Parts Connect</p>
                    <p className="mt-1 text-sm font-bold text-slate-300">Commercial Vehicle Parts Portal</p>
                  </div>
                </div>

                <div className="mt-14 max-w-2xl">
                  <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-pc-gold/25 bg-pc-gold/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-pc-gold">
                    <ShieldCheck className="h-4 w-4" />
                    Secure Production Access
                  </div>
                  <h1 className="text-4xl font-black leading-tight text-white md:text-5xl xl:text-6xl">
                    Centralized order control for branches, approvals and admin processing.
                  </h1>
                  <p className="mt-6 max-w-xl text-base leading-8 text-slate-300">
                    A modern rebuild of Parts Connect Portal with secure Supabase authentication, role-based access, audit-ready workflows and protected operational dashboards.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <UserRoundCheck className="h-6 w-6 text-pc-gold" />
                  <p className="mt-4 text-sm font-black text-white">Role Based</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Branch, admin, approver, manager and developer access.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <PackageCheck className="h-6 w-6 text-pc-gold" />
                  <p className="mt-4 text-sm font-black text-white">Order Flow</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">Register, track, approve, process and report orders.</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <LockKeyhole className="h-6 w-6 text-pc-gold" />
                  <p className="mt-4 text-sm font-black text-white">Protected</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">No frontend password comparison or legacy login logic.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center p-6 sm:p-8 lg:p-12">
            <div className="w-full max-w-md">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 shadow-2xl sm:p-8">
                <div className="mb-8 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl border border-pc-gold/25 bg-pc-gold/10 text-pc-gold">
                    <LockKeyhole className="h-8 w-8" />
                  </div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-pc-gold">Authorized Login</p>
                  <h2 className="mt-3 text-3xl font-black text-white">Welcome back</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">Sign in with your registered email ID and password.</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className={labelClass}>Email ID</label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <input className={inputClass} type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="block text-xs font-black uppercase tracking-[0.18em] text-slate-400">Password</label>
                      <button type="button" className="text-xs font-bold text-pc-gold hover:text-yellow-200" onClick={() => setShowPassword((current) => !current)}>
                        {showPassword ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <div className="relative">
                      <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                      <input className={inputClass} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} />
                      <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-pc-gold" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <label className="flex items-center gap-2">
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-700 bg-slate-950 accent-pc-gold" />
                      Remember this device
                    </label>
                    <span className="font-semibold text-slate-500">Admin controlled access</span>
                  </div>

                  <Button type="submit" className="h-12 w-full text-base" disabled={!canSubmit || isSubmitting}>
                    {isSubmitting ? 'Verifying...' : 'Sign in to Portal'}
                  </Button>
                </form>

                {!isSupabaseConfigured() ? (
                  <p className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-5 text-amber-100">
                    Supabase environment variables are not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.
                  </p>
                ) : null}

                {message ? <p className="mt-5 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-pc-text">{message}</p> : null}
              </div>

              <p className="mt-6 text-center text-xs leading-5 text-slate-500">
                Access is managed through Supabase Auth and profile-based roles. Contact your portal administrator if your login is inactive or assigned to the wrong branch.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
