import type { ReactNode } from 'react';

type PageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageCard({ eyebrow, title, description, children }: PageCardProps) {
  const displayTitle = title === 'New Order' ? 'Create New Order' : title;
  const compactTitle = `${eyebrow}${displayTitle ? ` / ${displayTitle}` : ''}`;

  return (
    <section className="portal-page-card rounded-[22px] p-3 lg:p-4">
      <div className="relative z-10 mb-3 flex min-w-0 items-center justify-between gap-3 border-b border-slate-200/70 pb-2.5">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold tracking-[-0.01em] text-slate-700">{compactTitle}</p>
          {description ? <p className="mt-0.5 truncate text-[12px] font-medium text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children ? <div className="relative z-10">{children}</div> : null}
    </section>
  );
}
