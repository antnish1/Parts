import type { ReactNode } from 'react';

type PageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageCard({ eyebrow, title, description, children }: PageCardProps) {
  const isNewOrderPage = eyebrow === 'Orders' && title === 'New Order' && description === 'Create branch order.';
  const isTrackOrdersPage = eyebrow === 'Tracking' && title === 'Track Orders' && description === 'Order tracking workspace.';
  const isCompactHeading = isNewOrderPage || isTrackOrdersPage;
  const displayTitle = isNewOrderPage ? 'Create New Order' : title;

  return (
    <section className="rounded-xl border border-[#263244] bg-[#111827] p-3 shadow-panel">
      {!isCompactHeading && eyebrow ? <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#82C8E5]">{eyebrow}</p> : null}
      {displayTitle ? <h1 className={isCompactHeading ? 'text-sm font-black uppercase tracking-[0.14em] text-[#0f4c81]' : 'mt-1 text-lg font-black text-white'}>{displayTitle}</h1> : null}
      {!isCompactHeading && description ? <p className="mt-1 max-w-3xl text-xs leading-5 text-[#c7d2df]">{description}</p> : null}
      {children ? <div className={isCompactHeading ? 'mt-2' : 'mt-3'}>{children}</div> : null}
    </section>
  );
}
