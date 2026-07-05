import type { ReactNode } from 'react';

type PageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageCard({ eyebrow, title, description, children }: PageCardProps) {
  const isNewOrderPage = eyebrow === 'Orders' && title === 'New Order' && description === 'Create branch order.';
  const displayTitle = isNewOrderPage ? 'Create New Order' : title;

  return (
    <section className="rounded-xl border border-[#263244] bg-[#111827] p-3 shadow-panel">
      {!isNewOrderPage && eyebrow ? <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#82C8E5]">{eyebrow}</p> : null}
      {displayTitle ? <h1 className={isNewOrderPage ? 'text-sm font-black uppercase tracking-[0.14em] text-[#fff176]' : 'mt-1 text-lg font-black text-white'}>{displayTitle}</h1> : null}
      {!isNewOrderPage && description ? <p className="mt-1 max-w-3xl text-xs leading-5 text-[#c7d2df]">{description}</p> : null}
      {children ? <div className={isNewOrderPage ? 'mt-2' : 'mt-3'}>{children}</div> : null}
    </section>
  );
}
