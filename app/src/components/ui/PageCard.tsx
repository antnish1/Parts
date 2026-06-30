import type { ReactNode } from 'react';

type PageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageCard({ eyebrow, title, description, children }: PageCardProps) {
  return (
    <section className="rounded-2xl border border-[#263244] bg-[#111827] p-4 shadow-panel">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#82C8E5]">{eyebrow}</p>
      <h1 className="mt-1 text-xl font-black text-white">{title}</h1>
      <p className="mt-1 max-w-3xl text-[13px] leading-5 text-[#c7d2df]">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}
