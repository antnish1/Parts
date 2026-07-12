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
    <section data-page-title={title} className="pc-page-card rounded-xl border border-[#263244] bg-[#111827] p-3 shadow-panel">
      <header className="pc-page-heading lg:flex lg:items-center lg:justify-between lg:gap-4">
        <h1 className="pc-page-title text-sm font-black uppercase tracking-[0.14em] text-[#0f4c81]">{displayTitle}</h1>
        <div className="hidden min-w-0 items-center gap-2 lg:flex">
          <span className="pc-page-eyebrow shrink-0">{eyebrow}</span>
          <span className="h-3 w-px shrink-0 bg-[#d8e0ea]" aria-hidden="true" />
          <p className="pc-page-description truncate" title={description}>{description}</p>
        </div>
      </header>
      {children ? <div className="mt-2">{children}</div> : null}
    </section>
  );
}
