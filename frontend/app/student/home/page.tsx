'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  MapPin,
  Clock,
  ArrowRight,
  ChevronRight,
  Calendar,
  Users,
  Image as ImageIcon,
  LayoutGrid,
  Bell,
  Building2,
  Sparkles,
  Rocket,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { MOCK_EVENTS, MOCK_CLUBS } from '@/mocks/data';
import { useRouter } from 'next/navigation';
import { ClubEmblem } from '@/components/ui/club-emblem';

export default function StudentHomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) router.push(`/student/discover?q=${encodeURIComponent(search.trim())}`);
  };

  const primaryEvent = MOCK_EVENTS[0] ?? {
    id: 'evt-1',
    title: "Nexovate 2.0: The Engineer's Pitch",
    clubName: 'HARVEST',
    date: '2026-09-11',
    venue: 'E Block, Seminar Hall 3',
    startTime: '4:00 PM',
    tagline: 'Pitch. Innovate. Inspire.',
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* ── TOP HERO PANORAMA BANNER (MATCHES Modern Campus Dashboard Interface (1).png) ── */}
      <div className="relative w-full min-h-[300px] sm:min-h-[340px] overflow-hidden flex flex-col justify-between p-6 sm:p-8">
        {/* Campus Sunset Background Image (anchored to the right architectural building to hide burned-in hero text) */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/hero-campus.png"
            alt="Campus Architecture Sunset"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[right_center] sm:object-[95%_center]"
          />
          {/* Deep left contrast gradient to keep text crisp with zero ghosting */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/60 to-slate-900/20" />
        </div>

        {/* Top Floating Controls: College Selector, Notification Bell, User Avatar */}
        <div className="relative z-10 flex items-center justify-end gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white/90 backdrop-blur-md text-xs font-semibold text-slate-800 shadow-sm border border-white/60">
            <Building2 className="w-3.5 h-3.5 text-[#4F46E5]" />
            <span>Presidency University</span>
          </div>

          <Link
            href="/student/notifications"
            className="relative p-2 rounded-full bg-white/90 backdrop-blur-md text-slate-700 hover:text-[#4F46E5] shadow-sm border border-white/60 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-[#EF4444] text-[9px] font-bold text-white">
              3
            </span>
          </Link>

          <Link
            href="/student/profile"
            className="w-8 h-8 rounded-full bg-[#EEF2FF] border border-white/80 shadow-sm flex items-center justify-center font-bold text-xs text-[#4F46E5]"
            title="View Profile"
          >
            {user?.fullName ? user.fullName[0].toUpperCase() : 'B'}
          </Link>
        </div>

        {/* Hero Bottom Row: Welcome headline on left, campus quote on right */}
        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 pt-4">
          <div className="max-w-xl">
            <h1
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight mb-1"
              style={{ fontFamily: 'Poppins, sans-serif' }}
            >
              Welcome back, {user?.fullName?.split(' ')[0] ?? 'Ballaya'}!
            </h1>
            <p className="text-white/90 text-sm sm:text-base font-normal mb-5">
              Discover. Connect. Belong.
            </p>

            {/* Clean White Search Pill */}
            <form onSubmit={handleSearch} className="max-w-md">
              <div className="relative flex items-center">
                <Search className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search for clubs or events..."
                  className="w-full pl-11 pr-4 py-2.5 bg-white/95 backdrop-blur-md rounded-full text-xs sm:text-sm font-normal text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4F46E5] shadow-md transition-all"
                />
              </div>
            </form>
          </div>

          {/* Campus Quote on Right */}
          <div className="hidden lg:block text-right max-w-xs text-white/90 text-xs sm:text-sm italic leading-relaxed">
            <p>&ldquo;New people.</p>
            <p>New experiences.</p>
            <p>A campus that grows with you.&rdquo;</p>
            <span className="inline-block mt-1 text-white/60">—</span>
          </div>
        </div>
      </div>

      {/* ── MAIN DASHBOARD CONTENT GRID ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── LEFT 2 COLUMNS: UPCOMING EVENTS & POPULAR CLUBS ── */}
          <div className="lg:col-span-2 space-y-8">
            {/* 1. Upcoming Events Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-lg font-bold text-[#0F172A]"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Upcoming Events
                </h2>
                <Link
                  href="/student/events"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] transition-colors"
                >
                  <span>See all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Featured Nexovate 2.0 Card (Matches reference card with stage graphic) */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden relative group">
                <div className="flex flex-col sm:flex-row items-stretch">
                  {/* Left Event Details */}
                  <div className="flex-1 p-5 sm:p-6 flex flex-col justify-between min-w-0 z-10">
                    <div>
                      <div className="flex items-start gap-4 mb-3">
                        {/* Date badge: SEP 11 */}
                        <div className="shrink-0 w-14 h-16 rounded-2xl bg-[#EEF2FF] border border-[#C7D2FE] flex flex-col items-center justify-center text-center">
                          <span className="text-[10px] font-bold text-[#4F46E5] uppercase tracking-wider">SEP</span>
                          <span className="text-xl font-bold text-[#0F172A] leading-none mt-0.5">11</span>
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3
                            className="font-bold text-base sm:text-lg text-[#0F172A] group-hover:text-[#4F46E5] transition-colors leading-snug"
                            style={{ fontFamily: 'Poppins, sans-serif' }}
                          >
                            Nexovate 2.0: The Engineer&apos;s Pitch
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500 font-normal">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              E Block, Seminar Hall 3
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              4:00 PM
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 font-medium mb-4 pl-18">
                        Pitch. Innovate. Inspire.
                      </p>
                    </div>

                    <div className="pl-18">
                      <Link
                        href={`/events/${primaryEvent.id}`}
                        className="inline-flex items-center justify-center px-5 py-2 rounded-full border-2 border-[#6366F1] text-[#4F46E5] hover:bg-[#EEF2FF] font-semibold text-xs transition-colors"
                      >
                        Register Now
                      </Link>
                    </div>
                  </div>

                  {/* Right Stage Visual (Microphone & Stage Spotlights Graphic) */}
                  <div className="sm:w-64 h-36 sm:h-auto bg-gradient-to-r from-white via-indigo-950/20 to-slate-900 relative overflow-hidden flex items-center justify-center">
                    {/* SVG Stage Illustration */}
                    <svg viewBox="0 0 240 180" className="w-full h-full object-cover" fill="none">
                      <defs>
                        <linearGradient id="stage-spot" x1="0" y1="0" x2="240" y2="180">
                          <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.4" />
                          <stop offset="50%" stopColor="#818CF8" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.3" />
                        </linearGradient>
                        <radialGradient id="mic-glow" cx="50%" cy="50%" r="50%">
                          <stop offset="0%" stopColor="#C7D2FE" stopOpacity="0.8" />
                          <stop offset="100%" stopColor="#1E1B4B" stopOpacity="0" />
                        </radialGradient>
                      </defs>
                      <rect width="240" height="180" fill="#1E1B4B" />
                      {/* Spotlights from ceiling */}
                      <polygon points="40,0 20,180 80,180" fill="url(#stage-spot)" />
                      <polygon points="120,0 70,180 170,180" fill="url(#stage-spot)" opacity="0.8" />
                      <polygon points="200,0 150,180 230,180" fill="url(#stage-spot)" />
                      {/* Spotlight rings on ceiling */}
                      <circle cx="40" cy="8" r="6" fill="#818CF8" />
                      <circle cx="120" cy="8" r="7" fill="#A5B4FC" />
                      <circle cx="200" cy="8" r="6" fill="#818CF8" />
                      {/* Center microphone stand */}
                      <circle cx="140" cy="80" r="32" fill="url(#mic-glow)" />
                      {/* Mic capsule */}
                      <rect x="135" y="65" width="10" height="18" rx="5" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
                      <line x1="140" y1="83" x2="140" y2="160" stroke="#CBD5E1" strokeWidth="2.5" />
                      <path d="M130 75 C130 88 150 88 150 75" stroke="#94A3B8" strokeWidth="2" fill="none" />
                      <ellipse cx="140" cy="160" rx="16" ry="5" fill="#475569" />
                    </svg>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Popular Clubs Section (Matches the 4 clean cards from reference) */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-lg font-bold text-[#0F172A]"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Popular Clubs
                </h2>
                <Link
                  href="/student/clubs"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] transition-colors"
                >
                  <span>See all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { name: 'HARVEST', tagline: 'AgriTech Innovation', members: '2.5K' },
                  { name: 'TechSphere', tagline: 'Computing & Tech Society', members: '2.8K' },
                  { name: 'Design Nexus', tagline: 'Creative Design & UX', members: '1.9K' },
                  { name: 'Sports Club', tagline: 'Athletics & Fitness', members: '1.7K' },
                ].map(club => (
                  <Link
                    key={club.name}
                    href="/student/clubs"
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md p-4 flex flex-col items-center text-center transition-all group"
                  >
                    <div className="mb-3 group-hover:scale-105 transition-transform">
                      <ClubEmblem name={club.name} size="lg" />
                    </div>
                    <h3
                      className="font-bold text-sm text-[#0F172A] group-hover:text-[#4F46E5] transition-colors truncate w-full"
                      style={{ fontFamily: 'Poppins, sans-serif' }}
                    >
                      {club.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-normal truncate w-full mt-0.5 mb-2.5">
                      {club.tagline}
                    </p>
                    <div className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500">
                      <Users className="w-3 h-3 text-slate-400" />
                      <span>{club.members} members</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {/* ── RIGHT 1 COLUMN: YOUR CLUBS, QUICK LINKS, PREMIUM BANNER ── */}
          <div className="space-y-6">
            {/* 1. Your Clubs Card (Matches reference card with HARVEST logo & arrow) */}
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
              <div className="flex items-center justify-between mb-4">
                <h2
                  className="text-base font-bold text-[#0F172A]"
                  style={{ fontFamily: 'Poppins, sans-serif' }}
                >
                  Your Clubs
                </h2>
                <Link
                  href="/student/clubs"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#4F46E5] hover:text-[#4338CA] transition-colors"
                >
                  <span>See all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              <Link
                href="/clubs/club-1"
                className="block p-3 rounded-2xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/60 transition-all group"
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <ClubEmblem name="HARVEST" size="lg" />
                    <div>
                      <h3
                        className="text-base font-bold text-[#064E3B] leading-tight"
                        style={{ fontFamily: 'Poppins, sans-serif' }}
                      >
                        HARVEST
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">AgriTech Innovation</p>
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 group-hover:text-[#4F46E5] group-hover:border-[#4F46E5] transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 font-normal leading-relaxed pl-1 pt-1 border-t border-slate-100">
                  • Hybrid AI and Robotics for Vitality Enhancement and Sustainable Transformation
                </p>
              </Link>
            </section>

            {/* 2. Quick Links Section (Matches the 4 clean squircle buttons) */}
            <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
              <h2
                className="text-base font-bold text-[#0F172A] mb-3.5"
                style={{ fontFamily: 'Poppins, sans-serif' }}
              >
                Quick Links
              </h2>

              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { icon: Calendar, label: 'Events', href: '/student/events', color: 'text-[#4F46E5]' },
                  { icon: Users, label: 'Clubs', href: '/student/clubs', color: 'text-[#0284C7]' },
                  { icon: ImageIcon, label: 'Gallery', href: '/student/discover', color: 'text-[#10B981]' },
                  { icon: LayoutGrid, label: 'More', href: '/student/discover', color: 'text-[#8B5CF6]' },
                ].map(({ icon: Icon, label, href, color }) => (
                  <Link
                    key={label}
                    href={href}
                    className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200/70 hover:border-slate-300 hover:bg-slate-50/70 transition-all text-center group"
                  >
                    <Icon className={`w-5 h-5 ${color} mb-1.5 group-hover:scale-110 transition-transform`} />
                    <span className="text-[11px] font-medium text-slate-700">{label}</span>
                  </Link>
                ))}
              </div>
            </section>

            {/* 3. Upgrade to Premium Banner (Matches bottom right banner in reference) */}
            <div className="rounded-2xl p-4 bg-gradient-to-r from-[#4F46E5] via-[#6366F1] to-[#06B6D4] text-white shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0 w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                  <Rocket className="w-5 h-5 text-cyan-200" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm text-white leading-tight">
                    Upgrade to Premium
                  </h3>
                  <p className="text-[11px] text-white/80 font-normal leading-snug truncate">
                    Get early access to exclusive events, privileges and more!
                  </p>
                </div>
              </div>

              <Link
                href="/student/settings"
                className="shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors"
                title="Upgrade"
              >
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
