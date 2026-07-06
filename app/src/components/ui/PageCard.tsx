import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';

type PageCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
};

export function PageCard({ eyebrow, title, description, children }: PageCardProps) {
  const displayTitle = title === 'New Order' ? 'Create New Order' : title;

  return (
    <section className="portal-page-card rounded-[26px] p-4 lg:p-5">
      <div className="relative z-10 mb-4 flex flex-col gap-3 border-b border-slate-200/70 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl bg-blue-50 text-[#1677ff] ring-1 ring-blue-100">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1677ff]">{eyebrow}</p>
          </div>
          <h1 className="text-2xl font-black tracking-[-0.045em] text-slate-950 lg:text-3xl">{displayTitle}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-500">{description}</p> : null}
        </div>
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white/70 px-3 py-2 shadow-sm">
          <span className="portal-pulse h-2.5 w-2.5 rounded-full bg-emerald-500 text-emerald-500" />
          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Operational</span>
        </div>
      </div>
      {children ? <div className="relative z-10">{children}</div> : null}
    </section>
  );
}
