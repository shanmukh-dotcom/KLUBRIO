'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, ArrowRight, Calendar, Users, Zap, Star, Menu, X, Sparkles, ShieldCheck } from 'lucide-react';
import { KlubrioLogo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function LandingPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/events?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0F172A] selection:bg-indigo-500 selection:text-white">
      {/* ── STICKY TOP NAV ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <KlubrioLogo size="sm" href="/" />

            {/* Nav links — desktop */}
            <nav className="hidden md:flex items-center gap-7">
              {[
                { href: '/', label: 'Home', active: true },
                { href: '/events', label: 'Events' },
                { href: '/clubs', label: 'Clubs' },
                { href: '/student/discover', label: 'About' },
              ].map(({ href, label, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={`text-sm transition-colors relative py-1 ${
                    active ? 'text-[#4F46E5] font-semibold' : 'text-slate-600 hover:text-[#0F172A] font-medium'
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 bg-[#4F46E5] rounded-full" />
                  )}
                </Link>
              ))}
            </nav>

            {/* Search — desktop */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xs mx-4">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search events or clubs..."
                  className="w-full pl-9 pr-8 py-1.5 text-xs font-normal bg-slate-100 hover:bg-slate-50 focus:bg-white border border-transparent focus:border-slate-300 rounded-full focus:outline-none transition-all placeholder-slate-400 text-slate-700"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-mono text-slate-400">/</span>
              </div>
            </form>

            {/* Auth actions */}
            <div className="hidden md:flex items-center gap-3">
              <Link
                href="/student/home"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                Student Feed
              </Link>
              <Link
                href="/organiser/dashboard"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-full hover:bg-slate-100 transition-colors"
              >
                Organiser Hub
              </Link>
              <Link
                href="/login"
                className="text-xs font-semibold text-slate-700 hover:text-[#4F46E5] transition-colors px-3 py-1.5"
              >
                Sign In
              </Link>
              <Button size="sm" onClick={() => router.push('/signup')}>
                Get Started
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              className="md:hidden ml-auto p-2 rounded-xl text-slate-700 hover:bg-slate-100 cursor-pointer"
              onClick={() => setMobileMenuOpen(v => !v)}
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-5 py-4 space-y-3 shadow-xl">
            {[
              { href: '/', label: 'Home' },
              { href: '/events', label: 'Events' },
              { href: '/clubs', label: 'Clubs' },
              { href: '/student/discover', label: 'Discover' },
              { href: '/student/home', label: 'Student Portal' },
              { href: '/organiser/dashboard', label: 'Organiser Portal' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className="block py-2 text-sm font-medium text-slate-700 hover:text-indigo-600" onClick={() => setMobileMenuOpen(false)}>
                {label}
              </Link>
            ))}
            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <Link href="/login" className="flex-1 text-center py-2 text-xs font-semibold border border-slate-200 rounded-full text-slate-800">
                Sign In
              </Link>
              <Link href="/signup" className="flex-1 text-center py-2 text-xs font-semibold bg-gradient-to-r from-[#4F46E5] to-[#06B6D4] text-white rounded-full">
                Get Started
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ── IMMERSIVE FULL-WIDTH CAMPUS HERO ── */}
      <section className="relative w-full h-[78vh] min-h-[640px] max-h-[820px] overflow-hidden">
        {/* Full-width Background Image edge-to-edge anchored to top to preserve all text cleanly */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-campus.png"
            alt="Campus Life, Upgraded - Discover verified campus clubs, explore premier events, connect with talented peers, and build lifelong memories."
            fill
            priority
            sizes="100vw"
            className="object-cover object-[65%_top] sm:object-top"
          />
          {/* Subtle soft fade to white at the bottom edge */}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/40 to-transparent pointer-events-none" />
        </div>

        {/* Semantic accessible content for SEO and screen readers */}
        <div className="sr-only">
          <p>CLUBS · EVENTS · IMPACT</p>
          <h1>Campus Life, Upgraded.</h1>
          <p>Discover verified campus clubs, explore premier events, connect with talented peers, and build lifelong memories.</p>
        </div>
      </section>

      {/* ── FLOATING FROSTED GLASS 4-BENEFIT STRIP (SEPARATED WITH ZERO OVERLAP) ── */}
      <section className="relative z-10 -mt-14 sm:-mt-18 max-w-6xl mx-auto px-4 sm:px-6 mb-16">
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/80 shadow-[0_12px_40px_rgba(0,0,0,0.08)] rounded-3xl p-5 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* 1. Discover */}
            <Link href="/events" className="group flex items-center gap-3.5 hover:opacity-95 transition-opacity">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F172A] leading-tight">Discover</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">Find events that match your interests.</p>
                <div className="h-0.5 w-6 rounded-full bg-[#4F46E5] mt-1.5 opacity-60 group-hover:w-10 transition-all" />
              </div>
            </Link>

            {/* 2. Join */}
            <Link href="/clubs" className="group flex items-center gap-3.5 hover:opacity-95 transition-opacity">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#ECFDF5] text-[#059669] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F172A] leading-tight">Join</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">Be part of vibrant club communities.</p>
                <div className="h-0.5 w-6 rounded-full bg-[#10B981] mt-1.5 opacity-60 group-hover:w-10 transition-all" />
              </div>
            </Link>

            {/* 3. Participate */}
            <Link href="/events" className="group flex items-center gap-3.5 hover:opacity-95 transition-opacity">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#F0F9FF] text-[#0284C7] flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F172A] leading-tight">Participate</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">Learn, build and create real opportunities.</p>
                <div className="h-0.5 w-6 rounded-full bg-[#0284C7] mt-1.5 opacity-60 group-hover:w-10 transition-all" />
              </div>
            </Link>

            {/* 4. Make an Impact */}
            <Link href="/signup" className="group flex items-center gap-3.5 hover:opacity-95 transition-opacity">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#FAF5FF] text-[#9333EA] flex items-center justify-center">
                <Star className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#0F172A] leading-tight">Make an Impact</h3>
                <p className="text-xs text-slate-500 mt-0.5 leading-snug">Turn your ideas into a better tomorrow.</p>
                <div className="h-0.5 w-6 rounded-full bg-[#9333EA] mt-1.5 opacity-60 group-hover:w-10 transition-all" />
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
