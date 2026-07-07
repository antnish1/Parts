import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

const variantClass = {
  primary: 'border border-blue-500/20 bg-gradient-to-r from-[#1677ff] to-[#06b6d4] text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30',
  secondary: 'border border-slate-200 bg-white/80 text-slate-700 shadow-sm hover:border-blue-300 hover:bg-white hover:text-slate-950',
  danger: 'border border-rose-500/20 bg-gradient-to-r from-rose-600 to-red-500 text-white shadow-lg shadow-rose-500/20 hover:shadow-rose-500/30',
  ghost: 'border border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white/70 hover:text-slate-950',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantClass;
  leftIcon?: ReactNode;
};

export function Button({ className, variant = 'primary', leftIcon, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-black tracking-[-0.01em] transition duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0',
        variantClass[variant],
        className,
      )}
      {...props}
    >
      {leftIcon}
      {children}
    </button>
  );
}
