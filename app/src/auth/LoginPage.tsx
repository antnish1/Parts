import { FormEvent, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { useAuth } from './useAuth';
import { roleHomePath } from './roleGuards';
import { brandLogoSrc } from '../assets/brandLogo';

const inputClass = 'w-full rounded-lg border border-[#6D8196]/45 bg-white px-12 py-3.5 text-sm font-semibold text-[#000080] outline-none transition placeholder:text-[#6D8196] focus:border-[#0047AB]';
const labelClass = 'mb-2 block text-xs font-black uppercase tracking-[0.16em] text-[#6D8196]';

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#000080] px-4 py-10 text-[#000080]">
      <div className="absolute inset-0 bg-gradient-to-br from-[#0047AB] via-[#000080] to-[#82C8E5]" />
      <section className="relative w-full max-w-[430px] rounded-2xl border border-white/40 bg-white p-7 shadow-panel sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-xl bg-white p-1.5 shadow-md ring-1 ring-[#82C8E5]/45">
            <img src={brandLogoSrc} alt="Parts Connect Portal logo" className="h-full w-full object-contain" />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-[#0047AB]">Parts Connect Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className={labelClass}>User ID / Email ID</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#0047AB]" />
              <input className={inputClass} autoComplete="username" placeholder="DAMOH01 or name@company.com" value={loginId} onChange={(event) => setLoginId(event.target.value)} />
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
