import type { ReactNode } from 'react';

type PageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageCard({ title, children }: PageCardProps) {
  const displayTitle = title === 'New Order' ? 'Create New Order' : title;

  return (
    <section className="rounded-xl border border-[#263244] bg-[#111827] p-3 shadow-panel">
      <h1 className="text-sm font-black uppercase tracking-[0.14em] text-[#0f4c81]">{displayTitle}</h1>
      {children ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}
