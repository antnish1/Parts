import type { ReactNode } from 'react';

type PageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageCard({ eyebrow, title, description, children }: PageCardProps) {
  return (
    <section className="rounded-xl border border-[#263244] bg-[#111827] p-3 shadow-panel">
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#82C8E5]">{eyebrow}</p>
      <h1 className="mt-1 text-lg font-black text-white">{title}</h1>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-[#c7d2df]">{description}</p>
      {children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}
