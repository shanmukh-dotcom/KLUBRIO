'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, iconRight, className, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-[#0F172A]">{label}</label>
        )}
        <div className="relative" suppressHydrationWarning>
          {icon && (
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={inputType}
            className={cn(
              'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-[#0F172A] placeholder:text-gray-400',
              'focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 focus:bg-white transition-all duration-200',
              error && 'border-red-400 focus:border-red-400 focus:ring-red-400/20',
              icon && 'pl-10',
              (iconRight || isPassword) && 'pr-10',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(v => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
          {iconRight && !isPassword && (
            <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
              {iconRight}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-400">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

// Textarea
interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="w-full space-y-1.5">
      {label && <label className="block text-sm font-medium text-[#0F172A]">{label}</label>}
      <textarea
        ref={ref}
        className={cn(
          'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-[#0F172A] placeholder:text-gray-400 resize-none',
          'focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 focus:bg-white transition-all duration-200',
          error && 'border-red-400',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
);
Textarea.displayName = 'Textarea';

// Select
interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export function Select({ label, error, icon, options, placeholder, className, ...props }: SelectProps) {
  return (
    <div className="w-full space-y-1.5">
      {label && <label className="block text-sm font-medium text-[#0F172A]">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {icon}
          </div>
        )}
        <select
          className={cn(
            'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-[#0F172A] appearance-none',
            'focus:outline-none focus:border-[#6366F1] focus:ring-2 focus:ring-[#6366F1]/20 focus:bg-white transition-all duration-200',
            error && 'border-red-400',
            icon && 'pl-10',
            'pr-10',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
