'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Users, ArrowRight, Sparkles, Calendar, ShieldCheck } from 'lucide-react';
import { MOCK_CLUBS } from '@/mocks/data';
import { Button } from '@/components/ui/button';
import { KlubrioLogo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const CATEGORIES = ['All', 'Technology', 'Design', 'Sports', 'Entrepreneurship'];

export default function ClubsPublicPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const router = useRouter();
  const icons: Record<string, string> = {
    'HARVEST': '🌱',
    'TechSphere': '⚡',
    'Design Nexus': '🎨',
    'Sports Club': '🏆',
    'AI & Robotics Club': '🤖',
    'Entrepreneurship Cell': '🚀',
  };

  const filtered = MOCK_CLUBS.filter(c => {
    if (category !== 'All' && c.category !== category) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.tagline.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] flex flex-col">
      {/* ── STICKY TOP NAV ── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-indigo-100 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16 justify-between gap-4">
            <div className="flex items-center gap-6">
              <KlubrioLogo size="sm" href="/" />
              <nav className="hidden md:flex items-center gap-4">
                <Link href="/" className="text-xs font-bold text-slate-600 hover:text-indigo-600">Home</Link>
                <Link href="/events" className="text-xs font-bold text-slate-600 hover:text-indigo-600">Events</Link>
                <Link href="/clubs" className="text-xs font-extrabold text-[#4F46E5] bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">Clubs</Link>
                <Link href="/student/discover" className="text-xs font-bold text-slate-600 hover:text-indigo-600">Explore</Link>
              </nav>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/student/home"
                className="text-xs font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-full hover:bg-indigo-100 transition-colors"
              >
                Student Feed
              </Link>
              <Link
                href="/login"
                className="text-xs font-bold text-slate-700 hover:text-[#4F46E5]"
              >
                Sign In
              </Link>
              <Button size="sm" onClick={() => router.push('/signup')}>
                Get Started
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Header Banner */}
      <div className="bg-gradient-to-b from-white to-slate-50 border-b border-indigo-100 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs mb-3">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>VERIFIED CAMPUS COMMUNITIES</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Explore Campus Clubs
              </h1>
              <p className="text-slate-600 text-sm mt-1 max-w-xl">
                Find technical societies, cultural squads, sports clubs and innovation cells to fuel your passions.
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clubs by name or keywords..."
                className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 shadow-sm"
              />
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer',
                  category === cat
                    ? 'bg-gradient-to-r from-[#10B981] to-[#06B6D4] text-white shadow-md shadow-emerald-500/25 scale-105'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Clubs Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(club => (
            <div
              key={club.id}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 hover:shadow-xl hover:border-emerald-400 hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/15 via-emerald-500/15 to-cyan-500/15 border border-indigo-200 flex items-center justify-center text-3xl shadow-xs group-hover:scale-110 transition-transform">
                    {icons[club.name] ?? '🏫'}
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {club.category}
                  </span>
                </div>

                <Link href={`/clubs/${club.id}`}>
                  <h3 className="font-black text-slate-900 text-lg mb-1 group-hover:text-emerald-700 transition-colors" style={{ fontFamily: 'Poppins, sans-serif' }}>
                    {club.name}
                  </h3>
                </Link>
                <p className="text-xs text-indigo-600 font-bold mb-3">{club.tagline}</p>
                <p className="text-xs text-slate-500 font-medium leading-relaxed mb-6 line-clamp-3">
                  {club.description}
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs text-slate-500 font-bold py-3 border-t border-slate-100 mb-4">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Users className="w-4 h-4 text-emerald-600" />
                    {(club.membersCount / 1000).toFixed(1)}K Members
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    {club.eventsCount} Events
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/clubs/${club.id}`}
                    className="flex-1 py-2.5 text-center bg-gradient-to-r from-[#10B981] via-[#059669] to-[#06B6D4] text-white text-xs font-black rounded-full shadow-md shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:brightness-110 active:scale-95 transition-all"
                  >
                    View Community
                  </Link>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-full hover:bg-slate-50"
                  >
                    Join
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
            <Users className="w-12 h-12 text-emerald-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No clubs found matching your search.</h3>
            <p className="text-xs text-slate-500 mt-1">Try selecting a different category or clearing the search query.</p>
          </div>
        )}
      </div>
    </div>
  );
}
