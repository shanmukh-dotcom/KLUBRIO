'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export type ClubIdentifier = 'HARVEST' | 'TechSphere' | 'Design Nexus' | 'Sports Club' | 'AI & Robotics Club' | 'Entrepreneurship Cell' | string;

interface ClubEmblemProps {
  name: ClubIdentifier;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-7 h-7',
  md: 'w-10 h-10',
  lg: 'w-14 h-14',
  xl: 'w-16 h-16',
};

export function ClubEmblem({ name, size = 'md', className }: ClubEmblemProps) {
  const norm = name?.trim().toLowerCase() || '';

  // 1. HARVEST (AgriTech Innovation Club)
  if (norm.includes('harvest')) {
    return (
      <div
        className={cn(
          'rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center shrink-0 p-1.5 transition-transform',
          sizeClasses[size],
          className
        )}
        title="HARVEST AgriTech Innovation"
      >
        <svg viewBox="0 0 40 40" fill="none" className="w-full h-full text-emerald-600">
          <circle cx="20" cy="20" r="18" fill="#ECFDF5" stroke="#10B981" strokeWidth="1.5" />
          {/* Leaves */}
          <path
            d="M20 9C20 9 23 13 22 17C21 20 18 21 17 21C16 21 15 18 16 15C17 12 20 9 20 9Z"
            fill="#059669"
          />
          <path
            d="M20 11C20 11 25 14 26 18C27 21 24 23 23 23C21 23 20 20 20.5 17C21 14 20 11 20 11Z"
            fill="#10B981"
            opacity="0.85"
          />
          {/* Stem & cupped hands */}
          <path
            d="M20 19V27M13 22C14 25 17 27 20 27C23 27 26 25 27 22"
            stroke="#047857"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="20" cy="14" r="1.5" fill="#34D399" />
        </svg>
      </div>
    );
  }

  // 2. TechSphere (Computing & Tech Society)
  if (norm.includes('techsphere') || norm.includes('computing')) {
    return (
      <div
        className={cn(
          'rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center shrink-0 p-1.5 transition-transform',
          sizeClasses[size],
          className
        )}
        title="TechSphere Computing Society"
      >
        <svg viewBox="0 0 40 40" fill="none" className="w-full h-full text-blue-600">
          <rect x="4" y="4" width="32" height="32" rx="8" fill="#EFF6FF" stroke="#3B82F6" strokeWidth="1.5" />
          {/* Central processor */}
          <rect x="14" y="14" width="12" height="12" rx="2.5" fill="#2563EB" />
          {/* Internal core */}
          <rect x="17" y="17" width="6" height="6" rx="1" fill="#93C5FD" />
          {/* Pins */}
          <path
            d="M16 10V14M20 10V14M24 10V14 M16 26V30M20 26V30M24 26V30 M10 16H14M10 20H14M10 24H14 M26 16H30M26 20H30M26 24H30"
            stroke="#3B82F6"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </div>
    );
  }

  // 3. Design Nexus (Creative Design & UX)
  if (norm.includes('design') || norm.includes('nexus')) {
    return (
      <div
        className={cn(
          'rounded-2xl bg-cyan-50 border border-cyan-200/80 flex items-center justify-center shrink-0 p-1.5 transition-transform',
          sizeClasses[size],
          className
        )}
        title="Design Nexus"
      >
        <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
          <rect x="4" y="4" width="32" height="32" rx="8" fill="#F0FDFA" stroke="#06B6D4" strokeWidth="1.5" />
          {/* Pen Nib */}
          <path
            d="M20 8L27 18C27 22 24 25 20 25C16 25 13 22 13 18L20 8Z"
            fill="url(#pen-grad)"
          />
          <path d="M20 17V24" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="20" cy="17" r="1.5" fill="#FFFFFF" />
          <path d="M16 27C17.5 28.5 22.5 28.5 24 27" stroke="#0891B2" strokeWidth="2" strokeLinecap="round" />
          <defs>
            <linearGradient id="pen-grad" x1="13" y1="8" x2="27" y2="25" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0284C7" />
              <stop offset="1" stopColor="#4F46E5" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 4. Sports Club
  if (norm.includes('sport')) {
    return (
      <div
        className={cn(
          'rounded-2xl bg-amber-50 border border-amber-200/80 flex items-center justify-center shrink-0 p-1.5 transition-transform',
          sizeClasses[size],
          className
        )}
        title="Sports Club"
      >
        <svg viewBox="0 0 40 40" fill="none" className="w-full h-full text-amber-500">
          <rect x="4" y="4" width="32" height="32" rx="8" fill="#FFFBEB" stroke="#F59E0B" strokeWidth="1.5" />
          {/* Trophy */}
          <path
            d="M14 11H26V18C26 21.3 23.3 24 20 24C16.7 24 14 21.3 14 18V11Z"
            fill="#F59E0B"
          />
          <path
            d="M14 13H10C9 13 8 14 8 15C8 17.5 10 19.5 12.5 19.5H14 M26 13H30C31 13 32 14 32 15C32 17.5 30 19.5 27.5 19.5H26"
            stroke="#D97706"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path d="M20 24V28M15 28H25" stroke="#D97706" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // 5. AI & Robotics
  if (norm.includes('robot') || norm.includes('ai')) {
    return (
      <div
        className={cn(
          'rounded-2xl bg-purple-50 border border-purple-200/80 flex items-center justify-center shrink-0 p-1.5 transition-transform',
          sizeClasses[size],
          className
        )}
        title="AI & Robotics Club"
      >
        <svg viewBox="0 0 40 40" fill="none" className="w-full h-full">
          <rect x="4" y="4" width="32" height="32" rx="8" fill="#FAF5FF" stroke="#A855F7" strokeWidth="1.5" />
          <rect x="12" y="13" width="16" height="13" rx="3" fill="#9333EA" />
          <circle cx="16" cy="18" r="1.8" fill="#FFFFFF" />
          <circle cx="24" cy="18" r="1.8" fill="#FFFFFF" />
          <path d="M17 22H23" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M20 10V13M10 18H12M28 18H30" stroke="#7E22CE" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }

  // Fallback default emblem
  return (
    <div
      className={cn(
        'rounded-2xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-center shrink-0 p-1.5 transition-transform text-indigo-700 font-bold',
        sizeClasses[size],
        className
      )}
    >
      <span className="text-sm tracking-wider uppercase">{name.slice(0, 2)}</span>
    </div>
  );
}
