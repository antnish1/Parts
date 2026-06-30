import { FormEvent, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LockKeyhole, ShieldCheck, Truck, UserRoundCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { roleHomePath } from './roleGuards';

const inputClass = 'mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-pc-gold';
const labelClass = 'block text-xs font-black uppercase tracking-widest text-pc-gold';

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
    <main className="min-h-screen bg-pc-bg p-4 text-pc-text">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-panel lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative overflow-hidden bg-slate-900 p-8 lg:p-10">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-pc-gold/10 blur-3xl" />
          <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="relative">
            <div className="inline-flex rounded-2xl bg-pc-gold/10 p-3 text-pc-gold">
              <Truck className="h-8 w-8" />
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.25em] text-pc-gold">Parts Connect Portal</p>
            <h1 className="mt-4 max-w-xl text-4xl font-black leading-tight text-white lg:text-5xl">Secure parts ordering and processing workspace.</h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-pc-muted">
              Production-grade login for branch users, approvers, admin processing, managers, and developers. This rebuild uses Supabase Auth and profile-based access instead of the legacy frontend password flow.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <ShieldCheck className="h-5 w-5 text-pc-gold" />
                <p className="mt-3 text-sm font-black text-white">Auth First</p>
                <p className="mt-1 text-xs text-pc-muted">No plain password checks in browser.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <UserRoundCheck className="h-5 w-5 text-pc-gold" />
                <p className="mt-3 text-sm font-black text-white">Role Based</p>
                <p className="mt-1 text-xs text-pc-muted">Branch, admin, approver, manager.</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <LockKeyhole className="h-5 w-5 text-pc-gold" />
                <p className="mt-3 text-sm font-black text-white">Safe Migration</p>
                <p className="mt-1 text-xs text-pc-muted">Legacy app remains untouched.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center p-8 lg:p-10">
          <div className="w-full">
            <div className="mb-6">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-pc-gold">Secure Login</p>
              <h2 className="mt-2 text-2xl font-black text-white">Sign in to continue</h2>
              <p className="mt-2 text-sm text-pc-muted">Use your Supabase Auth email and password.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelClass}>Email</label>
                <input className={inputClass} type="email" autoComplete="email" placeholder="user@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <input className={inputClass} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter password" value={password} onChange={(event) => setPassword(event.target.value)} />
                <button type="button" className="mt-2 text-xs font-bold text-pc-gold hover:text-yellow-200" onClick={() => setShowPassword((current) => !current)}>
                  {showPassword ? 'Hide password' : 'Show password'}
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={!canSubmit || isSubmitting}>
                {isSubmitting ? 'Signing in...' : 'Sign In Securely'}
              </Button>
            </form>

            {!isSupabaseConfigured() ? (
              <p className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-5 text-amber-100">
                Supabase environment variables are not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel.
              </p>
            ) : null}

            {message ? <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-sm text-pc-text">{message}</p> : null}

            <p className="mt-6 text-xs leading-5 text-pc-muted">
              Access is finalized by the profile row assigned to the authenticated user. For this staging rebuild, profiles are read from test_profiles.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
