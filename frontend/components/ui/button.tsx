'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'glow';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  fullWidth?: boolean;
}

const base = 'inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none';

const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-r from-[#4F46E5] to-[#06B6D4] text-white shadow-xs hover:opacity-95 active:scale-[0.98] focus:ring-[#4F46E5]',
  glow: 'bg-[#4F46E5] text-white shadow-xs hover:bg-[#4338CA] active:scale-[0.98] focus:ring-[#4F46E5]',
  secondary: 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300 shadow-2xs active:scale-[0.98] focus:ring-slate-300',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 focus:ring-slate-200',
  outline: 'bg-transparent border border-[#6366F1] text-[#4F46E5] hover:bg-[#EEF2FF] shadow-2xs active:scale-[0.98] focus:ring-[#6366F1]',
  danger: 'bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:scale-[0.98] focus:ring-rose-500',
};

const sizes: Record<Size, string> = {
  sm: 'px-4 py-2 text-xs min-h-[36px]',
  md: 'px-6 py-2.5 text-sm min-h-[42px]',
  lg: 'px-8 py-3.5 text-base min-h-[48px] tracking-wide',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  iconRight,
  fullWidth,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(base, variants[variant], sizes[size], fullWidth && 'w-full', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}
