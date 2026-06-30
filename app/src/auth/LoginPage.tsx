import { FormEvent, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { roleHomePath } from './roleGuards';

const inputClass = 'w-full rounded-lg border border-[#6D8196]/45 bg-white px-12 py-3.5 text-sm font-semibold text-[#000080] outline-none transition placeholder:text-[#6D8196] focus:border-[#0047AB]';
const labelClass = 'mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#6D8196]';

export function LoginPage() {
  const { isAuthenticated, role, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = useMemo(() => email.trim().length > 3 && password.length >= 6 && isSupabaseConfigured(), [email, password]);

  if (!isLoading && isAuthenticated && role) return <Navigate to={roleHomePath[role]} replace />;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    if (!isSupabaseConfigured()) return setMessage('Supabase environment variables are missing.');
    if (!email.trim() || !password) return setMessage('Enter email and password.');
    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setIsSubmitting(false);
    if (error) return setMessage(error.message);
    setMessage('Signed in. Opening portal...');
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#000080] px-4 py-10 text-[#000080]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0047AB] via-[#000080] to-[#82C8E5]" />
      <section className="relative w-full max-w-[430px] rounded-2xl border border-white/40 bg-white p-7 shadow-panel sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[#82C8E5] text-[#000080]">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#0047AB]">Parts Connect</p>
          <h1 className="mt-3 text-3xl font-black text-[#000080]">Sign in</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>Email ID</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#0047AB]" />
              <input className={inputClass} type="email" autoComplete="email" placeholder="name@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-xs font-black uppercase tracking-[0.16em] text-[#6D8196]">Password</label>
              <button type="button" className="text-xs font-black text-[#0047AB] hover:text-[#000080]" onClick={() => setShowPassword((current) => !current)}>{showPassword ? 'Hide' : 'Show'}</button>
            </div>
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#0047AB]" />
              <input className={inputClass} type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6D8196] hover:text-[#0047AB]" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="h-12 w-full rounded-lg bg-[#0047AB] text-base text-white shadow-none hover:bg-[#000080]" disabled={!canSubmit || isSubmitting}>
            {isSubmitting ? 'Verifying...' : 'Continue'}
          </Button>
        </form>

        {!isSupabaseConfigured() ? <p className="mt-5 rounded-lg border border-[#82C8E5] bg-[#82C8E5]/20 p-4 text-xs font-semibold text-[#000080]">Supabase environment variables are missing.</p> : null}
        {message ? <p className="mt-5 rounded-lg border border-[#82C8E5] bg-[#82C8E5]/25 p-4 text-sm font-semibold text-[#000080]">{message}</p> : null}
      </section>
    </main>
  );
}
