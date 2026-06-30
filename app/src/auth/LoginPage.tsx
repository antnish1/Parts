import { LockKeyhole } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { isSupabaseConfigured } from '../lib/supabase';

export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-pc-bg p-4 text-pc-text">
      <section className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-panel md:grid md:grid-cols-[1.05fr_0.95fr]">
        <div className="bg-slate-900/80 p-8">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-pc-gold">Parts Connect Portal</p>
          <h1 className="mt-3 text-3xl font-black text-white">Secure rebuild login</h1>
          <p className="mt-3 text-sm leading-6 text-pc-muted">
            This page will use Supabase Auth and profile-based role access in the rebuilt application.
          </p>
          <div className="mt-6 rounded-2xl border border-pc-gold/20 bg-pc-gold/10 p-4 text-sm text-yellow-100">
            The legacy root index file remains untouched. This React app is the migration workspace.
          </div>
        </div>
        <div className="p-8">
          <div className="mb-5 inline-flex rounded-2xl bg-pc-gold/10 p-3 text-pc-gold">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <label className="block text-xs font-black uppercase tracking-widest text-pc-gold">Email</label>
          <input className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-pc-gold" placeholder="user@company.com" />
          <label className="mt-4 block text-xs font-black uppercase tracking-widest text-pc-gold">Secret</label>
          <input type="password" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-pc-gold" placeholder="Enter secret" />
          <Button className="mt-5 w-full">Sign in</Button>
          {!isSupabaseConfigured() ? (
            <p className="mt-4 text-xs leading-5 text-amber-200">Configure app/.env.local from app/.env.example before enabling real login.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
