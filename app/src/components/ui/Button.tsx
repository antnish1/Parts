import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { clsx } from 'clsx';

const variantClass = {
  primary: 'bg-pc-gold text-slate-950 hover:bg-yellow-300 shadow-lg shadow-yellow-500/20',
  secondary: 'bg-slate-800 text-slate-100 border border-slate-700 hover:border-pc-gold/60',
  danger: 'bg-red-600 text-white hover:bg-red-500',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variantClass;
  leftIcon?: ReactNode;
};

export function Button({ className, variant = 'primary', leftIcon, children, ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        'pc-button',
        `pc-button--${variant}`,
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60',
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
