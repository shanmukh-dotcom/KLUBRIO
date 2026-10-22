'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { KlubrioLogo } from '@/components/ui/logo';

interface AuthLayoutProps {
  children: React.ReactNode;
  quote?: string;
  headline?: React.ReactNode;
  subtext?: string;
}

export function AuthLayout({ children, headline, subtext, quote }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex bg-white text-[#0F172A] selection:bg-indigo-500 selection:text-white">
      {/* Left panel — vibrant campus image with rich gradients */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-12 overflow-hidden bg-slate-950">
        {/* Background campus photograph */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-1000 scale-105"
          style={{
            backgroundImage: `url('/campus-hero.jpg')`,
            filter: 'brightness(0.92) contrast(1.08) saturate(1.15)',
          }}
        />
        {/* Popping multi-color overlays */}
        <div className="absolute inset-0 bg-gradient-to-tr from-[#0F172A]/90 via-[#4F46E5]/40 to-[#06B6D4]/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#090D16] via-transparent to-black/20" />
        <div className="absolute top-1/4 -right-16 w-80 h-80 bg-indigo-500/30 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10">
          <KlubrioLogo variant="light" size="md" href="/" />
        </div>

        {/* Middle headline & copy */}
        <div className="relative z-10 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-bold mb-4 shadow-sm">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>CAMPUS LIFE, UPGRADED</span>
          </div>

          {headline && (
            <div className="text-4xl lg:text-5xl font-black leading-tight mb-4 tracking-tight drop-shadow-sm" style={{ fontFamily: 'Poppins, sans-serif', color: 'white' }}>
              {headline}
            </div>
          )}
          {subtext && (
            <p className="text-indigo-100 text-base font-medium leading-relaxed max-w-md drop-shadow-xs">
              {subtext}
            </p>
          )}
        </div>

        {/* Bottom quote & pillars */}
        <div className="relative z-10 flex items-end justify-between">
          {quote && (
            <div className="bg-black/30 backdrop-blur-md p-4 rounded-2xl border border-white/20 max-w-sm">
              <p className="text-white/95 text-xs italic font-medium leading-relaxed">
                &ldquo;{quote}&rdquo;
              </p>
              <div className="mt-2.5 w-10 h-1 bg-gradient-to-r from-[#6366F1] to-[#06B6D4] rounded-full" />
            </div>
          )}

          <div className="hidden xl:flex flex-col gap-1 text-white/40 text-[10px] font-black tracking-widest uppercase select-none text-right">
            <span>CLUBS</span>
            <span>EVENTS</span>
            <span>PEOPLE</span>
            <span>IMPACT</span>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col min-h-screen relative overflow-auto bg-gradient-to-b from-white via-indigo-50/20 to-white">
        {/* Bright glowing background blur spots */}
        <div
          className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-50 pointer-events-none blur-3xl"
          style={{ background: 'radial-gradient(circle, #C7D2FE 0%, #BAE6FD 50%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-40 pointer-events-none blur-3xl"
          style={{ background: 'radial-gradient(circle, #DDD6FE 0%, #A7F3D0 50%, transparent 70%)' }}
        />

        {/* Header navigation bar */}
        <div className="flex items-center justify-between p-6 relative z-10">
          <div className="lg:hidden">
            <KlubrioLogo size="sm" href="/" />
          </div>
          <div className="flex items-center gap-4 ml-auto">
            <Link
              href="/student/home"
              className="text-xs font-black text-indigo-700 bg-indigo-100/80 hover:bg-indigo-200 border border-indigo-200 px-3.5 py-1.5 rounded-full transition-all shadow-2xs"
            >
              Skip to Demo Feed →
            </Link>
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#6366F1] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Home
            </Link>
          </div>
        </div>

        {/* Form content */}
        <div className="flex-1 flex items-center justify-center px-6 pb-12">
          <div className="w-full max-w-md relative z-10">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
