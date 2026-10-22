'use client';

import React from 'react';
import { cn } from '@/lib/utils';

// ---- Badge ----
type BadgeVariant = 'default' | 'violet' | 'blue' | 'teal' | 'red' | 'yellow' | 'gray' | 'purple' | 'cyan';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const badgeVariants: Record<BadgeVariant, string> = {
  default: 'bg-slate-100 text-slate-800 border border-slate-200 font-bold',
  violet: 'bg-indigo-100 text-indigo-800 border border-indigo-200/90 shadow-2xs font-bold',
  purple: 'bg-purple-100 text-purple-900 border border-purple-200/90 shadow-2xs font-bold',
  blue: 'bg-blue-100 text-blue-800 border border-blue-200/90 shadow-2xs font-bold',
  cyan: 'bg-cyan-100 text-cyan-900 border border-cyan-200/90 shadow-2xs font-bold',
  teal: 'bg-emerald-100 text-emerald-900 border border-emerald-200/90 shadow-2xs font-bold',
  red: 'bg-rose-100 text-rose-800 border border-rose-200/90 shadow-2xs font-bold',
  yellow: 'bg-amber-100 text-amber-950 border border-amber-200/90 shadow-2xs font-bold',
  gray: 'bg-slate-100 text-slate-800 border border-slate-200/80 font-bold',
};

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs tracking-tight', badgeVariants[variant], className)}>
      {children}
    </span>
  );
}

// ---- Card ----
interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

export function Card({ children, className, onClick, hover, padding = 'md' }: CardProps) {
  const paddings = { sm: 'p-4', md: 'p-5', lg: 'p-6', none: '' };
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-2xl border border-slate-200/80 shadow-xs',
        paddings[padding],
        hover && 'hover:shadow-md hover:border-indigo-300 transition-all duration-200 cursor-pointer hover:-translate-y-0.5',
        className
      )}
    >
      {children}
    </div>
  );
}

// ---- Divider ----
export function Divider({ label, className }: { label?: string; className?: string }) {
  if (!label) return <hr className={cn('border-gray-200', className)} />;
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <hr className="flex-1 border-gray-200" />
      <span className="text-xs text-gray-500 font-bold whitespace-nowrap uppercase tracking-wider">{label}</span>
      <hr className="flex-1 border-gray-200" />
    </div>
  );
}

// ---- Avatar ----
interface AvatarProps {
  name: string;
  src?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const avatarSizes = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
};

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={name} className={cn('rounded-full object-cover ring-2 ring-indigo-400/30', avatarSizes[size], className)} />
    );
  }
  return (
    <div className={cn('rounded-full bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center font-bold shadow-2xs border border-[#C7D2FE]', avatarSizes[size], className)}>
      {initials}
    </div>
  );
}

// ---- Modal ----
interface ModalProps {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, isOpen, onClose, title, description, children, size = 'md' }: ModalProps) {
  const isVisible = open ?? isOpen ?? false;
  if (!isVisible) return null;
  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-2xl', xl: 'max-w-4xl' };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={onClose} />
      <div className={cn('relative bg-white rounded-3xl shadow-2xl w-full border border-slate-100 overflow-hidden', sizes[size])}>
        {(title || description) && (
          <div className="flex items-start justify-between px-6 py-4.5 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
            <div>
              {title && <h2 className="text-lg font-bold text-[#0F172A]" style={{ fontFamily: 'Poppins, sans-serif' }}>{title}</h2>}
              {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-1.5 rounded-full transition-colors cursor-pointer">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ---- Skeleton ----
export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse bg-slate-200 rounded-xl', className)} />
  );
}

// ---- Tab Group ----
interface Tab { id: string; label: string; count?: number }

interface TabGroupProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function TabGroup({ tabs, active, onChange, className }: TabGroupProps) {
  return (
    <div className={cn('flex gap-1.5 bg-slate-100/90 border border-slate-200/60 rounded-2xl p-1', className)}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all duration-150 cursor-pointer',
            active === tab.id
              ? 'bg-white text-[#4F46E5] shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className={cn(
              'inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-bold leading-none',
              active === tab.id ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'bg-slate-200 text-slate-700'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ---- Toggle ----
interface ToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  description?: string;
}

export function Toggle({ checked, onChange, label, description }: ToggleProps) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:ring-offset-2 cursor-pointer',
          checked ? 'bg-[#4F46E5]' : 'bg-slate-300'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition duration-200',
            checked ? 'translate-x-5' : 'translate-x-0'
          )}
        />
      </button>
      {(label || description) && (
        <div>
          {label && <p className="text-sm font-bold text-[#0F172A]">{label}</p>}
          {description && <p className="text-xs text-slate-500 font-medium">{description}</p>}
        </div>
      )}
    </div>
  );
}
