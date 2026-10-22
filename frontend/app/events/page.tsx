'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Calendar, MapPin, Clock, ArrowRight, Sparkles, Filter, ChevronLeft } from 'lucide-react';
import { MOCK_EVENTS } from '@/mocks/data';
import { Button } from '@/components/ui/button';
import { KlubrioLogo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

const CATEGORIES = ['All', 'Technology', 'Design', 'Sports', 'Arts', 'Entrepreneurship', 'Social Impact'];

export default function EventsPublicPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const router = useRouter();

  const filtered = MOCK_EVENTS.filter(e => {
    if (category !== 'All' && e.category !== category) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase()) && !e.venue.toLowerCase().includes(search.toLowerCase())) return false;
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
                <Link href="/events" className="text-xs font-extrabold text-[#4F46E5] bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200">Events</Link>
                <Link href="/clubs" className="text-xs font-bold text-slate-600 hover:text-indigo-600">Clubs</Link>
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

      {/* Hero Header */}
      <div className="bg-gradient-to-b from-white to-slate-50 border-b border-indigo-100 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>CAMPUS EVENTS CALENDAR</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Discover Events
              </h1>
              <p className="text-slate-600 text-sm mt-1 max-w-xl">
                Hands-on workshops, ideathons, guest lectures, and cultural fests happening across the campus.
              </p>
            </div>

            <div className="relative w-full md:w-80">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-indigo-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search event title or venue..."
                className="w-full pl-9 pr-4 py-2.5 text-xs font-semibold bg-white border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 shadow-sm"
              />
            </div>
          </div>

          {/* Saturated Category Pills */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={cn(
                  'px-4 py-1.5 rounded-full text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer',
                  category === cat
                    ? 'bg-gradient-to-r from-[#6366F1] to-[#7C3AED] text-white shadow-md shadow-indigo-500/25 scale-105'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 hover:text-indigo-600'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events grid with popping visual cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(event => {
            const d = new Date(event.date);
            const month = d.toLocaleString('en', { month: 'short' }).toUpperCase();
            const day = d.getDate();

            return (
              <div
                key={event.id}
                className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-indigo-400 hover:-translate-y-1 transition-all duration-300 overflow-hidden group flex flex-col"
              >
                {/* Vivid Header graphic */}
                <div className="h-44 bg-gradient-to-br from-indigo-600 via-purple-600 to-cyan-500 relative flex items-center justify-center text-5xl overflow-hidden group-hover:scale-102 transition-transform">
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors" />
                  <span className="relative z-10 group-hover:scale-110 transition-transform">🎤</span>

                  {/* Corner date pill */}
                  <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 text-[#0F172A]">
                    <span className="text-[11px] font-black text-indigo-700 uppercase">{month}</span>
                    <span className="text-base font-black leading-none">{day}</span>
                  </div>

                  {/* Status chip */}
                  <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-xs">
                    OPEN FOR REGISTRATION
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                        {event.clubName}
                      </span>
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {event.category}
                      </span>
                    </div>

                    <Link href={`/events/${event.id}`}>
                      <h3 className="font-extrabold text-slate-900 text-lg mb-2 group-hover:text-indigo-600 transition-colors line-clamp-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {event.title}
                      </h3>
                    </Link>

                    <div className="flex flex-col gap-1.5 text-xs text-slate-500 font-semibold mb-4">
                      <span className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-500" />
                        {event.venue}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        {event.startTime} - {event.endTime ?? '7:00 PM'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 mb-4">
                      {event.description}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-slate-400 font-semibold">Registered</p>
                      <p className="text-sm font-black text-slate-900">
                        {event.registeredCount} <span className="text-xs text-slate-400 font-normal">/ {event.capacity ?? 150}</span>
                      </p>
                    </div>

                    <Link
                      href={`/events/${event.id}`}
                      className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-[#6366F1] to-[#7C3AED] text-white text-xs font-black rounded-full shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:brightness-110 active:scale-95 transition-all"
                    >
                      <span>Register</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
            <Calendar className="w-12 h-12 text-indigo-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No events found matching your search.</h3>
            <p className="text-xs text-slate-500 mt-1">Try selecting a different category or clearing the search query.</p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => { setCategory('All'); setSearch(''); }}>
              Reset Filters
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
