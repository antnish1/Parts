import type { ReactNode } from 'react';

type PageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageCard({ eyebrow, title, description, children }: PageCardProps) {
  const displayTitle = title === 'New Order' ? 'Create New Order' : title;

  return (
    <section
      data-page-title={title}
      className="pc-page-card rounded-xl border border-[#263244] bg-[#111827] p-3 shadow-panel"
      aria-label={`${displayTitle}. ${description}`}
    >
      <header className="pc-page-heading lg:flex lg:items-center lg:justify-between lg:gap-4">
        <h1 className="pc-page-title text-sm font-black uppercase tracking-[0.14em] text-[#0f4c81]">{displayTitle}</h1>
        <span className="pc-page-eyebrow hidden shrink-0 lg:inline">{eyebrow}</span>
      </header>
      {children ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}
