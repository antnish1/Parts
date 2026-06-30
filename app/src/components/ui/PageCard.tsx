import type { ReactNode } from 'react';

type PageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageCard({ eyebrow, title, description, children }: PageCardProps) {
  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 shadow-panel">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-pc-gold">{eyebrow}</p>
      <h1 className="mt-2 text-2xl font-black text-white">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-pc-muted">{description}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </section>
  );
}
