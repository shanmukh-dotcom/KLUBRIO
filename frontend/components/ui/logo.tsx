'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface KlubrioLogoProps {
  variant?: 'dark' | 'light';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  href?: string;
}

export function KlubrioLogo({ variant = 'dark', size = 'md', className, href = '/' }: KlubrioLogoProps) {
  const sizes = {
    sm: { icon: 28, text: 'text-lg', tagline: 'text-[9px]' },
    md: { icon: 36, text: 'text-2xl', tagline: 'text-[10px]' },
    lg: { icon: 48, text: 'text-3xl', tagline: 'text-xs' },
  };

  const s = sizes[size];
  const textColor = variant === 'dark' ? '#0F172A' : '#FFFFFF';
  const subColor = variant === 'dark' ? '#10B981' : '#10B981';

  const logo = (
    <div className={cn('flex items-center gap-2.5', className)}>
      {/* Calendar icon with gradient */}
      <svg width={s.icon} height={s.icon} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="klubrio-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
        </defs>
        {/* Body */}
        <rect x="2" y="6" width="32" height="28" rx="6" fill="url(#klubrio-grad)" />
        {/* Top pegs */}
        <rect x="10" y="2" width="4" height="8" rx="2" fill="url(#klubrio-grad)" />
        <rect x="22" y="2" width="4" height="8" rx="2" fill="url(#klubrio-grad)" />
        {/* White header line */}
        <rect x="2" y="13" width="32" height="3" fill="rgba(255,255,255,0.3)" />
        {/* Star */}
        <path d="M18 16 L19.2 19.5 L23 19.5 L20 21.5 L21.2 25 L18 23 L14.8 25 L16 21.5 L13 19.5 L16.8 19.5 Z" fill="white" opacity="0.95" />
        {/* Wave / path stroke */}
        <path d="M4 28 Q9 24 14 28 Q19 32 24 28 Q29 24 33 28" stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>

      {/* Wordmark */}
      <div className="flex flex-col leading-none">
        <span
          className={cn('font-bold tracking-tight', s.text)}
          style={{ fontFamily: 'Poppins, sans-serif', color: textColor }}
        >
          Klub<span style={{ color: subColor }}>rio</span>
        </span>
        <span
          className={cn('font-medium tracking-[0.15em] uppercase', s.tagline)}
          style={{ color: variant === 'dark' ? '#64748B' : 'rgba(255,255,255,0.7)', fontFamily: 'Inter, sans-serif' }}
        >
          Clubs · Events · People
        </span>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href} className="inline-flex">{logo}</Link>;
  }
  return logo;
}

// Compact icon-only variant
export function KlubrioIcon({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id="ki-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366F1" />
          <stop offset="50%" stopColor="#3B82F6" />
          <stop offset="100%" stopColor="#10B981" />
        </linearGradient>
      </defs>
      <rect x="2" y="6" width="32" height="28" rx="6" fill="url(#ki-grad)" />
      <rect x="10" y="2" width="4" height="8" rx="2" fill="url(#ki-grad)" />
      <rect x="22" y="2" width="4" height="8" rx="2" fill="url(#ki-grad)" />
      <rect x="2" y="13" width="32" height="3" fill="rgba(255,255,255,0.3)" />
      <path d="M18 16 L19.2 19.5 L23 19.5 L20 21.5 L21.2 25 L18 23 L14.8 25 L16 21.5 L13 19.5 L16.8 19.5 Z" fill="white" opacity="0.95" />
      <path d="M4 28 Q9 24 14 28 Q19 32 24 28 Q29 24 33 28" stroke="rgba(255,255,255,0.5)" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
